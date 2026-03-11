import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@/constants/theme';

import { ThemedText } from './themed-text';

const INSIGHT_ANIM_DURATION = 320;
const INSIGHT_TRANSITION_OFFSET = 5;
const INSIGHT_TIMER_SIZE = 24;
const INSIGHT_TIMER_STROKE = 2;
const INSIGHT_TIMER_R = (INSIGHT_TIMER_SIZE - INSIGHT_TIMER_STROKE) / 2;
const INSIGHT_TIMER_CIRCUMFERENCE = 2 * Math.PI * INSIGHT_TIMER_R;
const INSIGHT_PAUSE_ICON_SIZE = 14;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function InsightCarousel({
  insights,
  style,
  cycleDurationMs = 5000,
}: {
  insights: string[];
  style?: object;
  cycleDurationMs?: number;
}) {
  const colorScheme = useColorScheme();
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(1);
  const countdownProgress = useSharedValue(1);
  const isFadingIn = useSharedValue(1);

  const cycleToNextRef = useRef<() => void>(() => {});
  const triggerCycleToNext = useCallback(() => {
    cycleToNextRef.current();
  }, []);

  const advanceToNext = useCallback(() => {
    setIndex((i) => (i + 1) % insights.length);
    isFadingIn.value = 1;
    progress.value = withTiming(1, { duration: INSIGHT_ANIM_DURATION });
    countdownProgress.value = 1;
    countdownProgress.value = withTiming(0, { duration: cycleDurationMs, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(triggerCycleToNext)();
    });
  }, [insights.length, cycleDurationMs, triggerCycleToNext]);

  const cycleToNext = useCallback(() => {
    if (insights.length <= 1) return;
    isFadingIn.value = 0;
    progress.value = withTiming(0, { duration: INSIGHT_ANIM_DURATION }, (finished) => {
      if (finished) runOnJS(advanceToNext)();
    });
  }, [insights.length, advanceToNext]);

  cycleToNextRef.current = cycleToNext;

  const resumeCountdown = useCallback(
    (currentProgress: number) => {
      if (currentProgress <= 0) return;
      const remainingMs = currentProgress * cycleDurationMs;
      countdownProgress.value = withTiming(
        0,
        { duration: remainingMs, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(triggerCycleToNext)();
        }
      );
    },
    [cycleDurationMs, triggerCycleToNext]
  );

  const startCountdown = useCallback(() => {
    countdownProgress.value = 1;
    countdownProgress.value = withTiming(0, { duration: cycleDurationMs, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(triggerCycleToNext)();
    });
  }, [cycleDurationMs, triggerCycleToNext]);

  const handlePressIn = useCallback(() => {
    if (insights.length <= 1) return;
    cancelAnimation(countdownProgress);
  }, [insights.length]);

  const handlePressOut = useCallback(() => {
    if (insights.length <= 1) return;
    runOnUI(() => {
      'worklet';
      const current = countdownProgress.value;
      runOnJS(resumeCountdown)(current);
    })();
  }, [insights.length, resumeCountdown]);

  useEffect(() => {
    if (insights.length <= 1) return;
    startCountdown();
  }, [insights.length, startCountdown]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = 1 - progress.value;
    const translateY = isFadingIn.value ? t * INSIGHT_TRANSITION_OFFSET : -t * INSIGHT_TRANSITION_OFFSET;
    return {
      opacity: progress.value,
      transform: [{ translateY }],
    };
  });

  const circleAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: INSIGHT_TIMER_CIRCUMFERENCE * (1 - countdownProgress.value),
  }));

  const timerColor = colorScheme === 'dark' ? Colors.dark.secondaryText : Colors.light.secondaryText;

  if (insights.length === 0) return null;

  return (
    <View style={[styles.insightCarousel, style]}>
      <Pressable
        style={styles.insightCarouselRow}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel="Insight"
        accessibilityHint="Hold to pause cycling">
        {insights.length > 1 && (
          <View style={styles.insightTimerContainer}>
            <Svg width={INSIGHT_TIMER_SIZE} height={INSIGHT_TIMER_SIZE} style={styles.insightTimerSvg}>
              <Circle
                cx={INSIGHT_TIMER_SIZE / 2}
                cy={INSIGHT_TIMER_SIZE / 2}
                r={INSIGHT_TIMER_R}
                stroke={timerColor}
                strokeWidth={INSIGHT_TIMER_STROKE}
                fill="transparent"
                strokeOpacity={0.25}
              />
              <AnimatedCircle
                cx={INSIGHT_TIMER_SIZE / 2}
                cy={INSIGHT_TIMER_SIZE / 2}
                r={INSIGHT_TIMER_R}
                stroke={timerColor}
                strokeWidth={INSIGHT_TIMER_STROKE}
                fill="transparent"
                strokeDasharray={INSIGHT_TIMER_CIRCUMFERENCE}
                transform={`rotate(-90 ${INSIGHT_TIMER_SIZE / 2} ${INSIGHT_TIMER_SIZE / 2})`}
                animatedProps={circleAnimatedProps}
              />
            </Svg>
            <View style={styles.insightTimerPauseIcon} pointerEvents="none">
              <MaterialIcons
                name="pause"
                size={INSIGHT_PAUSE_ICON_SIZE}
                color={timerColor}
                style={{ opacity: 0.6 }}
              />
            </View>
          </View>
        )}
        <View style={styles.insightCarouselContent}>
          <Animated.View style={animatedStyle}>
            <ThemedText style={styles.insightCarouselText} lightColor="#666" darkColor="#999">
              {insights[index]}
            </ThemedText>
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  insightCarousel: {
    minHeight: 36,
    marginTop: 10,
    overflow: 'hidden',
  },
  insightCarouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
  },
  insightCarouselContent: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  insightTimerContainer: {
    position: 'relative',
    width: INSIGHT_TIMER_SIZE,
    height: INSIGHT_TIMER_SIZE,
    flexShrink: 0,
  },
  insightTimerSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  insightTimerPauseIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCarouselText: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.85,
  },
});
