# Scrollable Season Bar Chart — Implementation Plan

## Goal
Replace the current 5-game-range aggregated season chart with a per-game bar chart that is horizontally scrollable, allowing users to scroll through the full game log.

---

## Current Behavior
- **Season**: `game_log` is chunked into 5-game ranges (1–5, 6–10, …), each bar shows the **average** for that range
- **Last 10 / Last 5**: Per-game values, fixed view (no scroll)
- `MiniBarChart` uses `flex: 1` on bars, so they share width equally within a fixed container

---

## Proposed Behavior
- **Season**: One bar per game, full `game_log` length. Chart has a **fixed content width** (based on number of games × bar width) and is wrapped in a horizontal `ScrollView`
- **Last 10 / Last 5**: Unchanged (small dataset, no scroll needed)
- **Data**: Per-game raw values (no aggregation), chronological order (oldest → newest left-to-right, or vice versa — see UX decision below)

---

## Implementation Approach

### 1. Data Preparation
- **Season**: Use `gameLog.map(g => getStatFromGame(g, chartStat))` directly (no chunking)
- **Order**: `game_log` is newest-first in the JSON. For "scroll to see past games", two options:
  - **Option A**: Oldest on left, newest on right (scroll right to see recent). Matches typical time-axis convention.
  - **Option B**: Newest on left, oldest on right (scroll right to see older). "Past" = scroll right.
- **Labels**: One per game. Options: `"G1"`, `"G2"`, … or `game_date` (e.g. `"Feb 5"`). Dates are more informative but need formatting and may be dense.

### 2. MiniBarChart Modifications
Two approaches:

**Approach A — Wrap in ScrollView (simpler)**
- Add optional prop: `scrollable?: boolean` and `contentWidth?: number`
- When `scrollable === true`, wrap the chart in `ScrollView horizontal` with `contentContainerStyle={{ width: contentWidth }}`
- Chart content width = `barCount * (barWidth + gap)`. Use a fixed `barWidth` (e.g. 16–20px) so total width scales with game count.
- Bars use fixed pixel width instead of `flex: 1` when scrollable.

**Approach B — New scrollable variant**
- Create `ScrollableMiniBarChart` that:
  - Accepts `data`, `xAxisLabels`, `barWidth` (e.g. 16)
  - Renders a `ScrollView` with a fixed-width inner container
  - Reuses bar rendering logic from `MiniBarChart` (or extracts shared logic)

### 3. Bar Width & Layout
- **Fixed bar width**: e.g. 16px per bar, 3px gap → 19px per game
- **82 games**: 82 × 19 ≈ 1,558px content width
- **Initial scroll position**: Consider starting at the right (most recent) so users see latest games first, then scroll left for older. Or start at left (oldest) for chronological reading.

---

## Edge Cases

| Case | Handling |
|------|----------|
| **Empty game_log** | Same as now: `hasData` check, return null |
| **1–2 games** | Chart still renders; scroll is minimal/no-op. Consider disabling scroll or showing a message. |
| **Very long season (82+ games)** | Full scroll, ensure performance (see below) |
| **Switching PTS/REB/AST/MIN** | Same data length, only values change. No extra work. |
| **Switching time period (Season ↔ Last 10)** | Different data source and layout. Season = scrollable, Last 10/5 = fixed. |
| **game_log order** | Confirm: JSON has newest first. Reverse for display if we want oldest-left. |
| **Missing stat in a game** | `getStatFromGame` returns 0 for missing. Already handled. |

---

## Performance Concerns

### 1. **Rendering 80+ bars**
- **Current**: `MiniBarChart` maps over all data and renders each bar. No virtualization.
- **Risk**: 80+ `Animated.View` + `ThemedText` + optional `LinearGradient` can cause:
  - Slow initial render
  - Jank when scrolling (especially on older devices)
- **Mitigations**:
  - **Option 1**: Keep current approach; test on target devices. 80–100 views may be acceptable.
  - **Option 2**: Virtualize with `FlatList` horizontal + `renderItem` for bar groups. Only render visible bars. Requires refactoring `MiniBarChart` to work with `FlatList`.
  - **Option 3**: Reduce bar density — e.g. `barWidth: 12px` so bars are smaller but all fit in a shorter scroll. Less scroll distance, same number of DOM nodes.

### 2. **Animation**
- `totalDurationMs` scales with bar count: `(barCount - 1) * BAR_STAGGER_DELAY_MS + ...`
- For 82 bars: ~2.5s+ stagger. May feel slow.
- **Recommendation**: When `scrollable` and `barCount > 20`, consider:
  - Disabling stagger (all bars animate together), or
  - Capping animation duration (e.g. max 1.5s total)

### 3. **ScrollView inside ScrollView**
- Chart lives inside the main vertical `ScrollView`. Horizontal `ScrollView` inside vertical is supported but can have gesture conflicts.
- **Recommendation**: Use `directionalLockEnabled` or `nestedScrollEnabled` (Android) if needed. Test scroll behavior.

### 4. **Memory**
- `game_log` is already in memory. Per-game data array is small (82 numbers). No concern.

---

## UX Considerations

1. **Scroll direction**: Decide oldest-left vs newest-left. Document in the plan.
2. **Initial position**: Start at right (newest) or left (oldest)?
3. **X-axis labels**: With 80+ games, labels may overlap. Options:
   - Show every Nth label (e.g. every 5th game)
   - Use shorter labels (`"G1"` vs `"Feb 5"`)
   - Hide labels when scrollable, or show in a tooltip/press state
4. **Bar width**: Too narrow and bars are hard to read; too wide and scroll is long. 14–20px is a reasonable range.
5. **Scroll indicator**: Ensure horizontal scroll indicator is visible.

---

## Recommended Implementation Order

1. **Data**: Change season data from `seasonTrend` (chunked) to per-game array. Keep `game_log` order consistent (decide oldest-left or newest-left).
2. **MiniBarChart**: Add `scrollable` and `contentWidth` (or `barWidth`) props. When scrollable, use fixed bar width and wrap in `ScrollView horizontal`.
3. **Player screen**: Pass new season data and scrollable props when `timePeriod === 'season'`.
4. **Animation**: Adjust or disable stagger for large datasets when scrollable.
5. **Labels**: Implement sparse or short labels for scrollable mode.
6. **Testing**: Verify on device with 40+ games; check scroll smoothness and gesture handling.

---

## Files to Modify
- `app/player/[id].tsx` — season data prep, chart props
- `components/mini-bar-chart.tsx` — scrollable mode, fixed bar width, optional animation tweaks
