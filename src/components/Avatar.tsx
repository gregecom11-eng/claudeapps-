// Initials avatar — deterministic warm tone per name. Slightly rounded
// square shape (Apple Wallet-ish) feels more "concierge" than a circle.

type Props = {
  name: string;
  size?: number;
  shape?: "circle" | "rounded";
};

export function Avatar({ name, size = 32, shape = "rounded" }: Props) {
  const initials =
    name
      .split(/\s+/)
      .filter((p) => p && /\w/.test(p))
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  // Restrained palette: warm desaturated tones, never neon, never red-on-red.
  const hueSeed = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = 24 + (hueSeed % 8) * 14; // 24..120 — warm-side spectrum
  return (
    <div
      className="inline-flex items-center justify-center font-medium select-none shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: shape === "circle" ? 999 : Math.round(size * 0.28),
        background: `hsl(${hue} 14% 22%)`,
        color: "var(--text)",
        border: "1px solid var(--border)",
        fontSize: size * 0.38,
        letterSpacing: "0.04em",
        fontFeatureSettings: '"ss01"',
      }}
    >
      {initials}
    </div>
  );
}
