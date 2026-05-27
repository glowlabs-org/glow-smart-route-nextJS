# CSS Style Guide

This project uses **Tailwind CSS** with a custom theme defined in `@app/globals.css`.

## Core Principles

- **Utility-First:** Use Tailwind utility classes for almost all styling.
- **Design System:** Strictly adhere to the defined color palette and typography scale.
- **Responsive Design:** Mobile-first approach using standard Tailwind breakpoints.
- **Dark Mode:** Support dark mode using the `dark:` variant and CSS variables.

## Colors

The application uses a specific set of brand and semantic colors.

### Brand Colors (defined in `globals.css`)

- **Glow Black**: `--color-glow-black` (`#050505`) - Primary text and dark elements
- **Glow White**: `--color-glow-white` (`#ffffff`) - Primary background and light elements
- **Glow Light Grey**: `--color-glow-light-grey` (`#fafafa`) - Subtle backgrounds
- **Glow Medium Grey**: `--color-glow-medium-grey` (`#f3f3f3`) - Borders and dividers
- **Glow Orange**: `--color-glow-orange` (`#ffb472`) - Accent color for CTAs
- **Glow Yellow**: `--color-glow-yellow` (`#f7fcc4`) - Gradient component
- **Glow Green**: `--color-glow-green` (`#ccffd4`) - Gradient component, success states
- **Glow Purple**: `--color-glow-purple` (`#dcc4ff`) - Gradient component

### Semantic Colors

- **Miner Blue**: `--color-miner` (`#2081e2`) - Used for miner-related elements.
- **Delegation Purple**: `--delegation-purple` (`#a855f7` / `#d792ff`) - Used for delegation elements.

### Usage

Use the Tailwind color classes or CSS variables. **Do not hardcode hex values.**

```tsx
// Correct
<div className="bg-[color:var(--color-glow-orange)]" />
<div className="text-[color:var(--color-miner-contrast)]" />

// Incorrect
<div className="bg-[#ffb472]" />
```

## Typography

- **Font Family:** Geist Sans (`--font-sans`) and Geist Mono (`--font-mono`).
- **Headings:** Use fluid typography classes like `.text-h1`, `.text-h2`, etc., defined in `globals.css` utilities layer.

## Icons

Use the custom SVG icons located in `public/images/icons/` for Glow-specific concepts (Glow Points, Watts, Miners, etc.).

- **Multiplier Icons:** `cash-miner.svg`, `impact-streak.svg`
- **Point Source Icons:** `steering.svg`, `emissions.svg`, `vault.svg`, `glw-worth.svg`

For generic UI icons, use `lucide-react`.

## Global Styles

Refer to `@app/globals.css` for:
- CSS Variables for colors and spacing.
- Custom animations (`glow-gradient`, `float`, etc.).
- Fluid typography and spacing utilities.
