// Decision-support panel. Pulls patterns out of the current window's
// data: client concentration, AR aging, growth vs prior period, driver
// gaps. All algorithmic — no synthetic copy, so the rules either fire
// from real data or they don't show up at all.

import { Icon } from "../Icon";
import { fmtMoney } from "../../lib/format";
import type { TopClientRow } from "./TopClients";
import type { AgingBucket } from "./ARAging";

export type InsightTone = "good" | "warn" | "bad" | "neutral";

export type Insight = {
  tone: InsightTone;
  title: string;
  body: string;
};

export type InsightInputs = {
  myIncomeCents: number;
  fleetRevenueCents: number;
  myIncomeDelta: number | null;
  netProfitCents: number;
  totalExpensesCents: number;
  topClients: TopClientRow[];
  agingBuckets: AgingBucket[];
  hasCommissionConfigured: boolean;
  ownerDriverPresent: boolean;
  hasAnyExpenses: boolean;
  periodLabel: string;
};

export function buildInsights(input: InsightInputs): Insight[] {
  const list: Insight[] = [];

  // 1) Setup nudge — only one of these shows
  if (!input.ownerDriverPresent) {
    list.push({
      tone: "neutral",
      title: "No owner-driver flagged yet",
      body: "Open Settings → Drivers and mark one row as the owner so \"My income\" can separate from fleet revenue.",
    });
  } else if (
    !input.hasCommissionConfigured &&
    input.fleetRevenueCents > input.myIncomeCents * 1.05
  ) {
    const gap = input.fleetRevenueCents - input.myIncomeCents;
    list.push({
      tone: "neutral",
      title: `${fmtMoney(gap)} of fleet revenue isn't reaching your income`,
      body: "Your driver commission rates are still 0%. Set per-driver rates in Settings → Drivers to start splitting that revenue automatically.",
    });
  }

  // 2) Concentration risk
  if (input.topClients.length > 0 && input.fleetRevenueCents > 0) {
    const top = input.topClients[0];
    const share = top.bookedCents / input.fleetRevenueCents;
    if (share >= 0.25) {
      list.push({
        tone: "warn",
        title: `${top.name} is ${Math.round(share * 100)}% of revenue`,
        body: `Losing them would shrink ${input.periodLabel.toLowerCase()} by ~${fmtMoney(top.bookedCents)}. A second corporate account at half their volume would halve the risk.`,
      });
    }
  }

  // 3) Late AR
  const lateTotal = input.agingBuckets
    .filter((b) => b.key === "late2" || b.key === "late3")
    .reduce((s, b) => s + b.totalCents, 0);
  if (lateTotal >= 200_000) {
    list.push({
      tone: "bad",
      title: `${fmtMoney(lateTotal)} is over 30 days late`,
      body: "Send a polite second reminder on the oldest invoices; if no response in 7 days, escalate to phone.",
    });
  }

  // 4) Growth
  if (input.myIncomeDelta !== null && Math.abs(input.myIncomeDelta) >= 0.05) {
    const up = input.myIncomeDelta > 0;
    list.push({
      tone: up ? "good" : "warn",
      title: up
        ? `You're up ${(input.myIncomeDelta * 100).toFixed(1)}% vs the prior period`
        : `You're down ${Math.abs(input.myIncomeDelta * 100).toFixed(1)}% vs the prior period`,
      body: up
        ? "Margin trend is healthy. Keep an eye on whether the gain is volume or pricing — both, ideally."
        : "Check whether you've lost a recurring booker or shifted into lower-margin trips. The clients table can confirm.",
    });
  }

  // 4b) Profit margin call-out
  if (input.hasAnyExpenses && input.myIncomeCents > 0) {
    const margin = input.netProfitCents / input.myIncomeCents;
    if (margin < 0) {
      list.push({
        tone: "bad",
        title: `Net loss of ${fmtMoney(Math.abs(input.netProfitCents))} this period`,
        body: `Your costs (${fmtMoney(input.totalExpensesCents)}) exceeded your income (${fmtMoney(input.myIncomeCents)}). Check the per-ride costs and fixed-expense allocation for outliers.`,
      });
    } else if (margin < 0.3) {
      list.push({
        tone: "warn",
        title: `Margin is ${Math.round(margin * 100)}% — tighter than usual`,
        body: `${fmtMoney(input.totalExpensesCents)} of your ${fmtMoney(input.myIncomeCents)} income went to costs. Where's the room to cut: per-ride variables, fixed, or maintenance?`,
      });
    } else if (margin > 0.55) {
      list.push({
        tone: "good",
        title: `Strong margin: ${Math.round(margin * 100)}% net`,
        body: `${fmtMoney(input.netProfitCents)} of your ${fmtMoney(input.myIncomeCents)} income is keepable profit. Whatever you're doing on cost control is working.`,
      });
    }
  } else if (!input.hasAnyExpenses && input.myIncomeCents > 0) {
    list.push({
      tone: "neutral",
      title: "Net profit is unknown — no expenses tracked yet",
      body: "Open /expenses and log fixed costs (insurance, lease) plus per-ride gas. Net profit will start showing alongside income.",
    });
  }

  // 5) Quiet week (no insights yet)
  if (list.length === 0) {
    list.push({
      tone: "neutral",
      title: "Nothing stands out yet",
      body: "As more rides land, Heartbeat will surface concentration, growth, and AR risks in this panel.",
    });
  }

  return list;
}

export function EarningsInsights({ insights }: { insights: Insight[] }) {
  return (
    <div
      className="rounded-[6px] p-5 md:p-6 fade-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow" style={{ letterSpacing: "0.22em" }}>
            Decision support
          </p>
          <h3
            className="serif mt-1"
            style={{
              fontSize: 22,
              letterSpacing: "-0.005em",
              lineHeight: 1.1,
            }}
          >
            What the numbers are{" "}
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>
              saying
            </span>
          </h3>
          <p
            className="text-muted mt-1.5"
            style={{ fontSize: 12.5 }}
          >
            Patterns pulled from real ride data in this window.
          </p>
        </div>
        <Icon name="spark" size={18} className="text-accent" />
      </div>

      <div className="flex flex-col gap-3 mt-5">
        {insights.map((ins, i) => {
          const tint =
            ins.tone === "good"
              ? "var(--success)"
              : ins.tone === "warn"
                ? "var(--warn)"
                : ins.tone === "bad"
                  ? "var(--danger)"
                  : "var(--accent)";
          const bg = `color-mix(in oklab, ${tint} 6%, var(--surface))`;
          return (
            <div
              key={i}
              className="rounded-[3px]"
              style={{
                background: bg,
                borderLeft: `2px solid ${tint}`,
                padding: "12px 16px",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0"
                  style={{ color: tint, marginTop: 2 }}
                >
                  <Icon
                    name={
                      ins.tone === "good"
                        ? "spark"
                        : ins.tone === "warn" || ins.tone === "bad"
                          ? "info"
                          : "note"
                    }
                    size={14}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {ins.title}
                  </div>
                  <div
                    className="text-muted mt-1"
                    style={{ fontSize: 13, lineHeight: 1.5 }}
                  >
                    {ins.body}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
