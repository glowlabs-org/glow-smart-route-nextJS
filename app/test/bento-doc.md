# Bento UI Update Plan

## Objective
Improve the user interface of the `GlowSoftDashboard` (`@app/test/bento.tsx`) for the state where the wallet is **not connected**. The goal is to reduce overwhelming UI elements and show relevant "getting started" information.

## Proposed Changes

### 1. Update `@app/test/bento.tsx`

Refactor the grid layout to conditionally render widgets based on `hasWallet` (derived from `walletAddress`).

**Logic:**

*   **Rewards Widget Slot (Grid Position 3):**
    *   *Current:* Always renders `<RewardsWidget />`.
    *   *New:*
        *   If **Connected**: Render `<RewardsWidget />`.
        *   If **Disconnected**: Render `<WeeklyActivityWidget />`.

*   **Solar Farm Widget Slot (Grid Position 4):**
    *   *Current:* Always renders `<SolarFarmWidget />` (wrapped in `col-span-7`).
    *   *New:*
        *   If **Connected**: Render `<SolarFarmWidget />`.
        *   If **Disconnected**: Render `<GlowFaqWidget />`.

*   **GCTL Heatmap Slot (Grid Position 6):**
    *   *Current:* `hasWallet ? <GctlHeatmapWidget /> : <GlowFaqWidget />`.
    *   *New:* Always render `<GctlHeatmapWidget />`.
        *   Reasoning: `GlowFaqWidget` is being moved to the Solar Farm slot. `GctlHeatmapWidget` already handles the disconnected state internally (shows a "Connect your wallet" overlay), so it is safe to display.

*   **Weekly Activity Slot (Grid Position 8):**
    *   *Current:* Always renders `<WeeklyActivityWidget />` at the bottom.
    *   *New:* Only render if **Connected**.
        *   Reasoning: When disconnected, this widget is moved up to the Rewards slot.

### 2. Update `@app/test/widgets/glow-faq-widget.tsx`

The `GlowFaqWidget` currently has a hardcoded grid span of `col-span-12 lg:col-span-9`. This needs to be adjusted to fit the Solar Farm slot (which is `col-span-7`).

*   **Action:** Refactor `GlowFaqWidget` to accept a `className` prop.
*   **Implementation:** Allow the `className` prop to override or merge with the default classes, or remove the default grid class and handle layout control in the parent (`bento.tsx`).

### 3. Verification

*   Verify that when the wallet is **disconnected**:
    *   `RewardsWidget` is hidden.
    *   `WeeklyActivityWidget` appears in the Rewards slot (top row).
    *   `SolarFarmWidget` is hidden.
    *   `GlowFaqWidget` appears in the Solar Farm slot (middle row).
    *   `GctlHeatmapWidget` shows its "Connect Wallet" state.
    *   Duplicate `WeeklyActivityWidget` at the bottom is gone.
*   Verify that when the wallet is **connected**:
    *   All widgets appear in their original positions.
