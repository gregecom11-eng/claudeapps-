export const fmtMoney = (cents: number): string =>
  (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const fmtDateTime = (iso: string): string =>
  `${fmtDate(iso)} · ${fmtTime(iso)}`;

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function dollarsToCents(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
