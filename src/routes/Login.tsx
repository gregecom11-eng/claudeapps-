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
      setError("Enter the 6-digit code from your email.");
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
    // On success the AuthProvider session changes, gating us into the app.
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
    <main className="min-h-full flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-2xl font-semibold tracking-tight">
            SDLuxury Ops
          </div>
          <div className="text-sm text-muted">
            {step === "email"
              ? "Enter your email — we'll send you a 6-digit code."
              : "Enter the 6-digit code we just emailed you."}
          </div>
        </div>

        {!configured ? (
          <div className="card text-sm text-danger">
            Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>.
          </div>
        ) : step === "email" ? (
          <form onSubmit={sendCode} className="card space-y-3">
            <label className="block text-sm space-y-1">
              <span className="text-muted">Email</span>
              <input
                type="email"
                required
                autoFocus
                inputMode="email"
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error ? (
              <div className="text-sm text-danger">{error}</div>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="card space-y-3">
            <div
              className="text-muted small text-center"
              style={{ fontSize: 12.5, lineHeight: 1.5 }}
            >
              Sent to <span className="text-text">{email}</span>. Enter
              the 6-digit code below — works the same as the link, and
              keeps you signed in to this app.
            </div>
            <label className="block text-sm space-y-1">
              <span className="text-muted">Code</span>
              <input
                ref={codeInputRef}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="input tabular tracking-[0.4em] text-center"
                style={{ fontSize: 22, fontWeight: 600 }}
                placeholder="000000"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </label>
            {error ? (
              <div className="text-sm text-danger">{error}</div>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={status === "verifying" || code.length < 6}
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
          style={{ fontSize: 11.5, lineHeight: 1.5 }}
        >
          Tip: if you installed SDLuxury to your home screen, sign in
          here with the code rather than tapping the link in your email.
          The code keeps you signed in inside the installed app.
        </p>
      </div>
    </main>
  );
}
