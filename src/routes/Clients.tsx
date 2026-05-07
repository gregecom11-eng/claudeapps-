import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateInviteLink,
  listClients,
  listRides,
} from "../lib/api";
import { fmtDate, fmtMoney } from "../lib/format";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import type { Client, Ride } from "../lib/types";

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ client: Client; link: string } | null>(
    null,
  );

  useEffect(() => {
    Promise.all([listClients(), listRides({ limit: 500 })])
      .then(([c, r]) => {
        setClients(c);
        setRides(r);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      );
  }, []);

  const ridesByClient = useMemo(() => {
    const m = new Map<string, Ride[]>();
    for (const r of rides) {
      if (!r.client_id) continue;
      m.set(r.client_id, [...(m.get(r.client_id) ?? []), r]);
    }
    return m;
  }, [rides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [clients, query]);

  const onInvite = async (c: Client) => {
    if (!c.email) return;
    try {
      const { action_link } = await generateInviteLink(c.email);
      setInvite({ client: c, link: action_link });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div
            className="text-muted"
            style={{
              fontSize: 12.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Directory
          </div>
          <h1
            className="mt-1"
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Clients
          </h1>
          <p
            className="text-muted mt-1"
            style={{ fontSize: 13.5 }}
          >
            Manage details under{" "}
            <Link to="/settings" className="text-accent">
              Settings
            </Link>
            . Send portal access here.
          </p>
        </div>
      </div>

      <div className="surface rounded-[12px] p-3">
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            style={{ pointerEvents: "none" }}
          >
            <Icon name="search" size={14} />
          </span>
          <input
            className="field field-prefixed"
            placeholder="Search by name, company, email, or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="surface rounded-[12px] p-4 text-danger text-sm">
          {error}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="surface rounded-[12px] p-8 text-center text-muted text-sm">
          {query ? "No matches." : "No clients yet."}
        </div>
      ) : (
        <ul className="surface rounded-[12px] divide-y divide-border">
          {filtered.map((c) => {
            const list = ridesByClient.get(c.id) ?? [];
            const lifetime = list
              .filter((r) => r.status !== "cancelled")
              .reduce((s, r) => s + r.total_cents, 0);
            const last = list
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.pickup_at).getTime() -
                  new Date(a.pickup_at).getTime(),
              )[0];
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar name={c.name} size={36} />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {c.name}
                    {c.profile_id ? (
                      <span
                        className="ml-2 chip"
                        style={{
                          background: "transparent",
                          color: "var(--success)",
                          fontSize: 10.5,
                          borderColor:
                            "color-mix(in oklab, var(--success) 35%, var(--border))",
                        }}
                      >
                        <Icon name="check" size={10} /> Linked
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="text-muted truncate tabular"
                    style={{ fontSize: 12 }}
                  >
                    {c.company ? c.company : "Private"}
                    {c.phone ? ` · ${c.phone}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                  </div>
                </div>
                <div className="hidden sm:block text-right">
                  <div
                    className="tabular"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    {fmtMoney(lifetime)}
                  </div>
                  <div
                    className="text-muted tabular"
                    style={{ fontSize: 11 }}
                  >
                    {list.length} {list.length === 1 ? "ride" : "rides"}
                    {last ? ` · last ${fmtDate(last.pickup_at)}` : ""}
                  </div>
                </div>
                {c.email ? (
                  <button
                    onClick={() => onInvite(c)}
                    title="Send portal sign-in link"
                    aria-label="Invite to portal"
                    className="inline-grid place-items-center"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Icon name="phone" size={13} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {invite ? (
        <InviteLinkModal
          name={invite.client.name}
          email={invite.client.email ?? ""}
          phone={invite.client.phone ?? ""}
          link={invite.link}
          onClose={() => setInvite(null)}
        />
      ) : null}
    </div>
  );
}

/* Reused share-link modal — owner copies + sends via SMS / WhatsApp */
function InviteLinkModal({
  name,
  email,
  phone,
  link,
  onClose,
}: {
  name: string;
  email: string;
  phone: string;
  link: string;
  onClose: () => void;
}) {
  const first = name.split(/\s+/)[0].replace(/[(),]/g, "");
  const body = `Hi ${first}, here's your SDLuxury account sign-in link. ${link}`;
  const sms = phone
    ? `sms:${phone}?body=${encodeURIComponent(body)}`
    : null;
  const wa = phone
    ? `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(body)}`
    : null;
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <div
      className="fixed inset-0 z-40 flex items-end md:items-center justify-center"
      style={{ background: "color-mix(in oklab, #000 50%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="surface rounded-t-[16px] md:rounded-[16px] w-full md:max-w-[520px]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div
          className="px-5 pt-4 pb-3 flex items-start justify-between gap-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="min-w-0">
            <div className="text-muted" style={{ fontSize: 12.5 }}>
              Portal sign-in link for
            </div>
            <h2
              className="truncate"
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {name}
            </h2>
            <div
              className="text-muted truncate"
              style={{ fontSize: 12 }}
            >
              {email}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-grid place-items-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div
            className="rounded-[8px] px-3 py-2 mono"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: 12,
              wordBreak: "break-all",
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            {link}
          </div>
          <p
            className="text-muted"
            style={{ fontSize: 12.5, lineHeight: 1.5 }}
          >
            Single-use, expires in ~1 hour. Share via SMS or any channel
            you prefer.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={onCopy}
              className="inline-flex items-center justify-center gap-2 h-10 rounded-[8px] text-[14px] font-semibold"
              style={{
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
              }}
            >
              <Icon name={copied ? "check" : "copy"} size={14} />
              {copied ? "Copied" : "Copy link"}
            </button>
            {sms ? (
              <a
                href={sms}
                className="inline-flex items-center justify-center gap-2 h-10 rounded-[8px] text-[14px] font-medium"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="phone" size={14} /> Send via SMS
              </a>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 h-10 rounded-[8px] text-[14px] font-medium sm:col-span-2"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="phone" size={14} /> Send via WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
