import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  full?: boolean;
};

const STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#15161B",
    border: "1px solid var(--accent-strong)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--border)",
  },
  quiet: {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
};

const SIZES: Record<Size, { height: number; px: number; font: number; icon: number; radius: number }> = {
  sm: { height: 36, px: 14, font: 13, icon: 14, radius: 10 },
  md: { height: 44, px: 16, font: 14, icon: 15, radius: 12 },
  lg: { height: 52, px: 20, font: 15, icon: 16, radius: 14 },
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  full,
  className = "",
  children,
  style,
  ...rest
}: ButtonProps) {
  const s = SIZES[size];
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition select-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]";
  return (
    <button
      className={`${base} ${full ? "w-full" : ""} ${className}`}
      style={{
        height: s.height,
        paddingLeft: s.px,
        paddingRight: s.px,
        fontSize: s.font,
        borderRadius: s.radius,
        ...STYLES[variant],
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={s.icon} /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name: IconName;
  label: string;
  size?: Size;
};

export function IconButton({ name, label, size = "md", className = "", ...rest }: IconButtonProps) {
  const s = SIZES[size];
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center transition active:scale-[0.96] ${className}`}
      style={{
        width: s.height,
        height: s.height,
        borderRadius: s.radius,
        background: "transparent",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
      {...rest}
    >
      <Icon name={name} size={s.icon} />
    </button>
  );
}
