# Frontend rules for this project

Read `docs/design-system-claude.md` first — those are the portable
rules. This file only lists the project-specific deltas.

## Stack

- Vite + React + TypeScript + Tailwind.
- Brand colors are CSS variables in `src/index.css` (`:root[data-theme="dark"]`
  and `:root[data-theme="light"]`). Tailwind reads them via
  `tailwind.config.js` — so utilities like `bg-bg`, `text-text`,
  `text-accent`, `bg-surface`, `border-border` resolve to the active
  theme.
- The dark theme is the default brand expression. Light theme is a
  secondary mode the user can toggle.

## Brand tokens

Current brand: SDLuxury Transportation (chauffeur service).

- Primary accent: champagne / warm gold (`--accent: #C8A97E`).
- Background: deep warm black (`--bg: #0A0A0D`).
- Text: warm off-white (`--text: #F1EEE7`).

Brand swap path (future Romo LTS, or any other client):
1. Edit the CSS variables in `src/index.css`.
2. Edit copy + contact info in `src/brand.ts` (single source of truth
   for name, tagline, phone, email, hero copy).
3. Replace assets in `public/brand/` (logo, hero photos, favicons).

Never hardcode the brand name, phone number, email, or hex color
inside a component.

## Components + utilities to reuse

- `AppShell`, `ClientShell`, `DriverShell` — page wrappers with the
  app's nav. Use them for authed routes.
- `Icon` (`src/components/Icon.tsx`) — for any iconography.
- `PlacesInput` — Google Places address autocomplete; use whenever
  asking for an address.
- Public routes (no auth needed): `/`, `/book`, `/install`, `/vapid`.

## Things this project already gets right

- CSS-variable theme system (no hardcoded colors).
- Mobile-first responsive throughout.
- PWA is installable; `public/sw.js` is the service worker.

## Things to be careful about

- The `Book.tsx` route is 789 lines and works in production. Don't
  rewrite it without explicit ask — refactor in small, reviewable
  passes.
- The Worker code in `worker/` is the MCP backend. Anything in there
  is server-side, not browser code. Don't import React from it.
- Don't add a new state management library; existing routes use
  `useState` + the `useAuth` hook. Match that pattern.
