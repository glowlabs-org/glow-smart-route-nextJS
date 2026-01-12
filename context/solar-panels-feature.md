# ☀️ Feature Spec: The Solar Collector (Gamification v2)

## 1. Core Experience Loop (The Hook)

We are building a **Dopamine Habit Loop** based on the "Collector" archetype.

1.  **Trigger (External):** Twitter/Discord: _"⚡ New Solar Farm Detected in Colorado!"_
2.  **Action:** User opens the app.
3.  **Variable Reward (The "Drop"):** User sees exactly how many Watts they captured based on their **Impact Score**. It varies based on their performance relative to others.
4.  **Investment:** The Watts fill a "Ghost Panel." If it hits 400W, a permanent Panel is minted. The user feels ownership and wants to maintain their Streak to capture more next time.

---

## 2. Visual Metaphors & "Juice"

_Refining the UI based on the study's emphasis on immediate, sensory feedback._

### A. The "Ghost Panel" (Progress Bar)

_Principle: The Goal-Gradient Effect. Users are more motivated as they get closer to the goal._

- **State 1: Empty (0W)** → A faint, gray wireframe of a solar panel.
- **State 2: Filling (1-399W)** → The panel fills from bottom-to-top with a liquid/energy animation (Gradient: `Glow Yellow` to `Glow Orange`).
  - _Animation:_ When new Watts are added, the bar doesn't just jump; it "surges" up with a glow effect.
- **State 3: Completed (400W)** → **"Juicy" Moment.**
  - _Visual:_ The panel flashes bright `Glow White`, solidifies into the full artwork, and emits a small confetti burst of sun rays.
  - _Haptic:_ A distinct vibration (mobile).
  - _Sound:_ A satisfying "thud-click" or "charge-up" sound.

### B. The Streak Flame (Loss Aversion)

_Principle: Loss Aversion. "Don't break the chain."_

- **Visual:** A Flame Icon (`impact-streak.svg`) next to the Score.
- **States:**
  - **Active (Buying/Staking):** Bright Orange/Red, animated (pulsing).
  - **At Risk:** Dimmed, flickering.
  - **Frozen:** Icy blue (if we implement a freeze mechanic later).
- **Copy:** Instead of just "4 Weeks," use "4 Week Streak! (3x Power Active)."

---

## 3. UI Mockups (ASCII)

### A. Dashboard Widget (The "Tamagotchi" View)

_Placed at the top of the App Dashboard. High visibility._

```text
+-----------------------------------------------------------------------+
|  SOLAR COLLECTOR                                    [ 🔥 4 Wk Streak ]|
+-----------------------------------------------------------------------+
|                                                                       |
|   [ PREVIOUS ]      [ CURRENT GOAL: PANEL #12 ]      [ NEXT ]         |
|                                                                       |
|     +---+              +-------------------+           +---+          |
|     |///|              |                   |           |   |          |
|     |///|              |    Liquid Fill    |           |   |          |
|     |///|              |    Animation      |           |   |          |
|     |///|              |   ( 320 / 400 W ) |           |   |          |
|     +---+              +-------------------+           +---+          |
|    Panel #11             ^                             Ghost          |
|                          |                                            |
|                  "80 Watts to completion!"                            |
|                                                                       |
+-----------------------------------------------------------------------+
|  RECENT DROP                                                          |
|  ⚡ Captured 55 Watts from "Sunrise CO" (Yesterday)                   |
|                                                                       |
|  [ View World Grid > ]                                                |
+-----------------------------------------------------------------------+
```

### B. The "Drop" Modal (Celebration)

_Triggered when a user logs in after a new farm is finalized. This leverages the "Reward of the Hunt."_

```text
+-------------------------------------------------------+
|                                                       |
|           ⚡  NEW FARM CAPTURED!  ⚡                  |
|                                                       |
|            "Effervescent Hollow (CO)"                 |
|             has joined the network.                   |
|                                                       |
|           Your Score: 45,000 (Top 10%)                |
|                                                       |
|             + 215 WATTS ADDED                         |
|                                                       |
|      [ Animation: Watts fly into the Ghost Panel ]    |
|                                                       |
|    [=========================>      ] 85%             |
|                                                       |
|   "You are 60 Watts away from your next Panel!"       |
|                                                       |
|          [ Awesome ]   [ Share to X ]                 |
|                                                       |
+-------------------------------------------------------+
```

### C. World Grid (The Collection)

_The "Trophy Room." Organized by Region to show conquest._

```text
+-----------------------------------------------------------------------+
|  YOUR SOLAR GRID                                     Total: 12 Panels |
+-----------------------------------------------------------------------+
|  IMPACT EQUIVALENT (Meaningful Analogies)                             |
|  🌲 45 Trees Planted    🏠 3 Homes Powered    🚗 2 Cars off road      |
+-----------------------------------------------------------------------+
|                                                                       |
|  REGION: COLORADO (Your Stronghold)                                   |
|  Status: 8 Panels owned                                               |
|                                                                       |
|  [#] [#] [#] [#] [#] [#] [#] [#] [..Ghost..]                          |
|   ^                                                                   |
|   Hover: "Minted Jan 12 via Sunrise Farm"                             |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  REGION: INDIA                                                        |
|  Status: 4 Panels owned                                               |
|                                                                       |
|  [#] [#] [#] [#] [Ghost]                                              |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 4. Technical Logic Updates

### Data Structures

**1. The "Ghost" Calculator**
We need a derived state on the frontend that calculates the "fill" of the current panel.

```typescript
const WATTS_PER_PANEL = 400;

function getGhostState(totalWatts: number) {
  const completedPanels = Math.floor(totalWatts / WATTS_PER_PANEL);
  const currentGhostWatts = totalWatts % WATTS_PER_PANEL;
  const fillPercentage = (currentGhostWatts / WATTS_PER_PANEL) * 100;

  return { completedPanels, currentGhostWatts, fillPercentage };
}
```

**2. The "Drop" Event Queue**
To ensure users see the celebration modal, we need to track if they have "seen" a farm drop.

- **DB:** `User_Farm_Interaction` table (or similar).
- **Logic:** When user logs in, check `Farms` where `Date_Added > Last_Login`.
- **Action:** If `true`, trigger the **Drop Modal** overlay immediately. This ensures the "Variable Reward" isn't missed.

### Visual Assets & Colors

_Reference: `glow-colors.md` & `glow-icons.md`_

1.  **Ghost Panel Fill:**
    - Use **Glow Orange** (`#ffb472`) for the liquid fill to represent captured energy/sunlight.
    - Background of the empty panel should be **Glow Medium Grey** (`#f3f3f3`).
2.  **Streak Flame:**
    - Use **Glow Orange** (`#ffb472`) with a subtle CSS drop-shadow glow.
3.  **Completed Panel:**
    - Use **Glow Blue** (the Miner Blue `#2081e2`) or a new "Solar Blue" to signify a permanent, cold-storage asset. (Alternatively, keep it Orange/Yellow to stay on the "Sun" theme, but ensure high contrast).

---

## 5. Summary of "Juicy" Interventions

1.  **Don't just update the number:** Animate the number counting up.
2.  **Don't just show a list of farms:** Show a "Card" for the new farm that slides in.
3.  **Don't just show a static streak:** Make the flame pulse. Warn the user if they are about to lose it (Loss Aversion).
4.  **Meaningful Analogies:** Always keep the "Trees/Homes" conversion visible near the total panel count to satisfy Intrinsic Motivation.
