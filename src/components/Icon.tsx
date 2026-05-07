// Inline monoline icons (1.5px stroke) — ported from dispatch-101 design.
// Add new ones here as designs require them; keep the API minimal.

type Props = { name: IconName; size?: number; className?: string };

export type IconName =
  | "sun"
  | "moon"
  | "moon2"
  | "copy"
  | "check"
  | "plus"
  | "doc"
  | "plane"
  | "car"
  | "user"
  | "phone"
  | "arrow"
  | "dot"
  | "spark"
  | "chev"
  | "chevd"
  | "calendar"
  | "clients"
  | "drivers"
  | "invoice"
  | "settings"
  | "today"
  | "rides"
  | "bell"
  | "menu"
  | "back"
  | "search"
  | "pin"
  | "flag"
  | "clock"
  | "wallet"
  | "note"
  | "x"
  | "info"
  | "save"
  | "swap";

export function Icon({ name, size = 16, className }: Props) {
  const c = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (name) {
    case "sun":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...c}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
        </svg>
      );
    case "moon2":
      return (
        <svg {...c}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      );
    case "copy":
      return (
        <svg {...c}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
      );
    case "check":
      return (
        <svg {...c}>
          <path d="m5 12 5 5L20 7" />
        </svg>
      );
    case "plus":
      return (
        <svg {...c}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "doc":
      return (
        <svg {...c}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
      );
    case "plane":
      return (
        <svg {...c}>
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
        </svg>
      );
    case "car":
      return (
        <svg {...c}>
          <path d="M5 17h14M5 17v2M19 17v2M5 17l1.6-5a2 2 0 0 1 1.9-1.4h7a2 2 0 0 1 1.9 1.4L19 17M3 17h2M19 17h2" />
          <circle cx="8" cy="17" r="1.2" />
          <circle cx="16" cy="17" r="1.2" />
        </svg>
      );
    case "user":
      return (
        <svg {...c}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "phone":
      return (
        <svg {...c}>
          <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...c}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "dot":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case "spark":
      return (
        <svg {...c}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5 8 8M16 16l2.5 2.5M5.5 18.5 8 16M16 8l2.5-2.5" />
        </svg>
      );
    case "chev":
      return (
        <svg {...c}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "chevd":
      return (
        <svg {...c}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...c}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      );
    case "clients":
      return (
        <svg {...c}>
          <circle cx="9" cy="9" r="3" />
          <path d="M3 19a6 6 0 0 1 12 0" />
          <circle cx="17" cy="8" r="2.5" />
          <path d="M16 19a5 5 0 0 1 5-5" />
        </svg>
      );
    case "drivers":
      return (
        <svg {...c}>
          <path d="M5 17h14l-1.5-7.5A2 2 0 0 0 15.5 8h-7a2 2 0 0 0-2 1.5L5 17Z" />
          <circle cx="8" cy="17" r="1.2" />
          <circle cx="16" cy="17" r="1.2" />
        </svg>
      );
    case "invoice":
      return (
        <svg {...c}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );
    case "today":
      return (
        <svg {...c}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17" />
          <circle cx="12" cy="14.5" r="1.6" fill="currentColor" />
        </svg>
      );
    case "rides":
      return (
        <svg {...c}>
          <path d="M4 17h16M5 17l1.5-5A2 2 0 0 1 8.5 10.5h7A2 2 0 0 1 17.5 12L19 17" />
          <circle cx="8" cy="17" r="1.2" />
          <circle cx="16" cy="17" r="1.2" />
          <path d="M9 7h6" />
        </svg>
      );
    case "bell":
      return (
        <svg {...c}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "menu":
      return (
        <svg {...c}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "back":
      return (
        <svg {...c}>
          <path d="M15 6 9 12l6 6" />
        </svg>
      );
    case "search":
      return (
        <svg {...c}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "pin":
      return (
        <svg {...c}>
          <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    case "flag":
      return (
        <svg {...c}>
          <rect x="11.25" y="3" width="1.5" height="18" rx="0.4" fill="currentColor" />
          <path d="M13 4h7l-2 3 2 3h-7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...c}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18M16 14.5h2" />
        </svg>
      );
    case "note":
      return (
        <svg {...c}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M9 11h6M9 15h4" />
        </svg>
      );
    case "x":
      return (
        <svg {...c}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "info":
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8v.01" />
        </svg>
      );
    case "save":
      return (
        <svg {...c}>
          <path d="M5 5a2 2 0 0 1 2-2h9l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
          <path d="M8 3v5h7M8 21v-7h8v7" />
        </svg>
      );
    case "swap":
      return (
        <svg {...c}>
          <path d="M7 7h13l-3-3M17 17H4l3 3" />
        </svg>
      );
  }
}
