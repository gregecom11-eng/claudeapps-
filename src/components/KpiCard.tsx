type Props = {
  label: string;
  value: number | string;
  hint?: string;
};

export function KpiCard({ label, value, hint }: Props) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </div>
  );
}
