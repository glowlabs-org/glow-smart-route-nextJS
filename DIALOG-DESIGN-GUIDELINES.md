# Dialog Design Guidelines

This document defines the design patterns for dialogs in the Glow frontend. Follow these guidelines to maintain visual consistency across all modal components.

---

## Core Principles

1. **Clean & Premium** - No gradients, no flashy effects, no shadows
2. **Contrast-Based Depth** - Use background color contrast, never shadows
3. **Subtle Color Accents** - Colors appear only on icons when active, not on containers
4. **Neutral Containers** - Cards, sections, and badges use muted backgrounds
5. **Interactive Feedback** - Buttons show color on hover (text + border), not background
6. **Dark Mode Parity** - Both themes get equal attention; dark mode uses higher opacity for visibility

---

## Dark Theme Guidelines

Dark mode requires higher opacity values to maintain sufficient contrast against dark backgrounds. Always pair light mode classes with their dark mode counterparts.

### Opacity Mapping

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Container backgrounds | `bg-muted/30` | `dark:bg-muted/50` |
| Borders | `border-border/20` | `dark:border-border/40` |
| Text labels | `text-muted-foreground/60` | `dark:text-muted-foreground/80` |
| Subtle text | `text-muted-foreground/50` | `dark:text-muted-foreground/70` |
| Hover backgrounds | `hover:bg-muted/40` | `dark:hover:bg-muted/60` |
| Hover borders | `hover:border-border/40` | `dark:hover:border-border/60` |

### Pattern Examples

**Container with border:**
```tsx
<div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 rounded-xl p-4">
```

**Section header label:**
```tsx
<span className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
```

**Interactive card:**
```tsx
<div className="bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 hover:border-border/40 dark:hover:border-border/60 rounded-xl p-4 transition-colors">
```

**Divider/separator:**
```tsx
<div className="border-t border-border/20 dark:border-border/40 pt-3">
```

### Why Higher Opacity in Dark Mode?

In light mode, subtle elements (30% opacity backgrounds, 20% borders) provide enough contrast against the white/light background. In dark mode, these same values appear too faint against dark backgrounds, making UI elements feel washed out or invisible.

By increasing opacity in dark mode:
- **Backgrounds** go from 30% → 50% to create visible depth
- **Borders** go from 20% → 40% to define clear boundaries
- **Text** goes from 60% → 80% to ensure readability

### Checklist for Dark Mode

When creating or updating dialog components, ensure:

- [ ] All `bg-muted/30` have corresponding `dark:bg-muted/50`
- [ ] All `border-border/20` have corresponding `dark:border-border/40`
- [ ] All `text-muted-foreground/60` labels have `dark:text-muted-foreground/80`
- [ ] Hover states include dark mode variants
- [ ] Test in both themes before shipping

---

## Dialog Container

```tsx
<DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
```

| Property | Value | Notes |
|----------|-------|-------|
| Background | `bg-card` | White in light mode, dark in dark mode |
| Border | `border border-border/40` | Subtle, low opacity |
| Border Radius | `rounded-[24px]` or `rounded-2xl` | Soft, premium feel |
| Padding | `p-0` on container | Sections handle their own padding |
| Max Width | `sm:max-w-[600px]` | Standard dialog width |

---

## Header Section

```tsx
<div className="border-b border-border/40 pb-6 pt-8 px-6">
  <div className="flex flex-col items-center text-center space-y-2">
    <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
      Dialog Title
    </DialogTitle>
    <div className="text-6xl font-mono font-semibold text-foreground tracking-tighter">
      {heroValue}
    </div>
    <div className="text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider mt-2">
      Subtitle text
    </div>
  </div>
</div>
```

### Typography Hierarchy

| Element | Classes |
|---------|---------|
| Title (quiet label) | `text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80` |
| Hero Number | `text-6xl font-mono font-semibold text-foreground tracking-tighter` |
| Subtitle | `text-[10px] font-mono text-muted-foreground/50 dark:text-muted-foreground/70 uppercase tracking-wider` |

---

## Section Headers

```tsx
<h3 className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
  Section Title
</h3>
```

- Use `font-mono` for all labels
- Use `uppercase tracking-widest` for section headers
- Keep labels quiet: `text-muted-foreground/60 dark:text-muted-foreground/80`

---

## Icon Containers (Active State Pattern)

Icons should be colored **only when active**. The icon container gets a subtle colored background at 10% opacity.

### Structure

```tsx
<div
  className={cn(
    "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
    isActive
      ? cn(activeIconColor, activeIconBg)
      : "bg-muted/50 text-muted-foreground",
  )}
>
  <Icon className="w-4 h-4" />
</div>
```

### Color Mapping

| Source | Icon Color | Background (10% opacity) |
|--------|------------|--------------------------|
| Steering | `text-[#22D3EE]` | `bg-[#22D3EE]/10` |
| Emissions | `text-[color:var(--color-miner-contrast)]` | `bg-[color:var(--color-miner)]/10` |
| Delegation | `text-[color:var(--delegation-purple)]` | `bg-[color:var(--delegation-purple)]/10` |
| Glow Worth | `text-[#4ADE80]` | `bg-[#4ADE80]/10` |
| Referral | `text-[color:var(--color-glow-orange)]` | `bg-[color:var(--color-glow-orange)]/10` |
| Miner Bonus | `text-[color:var(--color-miner-contrast)]` | `bg-[color:var(--color-miner)]/10` |
| Streak | `text-[color:var(--delegation-purple)]` | `bg-[color:var(--delegation-purple)]/10` |

### Inactive State

```tsx
className="bg-muted/50 text-muted-foreground"
```

---

## Cards & Containers

### Info Cards

Info containers inside dialogs use a subtle muted background with proper dark mode variants:

```tsx
<div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
  {/* Content */}
</div>
```

**Key rules:**
- Dialog background is `bg-card` (set on DialogContent)
- Info containers inside dialogs use `bg-muted/30 dark:bg-muted/50`
- Always pair light/dark mode opacity values (30% light → 50% dark)
- Borders follow the same pattern: `border-border/20 dark:border-border/40`

### Success & Confirmation Summary Panels

Sparse success or confirmation summaries should stay on the dialog surface instead of using a muted fill.

```tsx
<div className="rounded-xl bg-card border border-border/20 dark:border-border/40">
```

Use `bg-card` for:
- projected reward summaries in success dialogs
- confirmation receipts
- compact post-action result panels

Why:
- muted fills can make a success panel look dirty or recessed against an already-clean dialog
- `bg-card` keeps the panel visually integrated with the dialog while the border and dividers still define structure
- in dark mode, `bg-card` automatically follows the theme surface instead of forcing an arbitrary gray block

**IMPORTANT:** Never reverse the opacity values. Light mode needs LOWER opacity (30%) because the background is already light. Dark mode needs HIGHER opacity (50%) to create visible contrast against the dark background.

### Nested Containers (Contrast Layering)

When placing a container **inside** an already-muted parent, use the **opposite** background to create contrast:

| Parent Background | Child Background | Result |
|-------------------|------------------|--------|
| `bg-card` | `bg-muted/30 dark:bg-muted/50` | Gray container on white |
| `bg-muted/30 dark:bg-muted/50` | `bg-card` | White container on gray |

**Example: Expandable row with detail panel**

```tsx
{/* Row container - muted background */}
<div className="rounded-xl border border-border/20 dark:border-border/40 bg-muted/30 dark:bg-muted/50 p-4">
  {/* Row content... */}

  {/* Nested detail panel - use bg-card for contrast */}
  {isExpanded && (
    <div className="rounded-xl border border-border/20 dark:border-border/40 bg-card p-4">
      {/* Breakdown, Timeline, etc. */}
    </div>
  )}
</div>
```

**Why this matters:**
- If nested container uses the same `bg-muted/30` as parent, it blends in and becomes invisible
- Using `bg-card` creates a visible white/light panel against the gray parent
- This alternating pattern ensures clear visual hierarchy at any nesting depth

**Common mistake to avoid:**
```tsx
{/* WRONG - nested container blends into parent */}
<div className="bg-muted/30 dark:bg-muted/50">
  <div className="bg-muted/30 dark:bg-muted/50">  {/* Invisible! */}
    ...
  </div>
</div>

{/* CORRECT - contrast creates visible nesting */}
<div className="bg-muted/30 dark:bg-muted/50">
  <div className="bg-card">  {/* Visible white panel */}
    ...
  </div>
</div>
```

### Slot/Equipment Cards (Multipliers)

```tsx
<button
  className={cn(
    "relative flex flex-col items-start p-4 rounded-xl border transition-all w-full text-left group",
    isActive
      ? "bg-muted/50 dark:bg-muted/60 border-border/40"
      : "bg-muted/10 dark:bg-muted/20 border-dashed border-border/60 hover:border-border hover:bg-muted/20 dark:hover:bg-muted/30",
  )}
>
```

**Key Rules:**
- Card background stays neutral (`bg-muted/50`) even when active
- Only the icon inside gets colored
- Inactive cards use dashed borders
- Badge text stays `text-foreground`, not colored

---

## CTA Buttons (Small)

```tsx
<Button
  size="sm"
  variant="outline"
  className={cn(
    "h-7 px-3 text-[11px] font-medium border-border/40 bg-transparent hover:bg-transparent transition-colors shrink-0",
    hoverColor,
  )}
>
  {label}
</Button>
```

### Hover Color Mapping

On hover, buttons show colored **text and border** (not background):

| Source | Hover Classes |
|--------|---------------|
| Steering | `hover:text-[#22D3EE] hover:border-[#22D3EE]` |
| Emissions | `hover:text-[color:var(--color-miner-contrast)] hover:border-[color:var(--color-miner)]` |
| Delegation | `hover:text-[color:var(--delegation-purple)] hover:border-[color:var(--delegation-purple)]` |
| Glow Worth | `hover:text-[#4ADE80] hover:border-[#4ADE80]` |
| Referral | `hover:text-[color:var(--color-glow-orange)] hover:border-[color:var(--color-glow-orange)]` |

---

## Row Components

### Standard Row Layout

```tsx
<div className="flex items-center justify-between gap-4 py-3 border-b border-border/20 dark:border-border/40 last:border-b-0">
  {/* Left: Icon + Label */}
  <div className="flex items-center gap-3 min-w-0">
    <IconContainer />
    <div className="flex flex-col min-w-0">
      <span className="text-sm font-medium text-foreground truncate">{label}</span>
      <span className="text-[10px] text-muted-foreground truncate">{subLabel}</span>
    </div>
  </div>

  {/* Right: Value + CTA */}
  <div className="flex items-center gap-4">
    <ValueDisplay />
    <CTAButton />
  </div>
</div>
```

### Value Display

```tsx
{/* Has value */}
<div className="text-right">
  <div className="font-mono font-semibold text-sm text-foreground">+{value}</div>
  <div className="text-[10px] text-muted-foreground">{subtext}</div>
</div>

{/* No value */}
<div className="text-sm text-muted-foreground/50 font-mono">0 pts</div>
```

---

## Charts (Pie Chart Example)

Use Glow brand colors for data visualization:

```tsx
const regionColors: Record<number, string> = {
  1: "#ffb472", // glow orange
  2: "#ccffd4", // glow green
  3: "#2081e2", // miner blue
  4: "#a855f7", // delegation purple
};
```

---

## Scroll Areas

```tsx
<ScrollArea className="max-h-[65vh]">
  <div className="p-5 space-y-8">
    {/* Sections */}
  </div>
</ScrollArea>
```

---

## Spacing

### General Spacing Scale

| Context | Value | Notes |
|---------|-------|-------|
| Between major sections | `space-y-8` | Large visual breaks |
| Inside sections | `space-y-3` or `space-y-4` | Related content grouping |
| Between form fields | `space-y-4` | Consistent form rhythm |
| Row padding | `py-3` | List item vertical rhythm |
| Dialog content padding | `p-5` or `px-5 pb-5` | Standard content area |
| Header padding | `pt-6 pb-3 px-6` | Compact dialog headers |

### Dialog-Specific Spacing

**Swap/Transaction Dialogs:**
```tsx
{/* Header */}
<DialogHeader className="px-6 pt-6 pb-3">

{/* Content area */}
<div className="px-5 pb-5">

{/* Inner content wrapper - adds gaps between sections */}
<div className="space-y-1">
```

**Info/Breakdown Dialogs:**
```tsx
{/* Header with border */}
<div className="border-b border-border/40 pb-6 pt-8 px-6">

{/* Scrollable content */}
<ScrollArea className="max-h-[65vh]">
  <div className="p-5 space-y-8">
```

### Spacing Between Interactive Elements

| Element Pair | Spacing | Example |
|--------------|---------|---------|
| Input sections | `space-y-1` via parent | "You pay" → swap button → "You receive" |
| Section to details | `mt-4` | "You receive" → "Estimated Network Fee" |
| Details to CTA button | `pt-5` | Transaction details → "SWAP" button |
| Swap direction button area | `py-2` | Centered button between sections |

### Vertical Rhythm Tips

1. **Use `space-y-*` on parent containers** instead of margin on individual children
2. **Add explicit `mt-*` or `pt-*`** for specific element separations
3. **Keep swap/toggle buttons compact** (`py-2`) to visually connect the sections they bridge
4. **Give CTAs breathing room** (`pt-5` or `pt-6`) to make them prominent

---

## Separators

```tsx
<Separator />
```

Use sparingly between major sections. Rows use `border-b border-border/20 dark:border-border/40` instead.

For inline dividers within cards:
```tsx
<div className="pt-3 border-t border-border/20 dark:border-border/40">
```

---

## Loading & Error States

```tsx
{/* Loading */}
<DialogContent className="sm:max-w-md p-6 bg-card border border-border/40 rounded-2xl">
  <DialogTitle className="sr-only">Loading</DialogTitle>
  <div className="space-y-4">
    <Skeleton className="h-20 w-full rounded-xl bg-muted/50" />
    <Skeleton className="h-32 w-full rounded-xl bg-muted/50" />
  </div>
</DialogContent>

{/* Error */}
<DialogContent className="sm:max-w-md p-6 bg-card border border-border/40 rounded-2xl">
  <DialogTitle className="sr-only">Error</DialogTitle>
  <div className="text-center text-muted-foreground py-10">
    Unable to load data.
  </div>
</DialogContent>
```

---

## Do's and Don'ts

### Do's

- Use `bg-card` for dialog backgrounds (on DialogContent)
- Use `bg-muted/30 dark:bg-muted/50` for info containers inside dialogs
- Use `bg-card` for nested containers inside muted parents (contrast layering)
- Use `border-border/20 dark:border-border/40` for subtle borders
- Color only icons when active, not containers
- Use `font-mono` for numbers and labels
- Keep labels quiet with `text-muted-foreground` (no opacity for readability)
- Use hover states for text + border color on buttons
- Always pair light mode opacity with dark mode equivalents
- Test dialogs in both light and dark themes before shipping
- Use `space-y-*` on parent containers for consistent vertical rhythm

### Don'ts

- Never use shadows (`shadow-*` classes)
- Never use gradients on backgrounds
- Never color entire cards/containers when active
- Never use flashy/vibrant backgrounds
- Never use `hover:bg-*` on CTA buttons (use text + border instead)
- Never use full opacity borders (`border-border` without opacity)
- Never forget dark mode variants for opacity-based classes
- Never use the same opacity in dark mode as light mode (increase by ~20%)
- **Never reverse opacity values** - light mode uses LOWER opacity (30%), dark mode uses HIGHER (50%). Using `bg-muted/50 dark:bg-muted/40` is wrong and causes poor contrast
- **Never use the same background on nested containers** - if parent is `bg-muted`, child must be `bg-card` (and vice versa) to create visible contrast

---

## CSS Variables Reference

```css
/* Brand Colors */
--color-glow-orange: #ffb472;
--color-glow-green: #ccffd4;
--color-miner: #2081e2;
--color-miner-contrast: #2081e2;
--delegation-purple: #a855f7;

/* Semantic Colors */
--background: /* page background */
--card: /* dialog/card background */
--muted: /* subtle backgrounds */
--border: /* borders */
--foreground: /* primary text */
--muted-foreground: /* secondary text */
```

---

## Example Component Structure

### Info/Breakdown Dialog

```tsx
export function ExampleDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-[24px] bg-card border border-border/40">
        {/* Header */}
        <div className="border-b border-border/40 pb-6 pt-8 px-6">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            Title
          </DialogTitle>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="max-h-[65vh]">
          <div className="p-5 space-y-8">
            {/* Info Card */}
            <div className="rounded-xl bg-muted/30 dark:bg-muted/50 border border-border/20 dark:border-border/40 p-4">
              <span className="text-xs font-mono text-muted-foreground/60 dark:text-muted-foreground/80 uppercase tracking-widest">
                Label
              </span>
            </div>
          </div>
        </ScrollArea>

        {/* Optional Footer */}
        <div className="border-t border-border/40 p-4">
          <Button className="w-full">Action</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Swap/Transaction Dialog

```tsx
export function SwapDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden bg-card rounded-[24px] border border-border/40">
        {/* Compact Header */}
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 dark:text-muted-foreground/80">
            Swap Tokens
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="px-5 pb-5">
          <div className="space-y-1">
            {/* From Section */}
            <div className="bg-muted/30 dark:bg-muted/50 rounded-3xl p-4 border border-border/20 dark:border-border/40">
              <span className="text-xs font-medium text-muted-foreground">You pay</span>
              {/* Input */}
            </div>

            {/* Swap Direction */}
            <div className="relative py-2">
              <button className="bg-card border-2 border-border/30 rounded-full p-2">
                <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* To Section */}
            <div className="bg-muted/30 dark:bg-muted/50 rounded-3xl p-4 border border-border/20 dark:border-border/40">
              <span className="text-xs font-medium text-muted-foreground">You receive</span>
              {/* Output */}
            </div>

            {/* Transaction Details */}
            <div className="mt-4 bg-muted/30 dark:bg-muted/50 rounded-xl p-4 border border-border/20 dark:border-border/40">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Network Fee</span>
                <span className="text-sm font-medium">~$0.06</span>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-5">
              <Button className="w-full h-12">SWAP</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```
