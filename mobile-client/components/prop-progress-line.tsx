import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const FILL_HEIGHT = 10;
const BUBBLE_SIZE = 28;
const HIT_COLOR = '#24d169';
const MISS_COLOR = '#e53935';
const WARN_COLOR = '#ffc107'; // Yellow when one of pace/avg is under target

/** Distance of oval labels from the track (negative = above, positive = below) */
const OVAL_TOP_OFFSET = -14; // On-pace oval: distance above track (further up to reduce overlap)
const OVAL_BOTTOM_TOP_OFFSET = 14; // Avg proj oval: distance below track (further down to reduce overlap)

/** TEMP: Set to true to overlap all labels at the same position for visual comparison */
const OVERRIDE_SAME_POSITION = false;

export type PropProgressLineProps = {
  currentValue: number;
  line: number;
  direction: 'over' | 'under';
  seasonAvg?: number;
  projectedValue?: number | null;
  averageProjectedValue?: number | null;
  statLabel: string;
  colorScheme: 'light' | 'dark';
  isGameOver?: boolean;
};

const VALUE_OVAL_WIDTH = 44; // Wide enough for "30.4", "68.6", etc. without wrapping

/** Target is fixed at this position (%). Values below target use 0-80%; above target use 80-100% with compression. */
const TARGET_POSITION_PCT = 80;

/** Max value above target for the overflow zone (80-100%). Values above target + this fraction cap at 100%. */
const OVERFLOW_RANGE_MULTIPLIER = 0.5; // target to target*1.5 maps to 80-100%

const FADE_OPACITY_WHEN_GAME_OVER = 0;

const MARKER_ANIM_DURATION = 350;
const EASE_OUT = Easing.out(Easing.cubic);

export const PropProgressLine = memo(function PropProgressLine({
  currentValue,
  line,
  direction,
  seasonAvg,
  projectedValue,
  averageProjectedValue,
  statLabel,
  colorScheme,
  isGameOver = false,
}: PropProgressLineProps) {
  const colors = Colors[colorScheme];

  const linePct = TARGET_POSITION_PCT; // Target always at fixed position

  const toPercent = (val: number): number => {
    if (val <= 0) return 0;
    if (val <= line) {
      return (val / line) * TARGET_POSITION_PCT;
    }
    const overflowMax = line * (1 + OVERFLOW_RANGE_MULTIPLIER);
    const overflowPct = Math.min(1, (val - line) / (overflowMax - line));
    return TARGET_POSITION_PCT + overflowPct * (100 - TARGET_POSITION_PCT);
  };

  const currentPct = toPercent(currentValue);
  const seasonAvgPct = seasonAvg != null ? toPercent(seasonAvg) : null;
  const projectedPct = OVERRIDE_SAME_POSITION
    ? linePct
    : projectedValue != null
      ? toPercent(projectedValue)
      : null;
  const averageProjectedPct = OVERRIDE_SAME_POSITION
    ? linePct
    : averageProjectedValue != null
      ? toPercent(averageProjectedValue)
      : null;
  const displayProjected = OVERRIDE_SAME_POSITION ? line : projectedValue;
  const displayAvgProj = OVERRIDE_SAME_POSITION ? line : averageProjectedValue;

  const isHit =
    direction === 'over'
      ? currentValue >= Math.ceil(line)
      : currentValue <= Math.floor(line);

  const paceBelowTarget =
    projectedValue != null &&
    (direction === 'over' ? projectedValue < line : projectedValue > line);
  const averageBelowTarget =
    averageProjectedValue != null &&
    (direction === 'over'
      ? averageProjectedValue < line
      : averageProjectedValue > line);
  const bothBelowTarget = paceBelowTarget && averageBelowTarget;
  const oneBelowTarget = paceBelowTarget !== averageBelowTarget; // XOR: exactly one
  const fillColor =
    projectedValue != null || averageProjectedValue != null
      ? bothBelowTarget
        ? MISS_COLOR
        : oneBelowTarget
          ? WARN_COLOR
          : HIT_COLOR
      : isHit
        ? HIT_COLOR
        : MISS_COLOR;

  const glowOpacity = useSharedValue(0.1);
  const currentPctShared = useSharedValue(currentPct);
  const projectedPctShared = useSharedValue(projectedPct ?? 0);
  const averageProjectedPctShared = useSharedValue(averageProjectedPct ?? 0);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    currentPctShared.value = withTiming(currentPct, {
      duration: MARKER_ANIM_DURATION,
      easing: EASE_OUT,
    });
  }, [currentPct]);

  useEffect(() => {
    projectedPctShared.value = withTiming(projectedPct ?? 0, {
      duration: MARKER_ANIM_DURATION,
      easing: EASE_OUT,
    });
  }, [projectedPct]);

  useEffect(() => {
    averageProjectedPctShared.value = withTiming(averageProjectedPct ?? 0, {
      duration: MARKER_ANIM_DURATION,
      easing: EASE_OUT,
    });
  }, [averageProjectedPct]);

  const fillAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return { opacity: glowOpacity.value };
  });

  const fillWidthStyle = useAnimatedStyle(() => {
    'worklet';
    return { width: `${currentPctShared.value}%` };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      left: `${currentPctShared.value}%`,
      marginLeft: -BUBBLE_SIZE / 2,
    };
  });

  const projectedOvalStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      left: `${projectedPctShared.value}%`,
      marginLeft: -VALUE_OVAL_WIDTH / 2,
    };
  });

  const projectedTickStyle = useAnimatedStyle(() => {
    'worklet';
    return { left: `${projectedPctShared.value}%` };
  });

  const averageProjectedOvalStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      left: `${averageProjectedPctShared.value}%`,
      marginLeft: -VALUE_OVAL_WIDTH / 2,
    };
  });

  const averageProjectedTickStyle = useAnimatedStyle(() => {
    'worklet';
    return { left: `${averageProjectedPctShared.value}%` };
  });

  const PACE_COLOR = '#ff9800';
  const AVG_PROJ_COLOR = '#fff';
  const fadedOpacity = isGameOver ? FADE_OPACITY_WHEN_GAME_OVER : 1;

  return (
    <View style={[styles.container, { position: 'relative' }]}>
      {/* Top: pace value (on pace) in oval */}
      {(OVERRIDE_SAME_POSITION || projectedValue != null) &&
        projectedPct != null &&
        projectedPct > 0 &&
        projectedPct <= 100 && (
          <Animated.View
            style={[
              styles.valueOval,
              styles.valueOvalTop,
              {
                backgroundColor: PACE_COLOR,
                zIndex: 2,
                opacity: fadedOpacity,
              },
              projectedOvalStyle,
            ]}>
            <ThemedText style={styles.valueOvalText} numberOfLines={1}>
              {(displayProjected ?? line) % 1 === 0
                ? (displayProjected ?? line).toFixed(0)
                : (displayProjected ?? line).toFixed(1)}
            </ThemedText>
          </Animated.View>
        )}
      <View style={[styles.track, { backgroundColor: colors.border + '60' }]}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: fillColor },
            fillWidthStyle,
            fillAnimatedStyle,
          ]}
          collapsable={false}
        />
        {linePct > 0 && linePct < 100 && (
          <>
            <View
              style={[styles.tickTarget, { left: `${linePct}%`, opacity: fadedOpacity }]}
            />
            <View
              style={[
                styles.labelAtTarget,
                {
                  left: `${linePct}%`,
                  marginLeft: -20,
                  top: FILL_HEIGHT + 12,
                  opacity: fadedOpacity,
                },
              ]}>
              <ThemedText style={[styles.labelLeft, { color: colors.secondaryText }]}>
                {Math.round(line).toString()}
              </ThemedText>
            </View>
          </>
        )}
        {averageProjectedPct != null &&
          averageProjectedPct > 0 &&
          averageProjectedPct <= 100 && (
            <>
              <Animated.View
                style={[
                  styles.tickAverageProjected,
                  { zIndex: 1, opacity: fadedOpacity },
                  averageProjectedTickStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.valueOval,
                  styles.valueOvalBottom,
                  {
                    backgroundColor: AVG_PROJ_COLOR,
                    borderColor: colors.border,
                    zIndex: 1,
                    opacity: fadedOpacity,
                  },
                  averageProjectedOvalStyle,
                ]}>
                <ThemedText
                  style={[styles.valueOvalText, { color: '#000' }]}
                  numberOfLines={1}>
                  {(displayAvgProj ?? line) % 1 === 0
                    ? (displayAvgProj ?? line).toFixed(0)
                    : (displayAvgProj ?? line).toFixed(1)}
                </ThemedText>
              </Animated.View>
            </>
          )}
        {projectedPct != null && projectedPct > 0 && projectedPct <= 100 && (
          <Animated.View
            style={[
              styles.tickProjected,
              { zIndex: 2, opacity: fadedOpacity },
              projectedTickStyle,
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
              zIndex: 10,
            },
            bubbleStyle,
          ]}>
          <ThemedText style={[styles.bubbleText, { color: colors.text }]}>
            {currentValue % 1 === 0 ? currentValue.toFixed(0) : currentValue.toFixed(1)}
          </ThemedText>
        </Animated.View>
      </View>
      {/* Bottom: 0 label */}
      <View style={[styles.labelsRow, { position: 'relative' }]}>
        <ThemedText style={[styles.labelLeft, { color: colors.secondaryText }]}>
          0
        </ThemedText>
      </View>
      <View style={[styles.legend, { borderColor: colors.border }]}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} />
          <ThemedText style={[styles.legendText, { color: colors.secondaryText }]}>Current</ThemedText>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendTickTarget} />
          <ThemedText style={[styles.legendText, { color: colors.secondaryText }]}>Target</ThemedText>
        </View>
        {averageProjectedValue != null && (
          <View style={styles.legendRow}>
            <View style={styles.legendTickAverageProjected} />
            <ThemedText style={[styles.legendText, { color: colors.secondaryText }]}>Avg proj</ThemedText>
          </View>
        )}
        {projectedValue != null && (
          <View style={styles.legendRow}>
            <View style={styles.legendTickProjected} />
            <ThemedText style={[styles.legendText, { color: colors.secondaryText }]}>On pace</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
    paddingTop: 22,
    overflow: 'visible',
  },
  track: {
    height: FILL_HEIGHT,
    borderRadius: FILL_HEIGHT / 2,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: FILL_HEIGHT / 2,
  },
  tickTarget: {
    position: 'absolute',
    top: -3,
    bottom: -10,
    width: 3,
    marginLeft: -1.5,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  tickSeasonAvg: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#2196F3',
    borderRadius: 1,
  },
  tickAverageProjected: {
    position: 'absolute',
    top: -2,
    bottom: -18, // Extends down to connect with avg proj oval (further down)
    width: 2,
    marginLeft: -1,
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  tickProjected: {
    position: 'absolute',
    top: -18, // Extends up to connect with on-pace oval (further up)
    bottom: -2,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#ff9800',
    borderRadius: 1,
  },
  valueOval: {
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  valueOvalTop: {
    position: 'absolute',
    top: OVAL_TOP_OFFSET,
    width: VALUE_OVAL_WIDTH,
    minWidth: VALUE_OVAL_WIDTH,
  },
  valueOvalBottom: {
    position: 'absolute',
    top: FILL_HEIGHT + OVAL_BOTTOM_TOP_OFFSET,
    width: VALUE_OVAL_WIDTH,
    minWidth: VALUE_OVAL_WIDTH,
  },
  valueOvalText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  bubble: {
    position: 'absolute',
    top: -BUBBLE_SIZE / 2 + FILL_HEIGHT / 2,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
    minHeight: 28,
  },
  labelLeft: {
    fontSize: 11,
  },
  labelAtTarget: {
    position: 'absolute',
    width: 40,
    alignItems: 'center',
  },
  labelRight: {
    fontSize: 11,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  legendTickTarget: {
    width: 12,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendTickSeasonAvg: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#2196F3',
  },
  legendTickAverageProjected: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  legendTickProjected: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#ff9800',
  },
  legendText: {
    fontSize: 10,
  },
});
