// Client portal · Account tab.
// Profile + notification preferences + accessibility + dispatch contact +
// sign out.

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getOrgSettings } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useBigText } from "../lib/useBigText";
import { useTheme } from "../lib/useTheme";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { NotificationPrefs } from "../components/NotificationPrefs";
import { PushToggle } from "../components/PushToggle";
import type { ClientShellCtx } from "../components/ClientShell";

export function ClientAccount() {
  const { client } = useOutletContext<ClientShellCtx>();
  const { session, signOut } = useAuth();
  const [bigText, setBigText] = useBigText();
  const [theme, setTheme] = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const [dispatchPhone, setDispatchPhone] = useState<string | null>(null);
  const [dispatchEmail, setDispatchEmail] = useState<string | null>(null);

  useEffect(() => {
    getOrgSettings()
      .then((s) => {
        setDispatchPhone(s.dispatch_phone ?? null);
        setDispatchEmail(s.dispatch_email ?? null);
      })
      .catch(() => {
        /* not fatal */
      });
  }, []);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };

  const email = session?.user?.email ?? "";

  return (
    <div className="space-y-7 fade-up">
      <div>
        <p className="eyebrow mb-3">Account</p>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(30px, 4.5vw, 40px)",
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          Your details
        </h1>
      </div>

      {/* Profile card */}
      <section
        className="rounded-[14px] p-5 flex items-center gap-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Avatar name={client.name} size={52} shape="rounded" />
        <div className="flex-1 min-w-0">
          <div
            className="serif"
            style={{
              fontSize: 22,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {client.name}
          </div>
          {email ? (
            <div
              className="text-muted truncate"
              style={{ fontSize: 13, marginTop: 2 }}
            >
              {email}
            </div>
          ) : null}
          {client.company || client.default_billing ? (
            <div
              className="text-muted mt-2 flex items-center gap-1.5 flex-wrap"
              style={{ fontSize: 12 }}
            >
              {client.company ? (
                <span
                  className="chip"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontWeight: 500,
                  }}
                >
                  {client.company}
                </span>
              ) : null}
              {client.default_billing ? (
                <span
                  className="chip"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  {prettyBilling(client.default_billing)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* Notifications */}
      <section>
        <p className="eyebrow mb-3">Notifications</p>
        <div className="space-y-3">
          <PushToggle hint="Get a ping when your chauffeur is on the way and when they arrive." />
          <div
            className="rounded-[14px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              className="px-4 pt-3 pb-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="eyebrow">Preferences</div>
              <div
                style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}
              >
                Notification settings
              </div>
            </div>
            <NotificationPrefs role="client" flash={flash} />
          </div>
          {toast ? (
            <div className="text-success text-sm" style={{ paddingLeft: 4 }}>
              {toast}
            </div>
          ) : null}
        </div>
      </section>

      {/* Display */}
      <section>
        <p className="eyebrow mb-3">Display</p>
        <div className="space-y-2.5">
          <ToggleRow
            label="Dark theme"
            description="Champagne on warm black."
            on={theme === "dark"}
            onToggle={(v) => setTheme(v ? "dark" : "light")}
          />
          <ToggleRow
            label="Large text"
            description="Bumps body text 12.5% for easier reading."
            on={bigText}
            onToggle={setBigText}
          />
        </div>
      </section>

      {/* Help */}
      <section>
        <p className="eyebrow mb-3">Need help?</p>
        <div
          className="rounded-[14px] p-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="serif"
            style={{
              fontSize: 18,
              fontStyle: "italic",
              letterSpacing: "-0.005em",
              lineHeight: 1.4,
            }}
          >
            Anything else, just text. — Sergio
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {dispatchPhone ? (
              <a
                href={`tel:${dispatchPhone.replace(/[^\d+]/g, "")}`}
                className="rounded-[10px] h-11 inline-flex items-center justify-center gap-2 text-[14px] font-semibold"
                style={{
                  background: "var(--accent)",
                  color: "#15161B",
                  border: "1px solid var(--accent-strong)",
                }}
              >
                <Icon name="phone" size={14} /> Call Sergio
              </a>
            ) : null}
            {dispatchPhone ? (
              <a
                href={`sms:${dispatchPhone.replace(/[^\d+]/g, "")}`}
                className="rounded-[10px] h-11 inline-flex items-center justify-center gap-2 text-[14px] font-medium"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="note" size={14} /> Text Sergio
              </a>
            ) : null}
            {dispatchEmail && !dispatchPhone ? (
              <a
                href={`mailto:${dispatchEmail}`}
                className="rounded-[10px] h-11 inline-flex items-center justify-center gap-2 text-[14px] font-medium sm:col-span-2"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="info" size={14} /> Email dispatch
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Sign out */}
      <section>
        <button
          onClick={signOut}
          className="w-full h-12 rounded-[12px] inline-flex items-center justify-center gap-2 text-[14px] font-medium"
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <Icon name="back" size={13} /> Sign out
        </button>
      </section>

      <div className="text-center text-muted pt-2" style={{ fontSize: 11.5 }}>
        SDLuxury Transportation, Inc.
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  on,
  onToggle,
}: {
  label: string;
  description: string;
  on: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!on)}
      className="w-full rounded-[12px] p-4 flex items-center gap-3 text-left transition active:scale-[0.99]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div
          className="text-muted"
          style={{ fontSize: 12, lineHeight: 1.5, marginTop: 1 }}
        >
          {description}
        </div>
      </div>
      <span
        aria-hidden
        className="shrink-0"
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          background: on ? "var(--accent)" : "var(--surface-2)",
          border: `1px solid ${on ? "var(--accent-strong)" : "var(--border)"}`,
          position: "relative",
          transition: "background 140ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: on ? "#15161B" : "var(--text-muted)",
            transition: "left 140ms",
          }}
        />
      </span>
    </button>
  );
}

function prettyBilling(b: string): string {
  switch (b) {
    case "net_15":
      return "Net 15";
    case "net_30":
    case "net30":
      return "Net 30";
    case "company_billing":
      return "Company-billed";
    case "affiliate":
      return "Affiliate";
    case "invoice":
      return "Invoiced";
    case "card":
      return "Card on file";
    case "cash":
      return "Cash";
    case "zelle":
      return "Zelle";
    default:
      return b;
  }
}
