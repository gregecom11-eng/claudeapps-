import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/Icon";

type Step = "email" | "code";

export function Login() {
  const { signInWithEmail, verifyEmailCode, configured } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "verifying" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step === "code") {
      codeInputRef.current?.focus();
    }
  }, [step]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);
    const { error: err } = await signInWithEmail(email);
    if (err) {
      setStatus("error");
      setError(err);
    } else {
      setStatus("sent");
      setStep("code");
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length < 6) {
      setError("Enter the code from your email (6 to 8 digits).");
      return;
    }
    setStatus("verifying");
    setError(null);
    const { error: err } = await verifyEmailCode(email, cleaned);
    if (err) {
      setStatus("error");
      setError(
        err.toLowerCase().includes("expired") || err.includes("invalid")
          ? "That code didn't work. Check the digits or send a new one."
          : err,
      );
    }
  };

  const resend = async () => {
    setStatus("sending");
    setError(null);
    const { error: err } = await signInWithEmail(email);
    if (err) {
      setStatus("error");
      setError(err);
    } else {
      setStatus("sent");
      setCode("");
    }
  };

  return (
    <main
      className="min-h-full flex items-center justify-center px-6 py-10"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 65%), var(--bg)",
      }}
    >
      <div className="w-full max-w-sm space-y-8 fade-up">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div
            aria-hidden
            className="mx-auto grid place-items-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--accent) 24%, var(--surface)), var(--surface))",
              border: "1px solid color-mix(in oklab, var(--accent) 28%, var(--border))",
              color: "var(--accent)",
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: "-0.01em",
            }}
          >
            SD
          </div>
          <div>
            <div
              className="serif"
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              SDLuxury
            </div>
            <div className="eyebrow mt-1.5">Chauffeur portal</div>
          </div>
          <div
            className="text-muted"
            style={{ fontSize: 14, lineHeight: 1.55, maxWidth: 280, margin: "0 auto" }}
          >
            {step === "email"
              ? "Sign in with your email — we'll send you a one-time code."
              : "Enter the six-digit code we just emailed you."}
          </div>
        </div>

        {!configured ? (
          <div
            className="rounded-[14px] p-4"
            style={{
              background: "color-mix(in oklab, var(--danger) 12%, var(--surface))",
              border: "1px solid color-mix(in oklab, var(--danger) 30%, var(--border))",
              color: "var(--danger)",
              fontSize: 13,
            }}
          >
            Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>.
          </div>
        ) : step === "email" ? (
          <form
            onSubmit={sendCode}
            className="surface-elev rounded-[18px] p-6 space-y-4"
          >
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                autoFocus
                inputMode="email"
                autoComplete="email"
                className="field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error ? (
              <div className="text-danger" style={{ fontSize: 13 }}>
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-60"
              style={{
                height: 54,
                fontSize: 15.5,
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
                boxShadow:
                  "0 8px 22px color-mix(in oklab, var(--accent) 32%, transparent)",
              }}
            >
              {status === "sending" ? "Sending…" : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={verify}
            className="surface-elev rounded-[18px] p-6 space-y-4"
          >
            <div
              className="text-muted text-center"
              style={{ fontSize: 13, lineHeight: 1.55 }}
            >
              Sent to{" "}
              <span style={{ color: "var(--text)", fontWeight: 500 }}>
                {email}
              </span>
              . The code keeps you signed in inside the installed app.
            </div>
            <div>
              <label className="label">One-time code</label>
              <input
                ref={codeInputRef}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={8}
                required
                className="field tnum text-center"
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: "0.4em",
                  height: 60,
                }}
                placeholder="••••••"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
              />
            </div>
            {error ? (
              <div className="text-danger" style={{ fontSize: 13 }}>
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={status === "verifying" || code.length < 6}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-60"
              style={{
                height: 54,
                fontSize: 15.5,
                background: "var(--accent)",
                color: "#15161B",
                border: "1px solid var(--accent-strong)",
                boxShadow:
                  "0 8px 22px color-mix(in oklab, var(--accent) 32%, transparent)",
              }}
            >
              {status === "verifying" ? "Verifying…" : "Sign in"}
            </button>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="text-muted hover:text-text inline-flex items-center gap-1"
                style={{ fontSize: 12.5 }}
              >
                <Icon name="back" size={12} /> Wrong email
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={status === "sending"}
                className="text-accent inline-flex items-center gap-1"
                style={{ fontSize: 12.5, fontWeight: 500 }}
              >
                {status === "sending" ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p
          className="text-muted text-center"
          style={{ fontSize: 11.5, lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}
        >
          If you installed SDLuxury to your home screen, sign in with the
          code rather than tapping the link in your email — it keeps you
          signed in inside the installed app.
        </p>
      </div>
    </main>
  );
}
