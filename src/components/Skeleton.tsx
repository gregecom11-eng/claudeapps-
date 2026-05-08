// Loading skeleton primitive. Animated shimmer is via the @keyframes
// "shimmer" already in index.css (added below).

export function Skeleton({
  width,
  height = 14,
  radius = 6,
  className = "",
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`skeleton ${className}`}
      style={{
        display: "inline-block",
        width: width ?? "100%",
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function RideRowSkeleton() {
  return (
    <div className="surface rounded-[12px] p-4 flex items-center gap-3">
      <Skeleton width={36} height={36} radius={999} />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton width="40%" height={14} />
        <Skeleton width="70%" height={11} />
      </div>
      <Skeleton width={64} height={20} radius={999} />
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="surface rounded-[12px] p-4 md:p-5 space-y-2">
      <Skeleton width="40%" height={11} />
      <Skeleton width="55%" height={28} />
      <Skeleton width="75%" height={11} />
    </div>
  );
}
