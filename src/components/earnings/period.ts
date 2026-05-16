// Period boundaries for the Earnings page. All windows anchored to the
// business timezone (Los Angeles) so the rows shown match the calendar
// on the operator's wall, not the device's clock.

import { BUSINESS_TZ } from "../../lib/format";

export type PeriodId =
  | "today"
  | "week"
  | "month"
  | "p90d"
  | "ytd"
  | "p12m";

export type Period = {
  id: PeriodId;
  label: string;
  shortLabel: string; // for the chips
  from: Date;
  to: Date;
  // Same length, ending immediately before `from`. Used for compare-to.
  prevFrom: Date;
  prevTo: Date;
  // Y-o-Y window — same calendar span shifted back exactly 1 year.
  yoyFrom: Date;
  yoyTo: Date;
};

const PAD = (n: number, w: number) => String(n).padStart(w, "0");

function laOffsetFor(d: Date): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}

export function laCivil(d: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, dd] = parts.split("-").map((s) => parseInt(s, 10));
  return { year: y, month: m, day: dd };
}

export function laInstant(
  year: number,
  month: number,
  day: number,
  end = false,
): Date {
  const probe = new Date(
    `${PAD(year, 4)}-${PAD(month, 2)}-${PAD(day, 2)}T12:00:00Z`,
  );
  const offset = laOffsetFor(probe);
  const time = end ? "23:59:59.999" : "00:00:00.000";
  return new Date(
    `${PAD(year, 4)}-${PAD(month, 2)}-${PAD(day, 2)}T${time}${offset}`,
  );
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400_000);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function laDayKey(iso: string): string {
  const c = laCivil(new Date(iso));
  return `${PAD(c.year, 4)}-${PAD(c.month, 2)}-${PAD(c.day, 2)}`;
}

export function dayKeyOfDate(d: Date): string {
  const c = laCivil(d);
  return `${PAD(c.year, 4)}-${PAD(c.month, 2)}-${PAD(c.day, 2)}`;
}

export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const startCivil = laCivil(from);
  let cur = laInstant(startCivil.year, startCivil.month, startCivil.day);
  while (cur.getTime() <= to.getTime()) {
    out.push(dayKeyOfDate(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

// Mon=0..Sun=6
function laWeekdayMonZero(d: Date): number {
  const wkName = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return ((map[wkName] ?? 0) + 6) % 7;
}

// Same-length window ending immediately before `from`.
function previousSpan(from: Date, to: Date): { prevFrom: Date; prevTo: Date } {
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(from.getTime() - 1 - spanMs);
  return { prevFrom, prevTo };
}

// Same calendar window, shifted back exactly one year. Used for YoY.
function yoyOf(from: Date, to: Date): { yoyFrom: Date; yoyTo: Date } {
  const yf = laCivil(from);
  const yt = laCivil(to);
  return {
    yoyFrom: laInstant(yf.year - 1, yf.month, yf.day, false),
    yoyTo: laInstant(yt.year - 1, yt.month, yt.day, true),
  };
}

export function periodFor(id: PeriodId, now: Date = new Date()): Period {
  const c = laCivil(now);
  const startToday = laInstant(c.year, c.month, c.day, false);
  const endToday = laInstant(c.year, c.month, c.day, true);

  if (id === "today") {
    const p = previousSpan(startToday, endToday);
    const y = yoyOf(startToday, endToday);
    return {
      id,
      label: "Today",
      shortLabel: "Today",
      from: startToday,
      to: endToday,
      ...p,
      ...y,
    };
  }

  if (id === "week") {
    const daysSinceMon = laWeekdayMonZero(now);
    const monStart = new Date(
      startToday.getTime() - daysSinceMon * 86400_000,
    );
    const sunCivil = laCivil(new Date(monStart.getTime() + 6 * 86400_000));
    const from = monStart;
    const to = laInstant(sunCivil.year, sunCivil.month, sunCivil.day, true);
    const p = previousSpan(from, to);
    const y = yoyOf(from, to);
    return {
      id,
      label: "This week",
      shortLabel: "Week",
      from,
      to,
      ...p,
      ...y,
    };
  }

  if (id === "month") {
    const from = laInstant(c.year, c.month, 1);
    const lastDay = daysInMonth(c.year, c.month);
    const to = laInstant(c.year, c.month, lastDay, true);
    const p = previousSpan(from, to);
    const y = yoyOf(from, to);
    return {
      id,
      label: "This month",
      shortLabel: "Month",
      from,
      to,
      ...p,
      ...y,
    };
  }

  if (id === "p90d") {
    const from = new Date(startToday.getTime() - 89 * 86400_000);
    const to = endToday;
    const p = previousSpan(from, to);
    const y = yoyOf(from, to);
    return {
      id,
      label: "Last 90 days",
      shortLabel: "90d",
      from,
      to,
      ...p,
      ...y,
    };
  }

  if (id === "ytd") {
    const from = laInstant(c.year, 1, 1);
    const to = endToday;
    const p = previousSpan(from, to);
    const y = yoyOf(from, to);
    return {
      id,
      label: `${c.year} YTD`,
      shortLabel: "YTD",
      from,
      to,
      ...p,
      ...y,
    };
  }

  // p12m
  const from = new Date(startToday.getTime() - 364 * 86400_000);
  const to = endToday;
  const p = previousSpan(from, to);
  const y = yoyOf(from, to);
  return {
    id,
    label: "Last 12 months",
    shortLabel: "12m",
    from,
    to,
    ...p,
    ...y,
  };
}
