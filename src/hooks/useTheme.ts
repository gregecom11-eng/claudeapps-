import { useEffect } from "react";
import { useStore } from "./useStore";

// Reflects settings.theme onto <html data-theme="...">. Tracks the system
// preference when set to "system".
export function useTheme() {
  const { state } = useStore();
  const theme = state.settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      root.setAttribute("data-theme", resolved);
    };
    apply();
    if (theme !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [theme]);
}
