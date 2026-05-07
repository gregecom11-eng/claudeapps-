import { Icon, type IconName } from "./Icon";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  prefix?: string;
  suffix?: string;
  icon?: IconName;
  accent?: boolean;
};

export function KpiCard({
  label,
  value,
  hint,
  prefix,
  suffix,
  icon,
  accent,
}: Props) {
  return (
    <div
      className="surface rounded-[12px] p-4 md:p-5 shadow-card relative overflow-hidden"
      style={{ minHeight: 112 }}
    >
      <div className="flex items-start justify-between">
        <div
          className="text-muted"
          style={{
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        {icon ? (
          <div className="text-muted opacity-70">
            <Icon name={icon} size={15} />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        {prefix ? (
          <span
            className="tnum"
            style={{ color: "var(--text-muted)", fontSize: 18, fontWeight: 500 }}
          >
            {prefix}
          </span>
        ) : null}
        <span
          className="tnum"
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: accent ? "var(--accent)" : "var(--text)",
            lineHeight: 1.05,
          }}
        >
          {value}
        </span>
        {suffix ? (
          <span
            className="text-muted tnum"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-2 text-muted truncate" style={{ fontSize: 12.5 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
