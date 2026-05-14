// Google Places Autocomplete-aware input.
//
// Looks IDENTICAL to a plain `.field` input. When the
// VITE_GOOGLE_PLACES_KEY env var is set, the input gets a Google Places
// Autocomplete instance attached on mount. When the user picks a
// suggestion we surface the formatted_address through `onChange`. The
// user can also still type freely.
//
// When no key is set, the loader bails out silently (with one console
// warning) and the input behaves like any other text field. This keeps
// `npm run build` working without VITE_GOOGLE_PLACES_KEY being defined.

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  required?: boolean;
};

// LA bias — Beverly Hills lat/lon with a 50km radius. Suggestions still
// work outside the box; this just ranks LA-area places higher.
const LA_BIAS_CENTER = { lat: 34.0736, lng: -118.4004 };
const LA_BIAS_RADIUS_M = 50_000;

/* ── Minimal ambient typing ────────────────────────────────────────
   We deliberately avoid pulling in @types/google.maps; just type the
   tiny surface we actually touch. */
type PlaceResult = {
  formatted_address?: string;
  name?: string;
};
type AutocompleteInstance = {
  getPlace(): PlaceResult;
  addListener(event: string, cb: () => void): { remove: () => void };
};
type PlacesNamespace = {
  Autocomplete: new (
    input: HTMLInputElement,
    opts: Record<string, unknown>,
  ) => AutocompleteInstance;
};
type MapsCircle = {
  getBounds(): unknown;
};
type MapsNamespace = {
  places: PlacesNamespace;
  Circle: new (opts: { center: { lat: number; lng: number }; radius: number }) => MapsCircle;
};
type GoogleNamespace = { maps: MapsNamespace };

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

// We cache the in-flight loader promise so concurrent <PlacesInput>
// instances share a single <script> tag.
let loaderPromise: Promise<MapsNamespace | null> | null = null;
let warnedMissingKey = false;

function loadPlaces(): Promise<MapsNamespace | null> {
  if (loaderPromise) return loaderPromise;

  const key = import.meta.env.VITE_GOOGLE_PLACES_KEY as string | undefined;
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn(
        "VITE_GOOGLE_PLACES_KEY not set; address autocomplete disabled.",
      );
    }
    loaderPromise = Promise.resolve(null);
    return loaderPromise;
  }

  loaderPromise = new Promise((resolve) => {
    if (typeof window !== "undefined" && window.google?.maps?.places) {
      resolve(window.google.maps);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-places-loader="1"]',
    );
    const ready = () => {
      if (window.google?.maps?.places) resolve(window.google.maps);
      else resolve(null);
    };
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places&v=weekly&loading=async`;
    s.async = true;
    s.defer = true;
    s.dataset.placesLoader = "1";
    s.addEventListener("load", ready, { once: true });
    s.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(s);
  });

  return loaderPromise;
}

export function PlacesInput({
  value,
  onChange,
  placeholder,
  required,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Keep the latest onChange in a ref so the Places listener doesn't
  // close over a stale callback.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    let listener: { remove: () => void } | null = null;
    let autocomplete: AutocompleteInstance | null = null;

    loadPlaces().then((maps) => {
      if (cancelled || !maps || !inputRef.current) return;
      try {
        const bounds = new maps.Circle({
          center: LA_BIAS_CENTER,
          radius: LA_BIAS_RADIUS_M,
        }).getBounds();
        autocomplete = new maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "name", "geometry"],
          componentRestrictions: { country: "us" },
          bounds,
        });
        listener = autocomplete.addListener("place_changed", () => {
          if (!autocomplete) return;
          const place = autocomplete.getPlace();
          const text =
            place.formatted_address ??
            place.name ??
            inputRef.current?.value ??
            "";
          onChangeRef.current(text);
        });
      } catch {
        // Google failed to mount Autocomplete (rare quota / scripting
        // error). Silently fall back to plain typing.
      }
    });

    return () => {
      cancelled = true;
      if (listener) listener.remove();
      // The Autocomplete instance has no public dispose, but removing
      // the input from the DOM (on unmount) cleans up internally.
    };
  }, []);

  return (
    <input
      ref={inputRef}
      className="field"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      autoComplete="off"
    />
  );
}
