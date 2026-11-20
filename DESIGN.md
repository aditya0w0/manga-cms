# MangaCMS Design System & Administrative Interface Specification

## 1. Design Direction & Dials

- **Energy Dial:** 1 (Focused, utilitarian administrative density; no gratuitous animation or distraction)
- **Rhythm Dial:** 1 (Consistent, predictable data tables, structured form containers, and disciplined spacing)
- **Motion Dial:** 1 (Instantaneous state transitions, standard 150ms-200ms opacity fades on modals; strictly adheres to `prefers-reduced-motion`)

## 2. Core Palette & Functional Semantics

All colors serve a specific operational purpose; decoration without purpose is strictly forbidden.

- **Background Surfaces:**
  - Base viewport: `#020617` (Tailwind `slate-950`)
  - Elevated containers & tables: `#0f172a` (Tailwind `slate-900` with 70% opacity, bordered with `slate-800`)
  - Inset fields & inputs: `#020617` (Tailwind `slate-950` with `slate-700` border)
- **Primary Operational Accent:**
  - Tailwind `sky-400` / `sky-500` used exclusively for primary user actions, navigation highlights, and active selection.
- **Status Semantics:**
  - Operational / Published / Success: `emerald-400` / `emerald-500`
  - Review / Warning: `amber-400` / `amber-500`
  - Destructive / Error: `rose-400` / `rose-500`
  - Neutral Metadata: `slate-300` / `slate-400` (guaranteeing minimum 4.5:1 contrast against dark background)

## 3. Typography & Data Density

- **Headings & Body:**
  - Modern sans-serif stack (`Inter`, `system-ui`) optimized for readability at 12px to 24px sizes.
  - Section titles use `font-bold` or `font-black` with tracking tightened to -0.025em.
- **Technical & Tabular Data:**
  - Monospace font (`font-mono`) reserved strictly for IDs, hashes, timestamps, slugs, and quantitative volume metrics.
- **Minimum Font Scale:**
  - Smallest secondary text is locked to `text-xs` (12px) to prevent illegible micro-typography and satisfy WCAG AA contrast rules.

## 4. Accessibility & Interaction Affordances

- **Dialogs & Modals:**
  - Must be in-app React dialog components with optical backdrops, focus trapping, and `Escape` key listeners. Native `alert()` and `confirm()` are strictly prohibited.
- **Keyboard Navigation:**
  - All interactive elements must be focusable via `Tab` with visible focus rings (`focus:ring-1 focus:ring-sky-500`).
  - File uploads must never use hidden inputs wrapped with `pointer-events-none` buttons; triggers must be explicit keyboard-accessible buttons.
- **Affordances:**
  - Every icon-only button must include an explicit `aria-label`.
  - Every image element must include a descriptive `alt` attribute.
  - Interactive elements show `cursor: pointer`; disabled states show `cursor: not-allowed`.
