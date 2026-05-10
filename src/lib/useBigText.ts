import { useEffect, useState } from "react";

// Accessibility: bumps the base font size 12.5% so older drivers and
// folks driving in glare can scan the briefing without squinting.
// Persists to localStorage and toggles a `data-bigtext` attribute on
// <html>; the actual size bump lives in index.css.
const KEY = "sdl-bigtext";

export function useBigText(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (on) document.documentElement.setAttribute("data-bigtext", "true");
    else document.documentElement.removeAttribute("data-bigtext");
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [on]);

  return [on, setOn];
}
