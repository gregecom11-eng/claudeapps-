# Frontend Design Rules

A portable design rulebook. Drop this at the repo root as `CLAUDE.md`,
or save it to `~/.claude/CLAUDE.md` to apply across every project.

## Always do first

- Before writing any frontend code, look for a `brand_assets/` folder,
  a brand tokens file (`src/brand.ts`, `tailwind.config.js`, CSS
  variables in `index.css`), or any project-specific design notes —
  honor them over the defaults below.
- If a reference image / mockup / inspiration site is provided, match
  layout, spacing, typography, and color exactly. Swap in placeholder
  content (images via `https://placehold.co/`, generic copy). Do NOT
  improve or add to the design.
- If no reference: design from scratch using the guardrails below.

## Output defaults

These apply when the project does not already define a setup.

- **Stack**: prefer the project's existing stack. Vite + React +
  TypeScript + Tailwind is a common default. If the project has no
  stack at all and the user wants a one-off, a single `index.html`
  with Tailwind via CDN (`<script src="https://cdn.tailwindcss.com">`)
  is fine.
- **Mobile-first responsive**. Design the small breakpoint first;
  desktop is the enhancement.
- **Placeholder images**: `https://placehold.co/WIDTHxHEIGHT` with a
  descriptive alt text.
- **Accessibility**: every interactive element needs a clear focus
  state, sufficient color contrast (4.5:1 minimum for body text),
  semantic HTML.

## Anti-generic guardrails

These are the line between "looks like a template" and "looks
designed." Hold the line.

- **Colors**: never ship the default Tailwind palette as the primary
  accent (`indigo-500`, `blue-600`, etc.). Pick a custom brand color
  and derive shades from it (lighter for hover, darker for active,
  semi-transparent for soft backgrounds).
- **Shadows**: never flat `shadow-md` on everything. Use layered,
  color-tinted shadows at low opacity. Example:
  `box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);`
- **Typography**: never use the same font for headings and body. Pair
  a display or serif with a clean sans-serif. Apply tight tracking
  (`letter-spacing: -0.02em` to `-0.03em`) on large headings; generous
  line-height (`1.6`–`1.7`) on body text.
- **Gradients**: layer multiple radial gradients rather than a single
  flat linear. Add subtle grain/texture via an SVG noise filter for
  depth.
- **Animations**: only animate `transform` and `opacity`. NEVER use
  `transition-all`. Use spring-style easing
  (`cubic-bezier(0.34, 1.56, 0.64, 1)` is a good default).
- **Interactive states**: every clickable element needs hover, focus-
  visible, and active states. No exceptions.
- **Images**: when overlaying text on a photo, add a gradient overlay
  (`bg-gradient-to-t from-black/60`) for readability and a color
  treatment layer with `mix-blend-multiply` for cohesion with the
  brand palette.
- **Spacing**: define a small set of consistent spacing tokens (4, 8,
  12, 16, 24, 32, 48, 64) and stick to them. No random
  one-off pixel values.
- **Depth**: surfaces should have a layering system — base → elevated
  → floating — visible through shadow + slight background lightness
  shift. Not everything at the same z-plane.

## Hard rules

- Do not add sections, features, or content not in the reference.
- Do not "improve" a reference design — match it.
- Do not use `transition-all`.
- Do not use default Tailwind blue or indigo as the primary brand
  color.

## Reviewing your own work

- After implementing, compare your output to the reference (if any)
  side by side. Be specific about what you see:
  - "heading is 32px but reference shows ~24px"
  - "card gap is 16px but should be 24px"
- Check spacing/padding, font size + weight + line-height, exact hex
  colors, alignment, border-radius, shadow values, image sizing.
- Do at least two comparison rounds. Stop only when no visible
  differences remain.
- If you can't actually render the page (e.g. cloud environment with
  no browser), say so explicitly rather than claiming visual review
  was done.

## Brand swap discipline

If the project is being built for one brand but designed to be
re-skinnable later (e.g. white-label for multiple clients):

- Centralize **brand data** (name, tagline, contact info, hero copy)
  in a single config file (`src/brand.ts` or similar).
- Centralize **brand colors** in CSS variables on `:root`, with
  Tailwind reading from those variables. Brand swap = edit one file.
- Centralize **brand assets** (logo, hero photos, favicons) in a
  single folder (`public/brand/` or `src/assets/brand/`).
- Never hardcode the brand name, phone number, email, or color hex
  inside a component. Always read from the central source.
