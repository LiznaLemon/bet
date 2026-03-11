# MiniBarChart Intro Animation Plan

## Overview
Animate bars from 0 to their final height when the user navigates to the Players tab, using `react-native-reanimated`.

---

## Implementation Checklist

### Phase 1: MiniBarChart Component
- [x] Add `animationTrigger` prop to MiniBarChart
- [x] Replace bar `View` with Reanimated `Animated.View`
- [x] Add `useSharedValue` and `useAnimatedStyle` for each bar's height
- [x] Trigger animation when `animationTrigger` changes (useEffect)
- [x] Use `withSpring` for smooth animation

### Phase 2: Players Tab
- [x] Use `useFocusEffect` to detect when tab is focused
- [x] Pass `animationTrigger` to PlayerCard/MiniBarChart on every tab focus *(testing: run every time)*
- [ ] ~~Track "has animated" with useRef for session-only behavior~~ *(deferred: will implement when user requests)*

### Phase 3: Testing & Polish
- [x] Animate only when items enter viewport (onViewableItemsChanged)
- [x] Memoize renderPlayer with useCallback
- [x] Add getItemLayout for scroll performance
- [x] FlatList tuning (initialNumToRender, windowSize, removeClippedSubviews)
- [x] Switch from withSpring to withTiming + Easing.out
- [ ] Update to run once per session when user confirms *(deferred)*

---

## Technical Notes

**Reanimated APIs:**
- `useSharedValue` - holds animated values
- `useAnimatedStyle` - derives styles from shared values
- `withSpring` - spring-based animation
- `Animated.View` - Reanimated's animated View

**Animation approach:** Each bar animates from 0% to target height % using shared value + animated style.

---

## Current Status
- **Testing mode:** Animation runs every time user navigates to Players tab
- **Production mode:** Will run once per session (to be implemented when requested)
