// Initials avatar — deterministic hue per name for subtle variety.

type Props = { name: string; size?: number };

export function Avatar({ name, size = 28 }: Props) {
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="inline-flex items-center justify-center font-medium select-none"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: `hsl(${hue} 18% 22%)`,
        color: "var(--text)",
        border: "1px solid var(--border)",
        fontSize: size * 0.38,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}
