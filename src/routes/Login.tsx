import { useState } from "react";
import { useAuth } from "../lib/auth";

export function Login() {
  const { signInWithEmail, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);
    const { error } = await signInWithEmail(email);
    if (error) {
      setStatus("error");
      setError(error);
    } else {
      setStatus("sent");
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
            Sign in with a magic link sent to your email.
          </div>
        </div>

        {!configured ? (
          <div className="card text-sm text-danger">
            Supabase not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in Cloudflare Pages env.
          </div>
        ) : status === "sent" ? (
          <div className="card text-sm">
            Check <span className="font-medium">{email}</span> for a sign-in
            link. You can close this tab.
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-3">
            <label className="block text-sm space-y-1">
              <span className="text-muted">Email</span>
              <input
                type="email"
                required
                autoFocus
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
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
