// Minimal Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) implementation
// using only the Cloudflare Workers Web Crypto API.
//
// Public surface:
//   - generateVapidKeys(): create a fresh ES256 keypair, return as
//     base64url-encoded public + private values to paste into Cloudflare
//     secrets.
//   - sendPush(env, subscription, payload, opts?): encrypt + sign + POST.

type Sub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type Env = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

// ── Base64url helpers ─────────────────────────────────────────────
export function b64uEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64uDecode(s: string): Uint8Array {
  const b64 =
    s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...arrays: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arrays) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// ── VAPID key generation ──────────────────────────────────────────
export async function generateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pubJwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.publicKey,
  )) as JsonWebKey;
  const privJwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.privateKey,
  )) as JsonWebKey;
  // Uncompressed P-256 public key = 0x04 || X(32) || Y(32).
  const x = b64uDecode(pubJwk.x!);
  const y = b64uDecode(pubJwk.y!);
  const publicKey = b64uEncode(concat(new Uint8Array([0x04]), x, y));
  return { publicKey, privateKey: privJwk.d! };
}

// ── VAPID JWT (ES256) ─────────────────────────────────────────────
async function importVapidPrivateKey(
  publicKeyB64u: string,
  privateD: string,
): Promise<CryptoKey> {
  const pub = b64uDecode(publicKeyB64u);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY must be 65-byte uncompressed P-256");
  }
  const x = b64uEncode(pub.slice(1, 33));
  const y = b64uEncode(pub.slice(33, 65));
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateD, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function buildVapidJwt(
  audience: string,
  publicKeyB64u: string,
  privateD: string,
  subject: string,
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };
  const encoder = new TextEncoder();
  const headerB = b64uEncode(encoder.encode(JSON.stringify(header)));
  const payloadB = b64uEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB}.${payloadB}`;
  const key = await importVapidPrivateKey(publicKeyB64u, privateD);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );
  const sig = b64uEncode(new Uint8Array(sigBuf));
  return `${signingInput}.${sig}`;
}

// ── HKDF helpers ──────────────────────────────────────────────────
async function hkdfExtract(
  salt: Uint8Array,
  ikm: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}
async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // For length <= 32 (SHA-256 hash length), one round suffices.
  const t = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      concat(info, new Uint8Array([0x01])),
    ),
  );
  return t.slice(0, length);
}

// ── Encrypt payload (RFC 8188 + RFC 8291) ─────────────────────────
async function encryptPayload(
  payload: Uint8Array,
  uaPublicRaw: Uint8Array, // 65 bytes uncompressed
  uaAuth: Uint8Array, // 16 bytes
): Promise<Uint8Array> {
  // 1. Generate ephemeral ECDH keypair
  const asPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPubJwk = (await crypto.subtle.exportKey(
    "jwk",
    asPair.publicKey,
  )) as JsonWebKey;
  const asPubRaw = concat(
    new Uint8Array([0x04]),
    b64uDecode(asPubJwk.x!),
    b64uDecode(asPubJwk.y!),
  );

  // 2. Import UA pubkey
  if (uaPublicRaw.length !== 65 || uaPublicRaw[0] !== 0x04) {
    throw new Error("p256dh must be 65-byte uncompressed P-256");
  }
  const uaPub = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: b64uEncode(uaPublicRaw.slice(1, 33)),
      y: b64uEncode(uaPublicRaw.slice(33, 65)),
      ext: true,
    },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // 3. ECDH shared secret. Cloudflare worker types alias 'public' as
  // '$public' — the runtime accepts either, but the type cast keeps tsc
  // happy.
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: "ECDH", public: uaPub } as any,
      asPair.privateKey,
      256,
    ),
  );

  // 4. RFC 8291: PRK_key = HKDF-Extract(salt=auth_secret, IKM=ecdh)
  const prkKey = await hkdfExtract(uaAuth, ecdh);

  // info = "WebPush: info" || 0x00 || ua_public || as_public
  const enc = new TextEncoder();
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublicRaw,
    asPubRaw,
  );
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // 5. RFC 8188: derive CEK + nonce from a fresh salt + IKM
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(
    prk,
    enc.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(
    prk,
    enc.encode("Content-Encoding: nonce\0"),
    12,
  );

  // 6. Pad: 0x02 + zeros (last record marker per RFC 8188)
  const padded = concat(payload, new Uint8Array([0x02]));

  // 7. AES-128-GCM encrypt
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      cekKey,
      padded,
    ),
  );

  // 8. Build header: salt(16) || record_size(4 BE) || idlen(1)=65 || keyid(65)
  const recordSize = 4096; // any value ≥ ciphertext length
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = 65;
  header.set(asPubRaw, 21);

  return concat(header, ct);
}

// ── Send a push to a single subscription ──────────────────────────
export async function sendPush(
  env: Env,
  sub: Sub,
  payload: string,
  opts?: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("VAPID_* secrets not set");
  }

  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(
    audience,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
    env.VAPID_SUBJECT,
  );

  const body = await encryptPayload(
    new TextEncoder().encode(payload),
    b64uDecode(sub.keys.p256dh),
    b64uDecode(sub.keys.auth),
  );

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      "content-length": body.length.toString(),
      ttl: String(opts?.ttl ?? 60 * 60 * 12),
      urgency: opts?.urgency ?? "normal",
    },
    body,
  });
  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  };
}
