import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "ghost" | "danger" | "quiet";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: IconName;
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

export function Button({
  variant = "primary",
  icon,
  className = "",
  children,
  style,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[8px] text-[13.5px] font-medium transition select-none disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button
      className={`${base} ${className}`}
      style={{ ...STYLES[variant], ...style }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      {children}
    </button>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name: IconName;
  label: string;
};

export function IconButton({ name, label, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-[8px] transition ${className}`}
      style={{
        background: "transparent",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
      {...rest}
    >
      <Icon name={name} size={16} />
    </button>
  );
}
