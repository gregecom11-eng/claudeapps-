// Tiny global UI primitives:
//   - <Notify /> mounts a toast surface + confirm dialog at the root.
//   - useToast() returns a function to push a toast (success/error/info).
//   - useConfirm() returns an async fn replacing window.confirm() with a
//     properly styled modal.
//
// Mount <Notify /> ONCE in App. It owns the singleton state via a tiny
// event-bus pattern so every component can call useToast/useConfirm
// without a wrapping provider.

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

type ToastKind = "success" | "error" | "info";
type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};
type ConfirmOpts = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};
type ConfirmRequest = ConfirmOpts & {
  id: number;
  resolve: (ok: boolean) => void;
};

let nextToastId = 1;
let nextConfirmId = 1;
const toastListeners = new Set<(t: Toast) => void>();
const confirmListeners = new Set<(c: ConfirmRequest) => void>();

export function pushToast(kind: ToastKind, message: string): void {
  const t: Toast = { id: nextToastId++, kind, message };
  toastListeners.forEach((fn) => fn(t));
}
export function useToast(): {
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
} {
  return {
    success: (m) => pushToast("success", m),
    error: (m) => pushToast("error", m),
    info: (m) => pushToast("info", m),
  };
}

export function confirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const c: ConfirmRequest = { ...opts, id: nextConfirmId++, resolve };
    if (confirmListeners.size === 0) {
      // Fallback for SSR or if Notify isn't mounted: behave like window.confirm.
      const ok = typeof window !== "undefined" && window.confirm(opts.title);
      resolve(ok);
      return;
    }
    confirmListeners.forEach((fn) => fn(c));
  });
}
export function useConfirm(): (opts: ConfirmOpts) => Promise<boolean> {
  return confirm;
}

export function Notify() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    const onToast = (t: Toast) => {
      setToasts((curr) => [...curr, t]);
      window.setTimeout(() => {
        setToasts((curr) => curr.filter((x) => x.id !== t.id));
      }, 3200);
    };
    const onConfirm = (c: ConfirmRequest) => setPending(c);
    toastListeners.add(onToast);
    confirmListeners.add(onConfirm);
    return () => {
      toastListeners.delete(onToast);
      confirmListeners.delete(onConfirm);
    };
  }, []);

  const dismiss = (id: number) =>
    setToasts((curr) => curr.filter((x) => x.id !== id));

  const closeConfirm = (ok: boolean) => {
    if (pending) {
      pending.resolve(ok);
      setPending(null);
    }
  };

  return (
    <>
      {/* Toast stack — bottom-right on desktop, bottom-center on mobile,
          above the mobile tab bar */}
      <div
        aria-live="polite"
        className="fixed left-0 right-0 z-50 px-3 flex flex-col items-center md:items-end gap-2 pointer-events-none"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>

      {/* Confirm modal */}
      {pending ? (
        <ConfirmView req={pending} onClose={closeConfirm} />
      ) : null}
    </>
  );
}

function ToastView({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  const meta: Record<ToastKind, { icon: IconName; color: string }> = {
    success: { icon: "check", color: "var(--success)" },
    error: { icon: "x", color: "var(--danger)" },
    info: { icon: "info", color: "var(--accent)" },
  };
  const m = meta[toast.kind];
  return (
    <div
      className="surface rounded-[10px] shadow-pop pop-in flex items-center gap-3 px-4 py-3 max-w-[420px] pointer-events-auto"
      role="status"
      style={{ background: "var(--surface)" }}
    >
      <span style={{ color: m.color, display: "inline-flex" }}>
        <Icon name={m.icon} size={16} />
      </span>
      <span className="flex-1 min-w-0" style={{ fontSize: 13.5 }}>
        {toast.message}
      </span>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="text-muted hover:text-text shrink-0"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

function ConfirmView({
  req,
  onClose,
}: {
  req: ConfirmRequest;
  onClose: (ok: boolean) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "color-mix(in oklab, #000 50%, transparent)" }}
      onClick={() => onClose(false)}
    >
      <div
        className="surface rounded-t-[16px] md:rounded-[16px] w-full md:max-w-[440px]"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        <div className="px-5 pt-5 pb-2">
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {req.title}
          </h2>
          {req.body ? (
            <p
              className="text-muted mt-1.5"
              style={{ fontSize: 13.5, lineHeight: 1.5 }}
            >
              {req.body}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pt-3 pb-4">
          <button
            onClick={() => onClose(false)}
            className="inline-flex items-center justify-center h-10 px-4 rounded-[8px] text-[14px] font-medium"
            style={{
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            {req.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={() => onClose(true)}
            className="inline-flex items-center justify-center h-10 px-4 rounded-[8px] text-[14px] font-semibold"
            style={
              req.destructive
                ? {
                    background: "var(--danger)",
                    color: "#fff",
                    border: "1px solid var(--danger)",
                  }
                : {
                    background: "var(--accent)",
                    color: "#15161B",
                    border: "1px solid var(--accent-strong)",
                  }
            }
            autoFocus
          >
            {req.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
