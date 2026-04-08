import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Returns an Animated.Value that:
 * - Snaps to 0 whenever `dep` changes (content is being replaced)
 * - Fades to 1 (over `inDuration` ms) whenever `isReady` is true
 *
 * Both effects include `dep` in their dependency arrays so that switching to a
 * cached date (where `isReady` never goes false→true) still triggers a fade-in.
 *
 * Usage:
 *   const opacity = useFadeTransition(selectedDate, !isLoading && !isFetching);
 *   <Animated.View style={{ opacity }}> ... </Animated.View>
 */
export function useFadeTransition(
  dep: unknown,
  isReady: boolean,
  inDuration = 220
): Animated.Value {
  const opacity = useRef(new Animated.Value(isReady ? 1 : 0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevDep = useRef(dep);
  const isFirstRun = useRef(true);

  // Effect 1 (runs first): cut to 0 when dep changes
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (prevDep.current !== dep) {
      prevDep.current = dep;
      animRef.current?.stop();
      opacity.setValue(0);
    }
  }, [dep, opacity]);

  // Effect 2 (runs second): fade in when ready.
  // `dep` is included so this re-runs on every date change — even when isReady
  // stays true the whole time (cached data), ensuring the fade-in always fires
  // after effect 1 has cut opacity to 0.
  useEffect(() => {
    if (isReady) {
      animRef.current?.stop();
      animRef.current = Animated.timing(opacity, {
        toValue: 1,
        duration: inDuration,
        useNativeDriver: true,
      });
      animRef.current.start();
    } else {
      animRef.current?.stop();
      opacity.setValue(0);
    }
  }, [isReady, dep, opacity, inDuration]);

  return opacity;
}
