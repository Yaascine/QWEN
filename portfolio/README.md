# Ahmed Raza Khan — Electrical Engineer Portfolio

A single-page portfolio built with **neo-brutalism × minimalism**: hard black borders,
flat offset shadows, zero rounded corners, one loud accent (electric orange) plus a
hi-voltage yellow band — everything else kept quiet and functional.

> All personal details, employers, projects and numbers are **fictional demo data**
> for a NUST (Islamabad) electrical engineer.

## Run it

No build step, no dependencies — plain HTML/CSS/JS.

```bash
cd portfolio
python3 -m http.server 8099     # then open http://localhost:8099
```

(Opening `index.html` directly also works.)

## Structure

```
portfolio/
├── index.html          # all sections: hero, about, skills, projects, experience,
│                       # education, testimonials, contact, footer, modal
├── css/style.css       # design tokens, brutalist components, dark theme, print styles
└── js/app.js           # vanilla JS behaviour (no libraries)
```

## Typography

| Role            | Face          | Why                                  |
|-----------------|---------------|--------------------------------------|
| Display / H1-H3 | Archivo Black | Blocky, unapologetic — pure brutalism |
| Body            | Space Grotesk | Geometric, technical, very readable   |
| Labels / data   | IBM Plex Mono | Engineering-instrument feel           |

Loaded from Google Fonts with system fallbacks.

## Functional features

- **Sticky nav + scroll-spy** — active section highlighted while scrolling
- **Responsive burger menu** (≤900 px), smooth anchor scrolling
- **Light/dark theme toggle**, persisted in `localStorage`, respects OS preference
- **Animated stat counters** and **skill bars** triggered on scroll (IntersectionObserver)
- **Project filtering** two ways: category buttons *and* clickable skill chips
  (chips are generated from project tags)
- **Case-study modal** per project with specs table, focus trap, Esc/backdrop close
- **Contact form** with real client-side validation (inline errors, aria-invalid)
  and a `mailto:` handoff that pre-fills subject/body
- **RESUME button** generates a printable one-page CV window (`Ctrl/Cmd+P` → PDF)
- **Live PKT clock** (`Asia/Karachi` via `Intl`), auto-updating copyright year
- **Scroll-to-top FAB**, inline SVG circuit-board artwork, infinite marquee ticker
- Accessible & considerate: semantic landmarks, skip-free logical heading order,
  keyboard-operable everywhere, `prefers-reduced-motion` honoured, content visible
  without JS (`.js` gate), `@media print` stylesheet

## Deploying

Static hosting as-is: GitHub Pages / Netlify / Vercel — point them at the
`portfolio/` folder (or move these files to your repo root).
