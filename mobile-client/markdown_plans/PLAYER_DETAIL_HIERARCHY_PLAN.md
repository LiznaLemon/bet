# Player Detail Page – Information Hierarchy Implementation Plan

**Principle:** Order content from most recent → longer term, shorter windows → longer windows.

**Target order:** Trends → Full Breakdown (with time filter) → Splits → Game Log (if applicable)

**Note:** Headline stats (PPG, RPG, APG, FG%, etc.) are combined with Season Averages. The time filter is the differentiator—no separate Overview section.

---

## Current Structure (as of plan creation)

1. Player Header
2. Recent Games Chart (Last 10 Games – points bar chart)
3. Config-driven stat sections (Season Averages, Shooting, Totals)
4. Last 5 / Last 10 (Recent Form cards)
5. Half Splits (First vs Second)
6. Quarter Averages
7. Shot Distribution
8. Clutch Stats
9. Home vs Away
10. Scoring Trend

---

## Target Structure

### 1. Player Header
- *No change.* Identity and team info.

### 2. **TRENDS** (shortest → longest window)
Order: most recent first.

| Order | Section | Data Source | Window |
|-------|---------|-------------|--------|
| 2a | Last 5 Games | `player.last_5` | 5 games |
| 2b | Last 10 Games (bar chart) | `player.game_log` | 10 games |
| 2c | Last 10 Games (summary) | `player.last_10` | 10 games |
| 2d | Scoring Trend | `player.scoring_trend` | Full season by range |

**Implementation notes:**
- Merge or sequence: Last 5 summary card → Last 10 bar chart + summary card → Scoring Trend chart.
- Consider a single "Trends" section with subsections (Last 5, Last 10, Season Trend) to keep hierarchy clear.
- Scoring Trend stays last within Trends (longest window).

### 3. **FULL BREAKDOWN** (by stat category, with time filter)
Config-driven sections. **Time filter applies** to Season Averages and Shooting (per-game stats). Totals remain full-season only.

| Section | Contents | Time filter? |
|---------|----------|--------------|
| Season Averages | PPG, RPG, APG, SPG, BPG, TPG, FPG, MPG | Yes |
| Impact | Plus/Minus | Yes |
| Shooting | FG%, 3PT%, FT%, TS%, made/attempted | Yes |
| Totals | Total points, rebounds, assists, etc. | No (full season) |

**Implementation notes:**
- Headline stats = Season Averages + Shooting. No separate Overview—same stats, filter controls timeframe.
- Games Played: show as sample context (e.g. "42 GP" or "10 GP") near the time filter, not in the stat grid.
- Move Plus/Minus to its own "Impact" row/section.
- Update `player-stats-config.ts` and `resolveStatValue` to accept time-period data (season vs last_10 vs last_5).

### 4. **SPLITS** (contextual performance)
Full season only. Order by usefulness or common patterns.

| Order | Section | Data Source |
|-------|---------|-------------|
| 5a | Home vs Away | `player.home_away_splits` |
| 5b | First Half vs Second Half | `player.half_splits` |
| 5c | Points by Quarter | `player.quarter_averages` |
| 5d | Clutch Performance | `player.clutch_stats` |

### 5. **SHOT DISTRIBUTION**
- At Rim, Midrange, Three-Point, Free Throw.
- Full season only.
- Can live under Shooting or as its own section after Splits.

### 6. **GAME LOG** (future)
- Raw game-by-game list.
- Link or expandable section at bottom.

---

## Implementation Checklist

### Phase 1: Reorder sections
- [x] Move "Last 5 / Last 10" (Recent Form) above config-driven stats.
- [x] Move "Last 10 Games" bar chart above config-driven stats.
- [x] Move "Scoring Trend" up into Trends block (after Last 10).
- [x] Resulting order: Header → Trends block → Full Breakdown → Splits → Shot Distribution.

### Phase 2: Group Trends
- [x] Add "Trends" section title/container.
- [x] Order within Trends: Last 5 → Last 10 (chart + summary) → Scoring Trend.
- [x] Ensure consistent styling for Trends subsections.

### Phase 3: Refine Full Breakdown (combined with headline stats)
- [x] Remove Games Played from Season Averages in config.
- [x] Remove Plus/Minus from Season Averages in config.
- [x] Add "Impact" row/section for Plus/Minus.
- [x] Add Games Played as sample context near time filter (e.g. "42 GP").
- [x] Update `player-stats-config.ts` and `resolveStatValue` as needed.
- [x] *No separate Overview—Season Averages + Shooting serve as headline stats.*

### Phase 4: Add time filter
- [x] Add global time filter UI (Season | Last 10 | Last 5) above Full Breakdown.
- [x] Update `resolveStatValue` to accept period and pull from `player`, `player.last_10`, or `player.last_5`.
- [x] Apply filter to Season Averages, Impact, Shooting. Totals stay full-season.

### Phase 5: Group Splits
- [x] Add "Splits" section title/container.
- [x] Order: Home vs Away → Half Splits → Quarter Averages → Clutch.
- [x] Move Shot Distribution after Splits (or keep under Shooting if preferred).

### Phase 6: Polish
- [x] Consistent section spacing and titles.
- [x] Verify all conditional sections (e.g. clutch when games > 0) still work.
- [ ] Test with players who have minimal data.

---

## File Changes Summary

| File | Changes |
|------|---------|
| `app/player/[id].tsx` | Reorder JSX sections; add Trends/Splits grouping; add time filter UI; adjust layout. |
| `constants/player-stats-config.ts` | Remove `games_played`, `plus_minus` from Season Averages; add Impact section; extend `resolveStatValue` for time periods. |

---

## Progress Log

| Date | Completed | Notes |
|------|-----------|-------|
| 2026-02-17 | Phases 1–6 | Implemented full hierarchy: Trends first, time filter, Splits grouping, Impact section. |
