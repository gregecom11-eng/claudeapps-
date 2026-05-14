import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/Icon";

type Step = "email" | "code";

export function Login() {
  const { signInWithEmail, verifyEmailCode, signInWithGoogle, configured } =
    useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "verifying" | "error"
  >("idle");
  const [googleStatus, setGoogleStatus] = useState<"idle" | "redirecting">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const continueWithGoogle = async () => {
    setError(null);
    setGoogleStatus("redirecting");
    const { error: err } = await signInWithGoogle();
    if (err) {
      setGoogleStatus("idle");
      setError(err);
    }
    // On success the browser redirects to Google — no further UI work.
  };

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
            <div className="eyebrow mt-1.5">Sign in</div>
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
          <div className="space-y-4">
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={googleStatus === "redirecting"}
              className="w-full inline-flex items-center justify-center gap-3 rounded-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-60"
              style={{
                height: 54,
                fontSize: 15,
                background: "#FFFFFF",
                color: "#1F1F1F",
                border: "1px solid #DADCE0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              <GoogleMark />
              {googleStatus === "redirecting"
                ? "Redirecting…"
                : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3 text-muted">
              <span
                className="flex-1 h-px"
                style={{ background: "var(--border)" }}
              />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                or email
              </span>
              <span
                className="flex-1 h-px"
                style={{ background: "var(--border)" }}
              />
            </div>

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
          </div>
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

function GoogleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.96H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.04l3.007-2.333Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
