# AGENTS.md - Glow Frontend Design System

This document defines the design system and rules for the Glow frontend. Follow these guidelines to maintain visual coherence across the application.

---

## Critical: Code Quality Requirements

**These rules are mandatory for ALL frontend changes:**

### 1. Always Run the Linter

After making ANY change to frontend code, run the linter before considering the task complete:

```bash
pnpm lint
# Or for a specific file:
pnpm lint --file path/to/file.tsx
```

Fix all errors and warnings before proceeding. Common issues:

- React hooks called conditionally (move all hooks before early returns)
- Missing dependencies in useEffect/useCallback/useMemo
- Unused imports or variables

### 3. Verification Order

For every frontend change:

1. Make the change
2. Run `pnpm lint` → fix any errors
3. Only then consider the task complete

Note: `pnpm build` is handled by husky pre-commit hooks. No need to run it manually.

### 4. Documentation Updates

When adding observability code, update the corresponding documentation:

- **Telemetry events** (`trackEvent`): Update `TELEMETRY.md` with the new event name, props, and emitting file
- **Sentry errors** (`Sentry.captureException`): Update `SENTRY.md` with the new error case and tags

This ensures the team can discover and query all tracked events/errors.

---

## Design Philosophy

The Glow dashboard follows a **premium, Series B-ready aesthetic** inspired by exactly.ai. Key principles:

- **Spacious**: Each element breathes with generous padding and margins
- **Clean**: Minimal visual noise, no unnecessary decoration
- **Contrast-based depth**: Use background color contrast, never shadows
- **Quiet UI**: Large bold numbers for KPIs, whisper-quiet labels
- **Professional**: Appropriate for investor dashboards and enterprise users

---

## Color System

### Light Mode - Contrast Hierarchy

The design relies on **background color contrast** for visual depth, not shadows.

```
Page Background (#f5f5f5) → Section Cards (#ffffff) → Content
```

| Token                | Value     | Usage                                      |
| -------------------- | --------- | ------------------------------------------ |
| `--background`       | `#f5f5f5` | Page background (gray)                     |
| `--card`             | `#ffffff` | Cards, sections, elevated surfaces (white) |
| `--muted`            | `#f0f0f0` | Subtle backgrounds, disabled states        |
| `--secondary`        | `#ebebeb` | Secondary backgrounds                      |
| `--border`           | `#e5e5e5` | Borders (use sparingly, at 20% opacity)    |
| `--muted-foreground` | `#71717a` | Secondary text, labels                     |

### Dark Mode

```
Page Background (#09090b) → Section Cards (#141414) → Content
```

| Token          | Value     | Usage                                        |
| -------------- | --------- | -------------------------------------------- |
| `--background` | `#09090b` | Page background (near-black)                 |
| `--card`       | `#141414` | Cards, sections, elevated surfaces (lighter) |
| `--muted`      | `#0f0f0f` | Subtle backgrounds (darker than card)        |
| `--border`     | `#262626` | Borders (more visible)                       |

### Brand Colors (Immutable)

These colors are part of Glow's brand identity and should not be changed:

| Color                 | Value     | Usage                              |
| --------------------- | --------- | ---------------------------------- |
| `--color-glow-orange` | `#ffb472` | Accent, CTAs, highlights           |
| `--color-glow-yellow` | `#f7fcc4` | Gradient component                 |
| `--color-glow-green`  | `#ccffd4` | Gradient component, success states |
| `--color-glow-purple` | `#dcc4ff` | Gradient component                 |
| `--delegation-purple` | `#a855f7` | Delegation-specific UI             |

---

## Critical Rules

### 1. NEVER Use Shadows

```tsx
// ❌ WRONG - No shadows
className = "shadow-sm shadow-lg shadow-card";

// ✅ CORRECT - Use background contrast
className = "bg-card"; // White card on gray background creates depth
```

### 2. Card/Section Backgrounds

```tsx
// ✅ Section containers in bento layout
className =
  "rounded-3xl bg-card dark:bg-card border border-border/20 p-8 lg:p-12";

// ✅ Widgets inside sections (minimal variant)
className = "bg-transparent border-transparent";

// ✅ Standalone cards
className = "bg-card dark:bg-card border-border/20";
```

### 3. Border Opacity

Always use low-opacity borders. Borders should be nearly invisible:

```tsx
// ✅ CORRECT
className = "border border-border/20";
className = "divide-border/20";

// ❌ WRONG - Too visible
className = "border border-border";
className = "border border-border/50";
```

---

## Typography Hierarchy

### KPI Numbers (Hero metrics)

Large, bold, attention-grabbing. Use for primary values users care about.

```tsx
// Rank/Score - Largest
className = "text-6xl lg:text-7xl font-semibold tracking-tight";

// Primary KPIs (Net Worth, Rewards)
className = "text-5xl lg:text-6xl font-semibold tracking-tight";

// Secondary KPIs
className = "text-4xl sm:text-5xl font-semibold tracking-tight";

// Tertiary numbers
className = "text-2xl sm:text-3xl font-semibold";
```

### Labels (Quiet, supportive text)

Labels should be quiet and not compete with numbers for attention.

```tsx
// Section headers
className =
  "text-xs font-mono uppercase tracking-widest text-muted-foreground/60 mb-8";

// Widget labels
className =
  "text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50";

// Very quiet labels
className =
  "text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40";
```

### Body Text

```tsx
// Primary body
className = "text-sm text-foreground";

// Secondary/description
className = "text-sm text-muted-foreground";

// Small/meta
className = "text-xs text-muted-foreground";
```

---

## Spacing System

### Section Spacing

Use generous spacing between major sections:

```tsx
// Between sections
className = "gap-8"; // Standard gap
className = "pt-20"; // Large section separation

// Inside section containers
className = "p-8 lg:p-12"; // Generous internal padding
```

### Widget Internal Spacing

```tsx
// Widget gaps
className = "gap-6"; // Between major elements
className = "gap-4"; // Between related elements
className = "gap-2"; // Between tightly coupled elements

// Widget padding
className = "p-6"; // Standard widget padding
className = "px-8"; // Card header/content padding
```

### Dividers

When dividing content within sections:

```tsx
className = "divide-y lg:divide-y-0 lg:divide-x divide-border/20";
```

---

## Border Radius

Use soft, premium radius values:

| Element            | Class          | Effective Size |
| ------------------ | -------------- | -------------- |
| Section containers | `rounded-3xl`  | 24px           |
| Cards              | `rounded-2xl`  | 16px           |
| Buttons, inputs    | `rounded-xl`   | 12px           |
| Badges, pills      | `rounded-full` | Full           |
| Small elements     | `rounded-lg`   | 8px            |

---

## Component Patterns

### Section Container (Bento Layout)

```tsx
<section className="flex flex-col gap-8">
  <SectionHeader title="Section Title" />
  <div className="rounded-3xl bg-card dark:bg-card border border-border/20 p-8 lg:p-12">
    {/* Content */}
  </div>
</section>
```

### Section Header

```tsx
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 mb-8">
      {title}
    </h2>
  );
}
```

### Widget Card (Standalone)

```tsx
<Card className="h-full overflow-hidden flex flex-col bg-card dark:bg-card border-border/20">
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Widget (Minimal Variant - Inside Sections)

When widgets are embedded in section containers, use transparent backgrounds:

```tsx
<Card className={cn(
  "h-full overflow-hidden flex flex-col",
  isMinimal
    ? "bg-transparent border-transparent"
    : "bg-card dark:bg-card border-border/20"
)}>
```

### KPI Display

```tsx
<div>
  {/* Quiet label */}
  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">
    Total Value
  </div>
  {/* Big number */}
  <div className="text-5xl lg:text-6xl font-semibold tracking-tight tabular-nums">
    $1,234,567
  </div>
  {/* Optional unit/suffix */}
  <span className="text-xl font-mono text-muted-foreground/60 ml-2">USD</span>
</div>
```

---

## Responsive Breakpoints

Use these breakpoints for responsive design:

| Breakpoint | Width  | Usage            |
| ---------- | ------ | ---------------- |
| `sm`       | 640px  | Mobile landscape |
| `md`       | 768px  | Tablets          |
| `lg`       | 1024px | Desktop          |
| `xl`       | 1280px | Large desktop    |
| `2xl`      | 1536px | Wide screens     |

### Common Responsive Patterns

```tsx
// Grid columns
className = "grid grid-cols-1 lg:grid-cols-12";

// Text sizes
className = "text-4xl sm:text-5xl lg:text-6xl";

// Padding
className = "p-4 sm:p-6 lg:p-8";

// Gap
className = "gap-4 lg:gap-8";

// Flex direction
className = "flex flex-col sm:flex-row";
```

---

## Animation Guidelines

Keep animations subtle and purposeful:

```tsx
// Transitions
className="transition-colors"           // Color changes
className="transition-all duration-200" // Multiple properties

// Hover states (subtle)
className="hover:bg-muted/50"

// Motion (framer-motion)
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ duration: 0.15 }}  // Keep durations short
```

---

## Do's and Don'ts

### Do's

- ✅ Use `bg-card` for elevated surfaces on gray backgrounds
- ✅ Use `font-mono` for numbers and data
- ✅ Use `tabular-nums` for numbers that change
- ✅ Use `tracking-tight` for large headings
- ✅ Use `tracking-widest` for small uppercase labels
- ✅ Wrap widgets in `<WidgetErrorBoundary>`
- ✅ Support both light and dark modes
- ✅ Use generous spacing (err on the side of more space)

### Don'ts

- ❌ Never use shadows (`shadow-*` classes)
- ❌ Never use borders at full opacity
- ❌ Never use heavy font weights for labels (use quiet, light text)
- ❌ Never crowd elements together
- ❌ Never add decorative elements that don't serve a purpose
- ❌ Never use pure black (`#000000`) - use `--foreground` instead
- ❌ Never hardcode colors - use CSS variables

---

## File Locations

| Purpose        | Location                               |
| -------------- | -------------------------------------- |
| CSS Variables  | `app/globals.css`                      |
| Card Component | `components/ui/card.tsx`               |
| Bento Layout   | `app/test/bento.tsx`                   |
| Widgets        | `app/test/widgets/*.tsx`               |
| Error Boundary | `components/widget-error-boundary.tsx` |

---

## Testing Checklist

When creating or modifying UI:

1. **Light mode**: Does it look clean with proper contrast?
2. **Dark mode**: Does it maintain readability and contrast?
3. **Mobile**: Does it stack properly and remain usable?
4. **Ultrawide**: Does it use space appropriately without stretching?
5. **No shadows**: Verify no shadow classes are used
6. **Spacing**: Is there enough breathing room?
7. **Typography**: Are numbers prominent and labels quiet?
