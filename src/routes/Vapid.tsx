// Public /vapid page — generates a VAPID keypair entirely in the user's
// browser using Web Crypto. The private key never leaves their device
// until they paste it into Cloudflare. No auth required, so this works
// even if the dashboard's owner-role checks are misconfigured.

import { useState } from "react";
import { Icon } from "../components/Icon";

function b64uEncode(bytes: Uint8Array | ArrayBuffer): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uDecode(s: string): Uint8Array {
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

async function generate(): Promise<{
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
  const x = b64uDecode(pubJwk.x!);
  const y = b64uDecode(pubJwk.y!);
  return {
    publicKey: b64uEncode(concat(new Uint8Array([0x04]), x, y)),
    privateKey: privJwk.d!,
  };
}

export function Vapid() {
  const [keys, setKeys] = useState<{
    publicKey: string;
    privateKey: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const k = await generate();
      setKeys(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate keys");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  const subject = email.includes("@") ? `mailto:${email.trim()}` : "";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      <header
        className="px-5 md:px-8 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto max-w-[760px] flex items-center gap-2.5">
          <div
            aria-hidden
            className="grid place-items-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--accent)",
            }}
          >
            SD
          </div>
          <span
            className="serif"
            style={{ fontSize: 20, letterSpacing: "-0.01em" }}
          >
            SDLuxury
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[760px] px-5 md:px-8 py-8 md:py-12 space-y-6">
        <div>
          <p className="eyebrow mb-3">Push notifications setup</p>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(28px, 4.5vw, 40px)",
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
            }}
          >
            Generate VAPID keys
          </h1>
          <p
            className="text-muted mt-3"
            style={{ fontSize: 14.5, lineHeight: 1.6, maxWidth: 560 }}
          >
            One-time setup. Your browser generates a keypair on this
            page — the private key never leaves your computer. Paste
            the resulting values into Cloudflare and push notifications
            light up for everyone.
          </p>
        </div>

        {!keys ? (
          <div className="surface rounded-[12px] p-5 space-y-4">
            <label className="block">
              <span className="label">Your contact email</span>
              <input
                className="field"
                type="email"
                placeholder="sergio@sdluxurytransportation.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="help">
                Push services use this to reach you about delivery
                issues. Required.
              </div>
            </label>
            <button
              onClick={onGenerate}
              disabled={busy || !email.includes("@")}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[8px] text-[14px] font-semibold disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              {busy ? "Generating…" : "Generate keys in this browser"}
            </button>
            {error ? (
              <div className="text-danger" style={{ fontSize: 13 }}>
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className="rounded-[10px] px-4 py-3"
              style={{
                background:
                  "color-mix(in oklab, var(--warn) 12%, var(--surface))",
                border:
                  "1px solid color-mix(in oklab, var(--warn) 35%, var(--border))",
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              <strong>
                Don't close this page until all three values are in
                Cloudflare.
              </strong>{" "}
              The keys are not stored — close the tab and they're gone,
              and any device already subscribed will need to resubscribe.
            </div>

            <KeyRow
              name="VAPID_PUBLIC_KEY"
              value={keys.publicKey}
              hint="Server identity. Also embedded in the browser bundle."
              copied={copied === "VAPID_PUBLIC_KEY"}
              onCopy={() => copy("VAPID_PUBLIC_KEY", keys.publicKey)}
            />
            <KeyRow
              name="VAPID_PRIVATE_KEY"
              value={keys.privateKey}
              hint="Treat like a password. Server-only."
              copied={copied === "VAPID_PRIVATE_KEY"}
              onCopy={() => copy("VAPID_PRIVATE_KEY", keys.privateKey)}
            />
            <KeyRow
              name="VAPID_SUBJECT"
              value={subject}
              hint="Your contact email, prefixed with mailto:."
              copied={copied === "VAPID_SUBJECT"}
              onCopy={() => copy("VAPID_SUBJECT", subject)}
            />

            <div className="surface rounded-[12px] p-5 space-y-2">
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                Where to paste these
              </div>
              <ol
                className="text-muted space-y-1.5 list-decimal list-inside"
                style={{ fontSize: 13.5, lineHeight: 1.55 }}
              >
                <li>
                  Open{" "}
                  <a
                    href="https://dash.cloudflare.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent"
                  >
                    Cloudflare dashboard
                  </a>{" "}
                  → Workers &amp; Pages → claudeapps-1.
                </li>
                <li>Settings → Variables and Secrets → Add.</li>
                <li>
                  For each row above: <strong>Type: Secret</strong>,
                  paste the variable name and value, save.
                </li>
                <li>
                  Cloudflare auto-redeploys after each save (~30 sec).
                  Once all three are in, push is live.
                </li>
              </ol>
            </div>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Discard these keys and start over? You'll need to paste any saved values into Cloudflare BEFORE doing this if you want push to work.",
                  )
                ) {
                  setKeys(null);
                  setCopied(null);
                }
              }}
              className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px]"
              style={{
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              Generate a different set of keys
            </button>
          </div>
        )}
      </main>

      <footer
        className="text-muted text-center py-5"
        style={{ fontSize: 11.5, borderTop: "1px solid var(--border)" }}
      >
        SDLuxury Transportation, Inc.
      </footer>
    </div>
  );
}

function KeyRow({
  name,
  value,
  hint,
  copied,
  onCopy,
}: {
  name: string;
  value: string;
  hint: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="surface rounded-[12px] p-5">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <code
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            background: "var(--surface-2)",
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          {name}
        </code>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] text-[13px] font-semibold"
          style={{
            background: copied
              ? "color-mix(in oklab, var(--success) 14%, transparent)"
              : "var(--accent)",
            color: copied ? "var(--success)" : "#15161B",
            border: copied
              ? "1px solid color-mix(in oklab, var(--success) 40%, var(--border))"
              : "1px solid var(--accent-strong)",
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={13} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className="rounded-[8px] px-3 py-2 mono"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          fontSize: 11.5,
          wordBreak: "break-all",
          maxHeight: 100,
          overflowY: "auto",
        }}
      >
        {value}
      </div>
      <div
        className="text-muted mt-1.5"
        style={{ fontSize: 11.5 }}
      >
        {hint}
      </div>
    </div>
  );
}
