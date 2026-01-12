# Miner Color Migration Summary

## Date
January 9, 2026

## Change Overview
Updated the miner color from yellow (`#d9f368`) to a modern blue (`#2081e2`, OpenSea Sea Blue) across the entire codebase.

## CSS Variable Changes

### Old Variables (Deprecated)
- `--color-miner-yellow: #d9f368`
- `--color-miner-yellow-contrast: #7a8a12`

### New Variables
- `--color-miner: #2081e2` (OpenSea Sea Blue)
- `--color-miner-contrast: #2081e2`

## Files Updated

### Documentation
1. `.cursor/glow-colors.mdc` - **Created new file**
   - Comprehensive color system documentation
   - Usage guidelines and best practices
   - Migration notes

### Styles
2. `app/globals.css`
   - Updated CSS variables in both light and dark mode
   - Added new `.text-miner` utility class
   - Kept `.text-miner-yellow` as legacy class for backwards compatibility

### Components Updated (14 files)
3. `app/stats/rewards/impact-view.tsx`
4. `app/test/widgets/launchpad-status-widget.tsx`
5. `app/test/widgets/my-farms-grid-section.tsx`
6. `app/test/widgets/solar-farm-widget.tsx`
7. `app/test/widgets/portfolio-summary-widget.tsx`
8. `app/test/widgets/farms-performance-dialog.tsx`
9. `app/test/widgets/weekly-activity-widget.tsx`
10. `app/marketplace/sponsored-farms-activity.tsx`
11. `app/marketplace/launchpad-view.tsx`
12. `app/wallet/recent-activity.tsx`
13. `components/dialogs/impact-score-breakdown-dialog.tsx`
14. `components/impact-score/impact-indicators.tsx`

### Utilities
15. `utils/impact.ts`

## Pattern Replacements

All instances of the following patterns were updated:

1. **CSS Variable References**
   - `var(--color-miner-yellow)` → `var(--color-miner)`
   - `var(--color-miner-yellow-contrast)` → `var(--color-miner-contrast)`

2. **Tailwind Classes**
   - `text-miner-yellow` → `text-miner`
   - `bg-miner-yellow` → `bg-[color:var(--color-miner)]`

## Usage Examples

### Before
```tsx
<div className="text-miner-yellow border-[color:var(--color-miner-yellow)]/30">
  Miner Badge
</div>
```

### After
```tsx
<div className="text-miner border-[color:var(--color-miner)]/30">
  Miner Badge
</div>
```

## Benefits

1. **Modern Aesthetic**: Vibrant blue (`#2081e2`) inspired by OpenSea's Sea Blue provides a contemporary, professional look
2. **Better Visual Distinction**: Blue stands out more clearly from other protocol elements
3. **Improved Hierarchy**: Clear visual separation between miners and delegation (purple)
4. **Excellent Contrast**: Bright blue maintains WCAG AA standards while being visually appealing
5. **Maintainability**: Centralized color definition through CSS variables
6. **Future-Proof**: Easy to update the miner color by changing only the CSS variable

## Backwards Compatibility

The legacy class `.text-miner-yellow` is maintained in `globals.css` and points to the new color variable, ensuring any overlooked references will still work correctly.

## Testing Checklist

- [ ] Visual inspection of miner badges across all pages
- [ ] Check dark mode rendering
- [ ] Verify miner-related UI elements in:
  - [ ] Dashboard widgets
  - [ ] Marketplace launchpad view
  - [ ] Stats pages
  - [ ] Impact score dialogs
  - [ ] Farm performance dialogs
  - [ ] Recent activity views

## Future Updates

To change the miner color in the future, simply update the CSS variable in `app/globals.css`:

```css
:root {
  --color-miner: #YOUR_NEW_COLOR;
  --color-miner-contrast: #YOUR_NEW_COLOR; /* or a contrast variant */
}

.dark {
  --color-miner: #YOUR_NEW_COLOR; /* can be different for dark mode */
  --color-miner-contrast: #YOUR_NEW_COLOR;
}
```

All references throughout the codebase will automatically update.

