import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const BAR_STAGGER_DELAY_MS = 25;
const BAR_ANIMATION_DURATION_MS = 400;
const LABEL_FADE_DURATION_MS = 250;
const BAR_GAP = 3;

// Scrollable chart styling — adjust to customize
const SCROLL_EDGE_GRADIENT_WIDTH = 24; // Width of fade at left/right edges
const SCROLL_INDICATOR_STYLE = 'default' as const; // 'default' | 'black' | 'white' (iOS)
const INITIAL_OVERSCROLL_RIGHT = 10; // px to overscroll right initially, obscuring left edge to suggest scrollability

export type MiniBarChartProps = {
  data: number[];
  colorScheme: 'light' | 'dark';
  chartHeight?: number;
  numYAxisLabels?: number;
  useGradient?: boolean;
  /** When this value changes, bars animate from 0 to their final height. Pass a changing value (e.g. from useFocusEffect) to trigger animation. */
  animationTrigger?: number;
  /** When true, show bars at full height immediately (no animation). Use when remounting recycled list items. */
  skipAnimation?: boolean;
  /** Called when the intro animation completes. Use to avoid re-animating on list item remount. */
  onAnimationComplete?: () => void;
  /** Optional x-axis labels rendered below bars, one per bar. Uses same flex layout for alignment. */
  xAxisLabels?: string[];
  /** When true, chart is horizontally scrollable with fixed bar width. Use for large datasets (e.g. full season). */
  scrollable?: boolean;
  /** Fixed width per bar in px when scrollable. Default 16. */
  barWidth?: number;
  /** When set, the last N bars (and values) are highlighted; bars outside this range use dimmed opacity. */
  highlightLastN?: number;
};

export const MiniBarChart = memo(function MiniBarChart({
  data,
  colorScheme,
  chartHeight = 90,
  numYAxisLabels = 4,
  useGradient = false,
  animationTrigger,
  skipAnimation = false,
  onAnimationComplete,
  xAxisLabels,
  scrollable = false,
  barWidth: barWidthProp = 16,
  highlightLastN,
}: MiniBarChartProps) {
  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const valueLabelFontSize = 10;
  // Reserve space above bars for value labels (font + line height + headroom for tall bars)
  const valueLabelHeadroom = valueLabelFontSize + 8;
  const barAreaHeight = chartHeight - valueLabelHeadroom;

  const barCount = data.length;
  const totalDurationMs = Math.max(
    (barCount - 1) * BAR_STAGGER_DELAY_MS +
      BAR_ANIMATION_DURATION_MS +
      LABEL_FADE_DURATION_MS,
    1,
  );

  const useAnimation =
    !scrollable &&
    !skipAnimation &&
    (animationTrigger ?? 0) > 0;
  const showImmediately = scrollable || skipAnimation || animationTrigger == null;
  const masterProgress = useSharedValue(showImmediately ? 1 : 0);

  useEffect(() => {
    if (useAnimation) {
      masterProgress.value = 0;
      masterProgress.value = withTiming(
        1,
        {
          duration: totalDurationMs,
          easing: Easing.linear,
        },
        (finished) => {
          'worklet';
          if (finished && onAnimationComplete) {
            runOnJS(onAnimationComplete)();
          }
        },
      );
    } else if (showImmediately) {
      masterProgress.value = 1;
    }
    // animationTrigger === 0 means pending — leave masterProgress at 0
  }, [animationTrigger, useAnimation, showImmediately]);

  const fixedBarWidth = scrollable ? barWidthProp : undefined;
  const contentWidth = scrollable
    ? barCount * barWidthProp + (barCount - 1) * BAR_GAP
    : undefined;

  const { width: screenWidth } = useWindowDimensions();
  const viewportWidth = screenWidth - 48;
  const initialScrollX =
    scrollable && contentWidth != null && contentWidth > viewportWidth
      ? contentWidth - viewportWidth + INITIAL_OVERSCROLL_RIGHT
      : 0;

  const chartContent = (
    <View style={contentWidth != null ? { width: contentWidth } : undefined}>
        <View
          style={[
            styles.chartContainer,
            {
              height: chartHeight,
              paddingTop: valueLabelHeadroom,
              borderBottomWidth: 1,
              borderBottomColor: Colors[colorScheme].border,
              ...(contentWidth != null && { width: contentWidth }),
            },
          ]}
      >
        <View
          style={[
            styles.barsContainer,
            contentWidth != null && { width: contentWidth },
          ]}>
          {data.map((value, index) => {
            const barHeightPx = ((value - minValue) / range) * barAreaHeight;
            const barHeightPercent = (barHeightPx / barAreaHeight) * 100;
            const isHighlighted =
              highlightLastN == null || index >= data.length - highlightLastN;

            const formattedValue =
              typeof value === 'number' ? value.toFixed(0) : value;

            return (
              <AnimatedBar
                key={index}
                barIndex={index}
                barHeightPx={Math.max(barHeightPx, 2)}
                barHeightPercent={Math.max(barHeightPercent, 0.5)}
                useGradient={useGradient}
                colorScheme={colorScheme}
                masterProgress={masterProgress}
                totalDurationMs={totalDurationMs}
                formattedValue={formattedValue}
                valueLabelFontSize={valueLabelFontSize}
                fixedBarWidth={fixedBarWidth}
                isHighlighted={isHighlighted}
              />
            );
          })}
        </View>
      </View>
      {xAxisLabels && xAxisLabels.length === data.length && (
        <View
          style={[
            styles.xAxisLabelsContainer,
            contentWidth != null && { width: contentWidth },
          ]}>
          {xAxisLabels.map((label, index) => {
            const isHighlighted =
              highlightLastN == null || index >= data.length - highlightLastN;
            return (
              <View
                key={index}
                style={[
                  styles.xAxisLabelWrapper,
                  fixedBarWidth != null && { width: fixedBarWidth, flex: undefined },
                ]}>
                <ThemedText
                  style={[
                    styles.xAxisLabel,
                    !isHighlighted && styles.xAxisLabelDimmed,
                  ]}>
                  {label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const gradientHeight = chartHeight + 36;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollable) {
      // contentOffset is unreliable on Android; scrollTo after layout ensures correct initial position
      const scrollId = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: initialScrollX, y: 0, animated: false });
      });
      const flashId = setTimeout(() => {
        scrollRef.current?.flashScrollIndicators?.();
      }, 100);
      return () => {
        cancelAnimationFrame(scrollId);
        clearTimeout(flashId);
      };
    }
  }, [scrollable, initialScrollX]);

  return (
    <View style={styles.chartWrapper}>
      {scrollable ? (
        <View style={styles.scrollContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
            indicatorStyle={SCROLL_INDICATOR_STYLE}
            persistentScrollbar={Platform.OS === 'android'}
            contentOffset={{ x: initialScrollX, y: 0 }}
            contentContainerStyle={styles.scrollContentOverscroll}
          >
            {chartContent}
          </ScrollView>
          <View
            style={[
              styles.edgeGradientLeft,
              { width: SCROLL_EDGE_GRADIENT_WIDTH, height: gradientHeight },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[Colors[colorScheme].background, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View
            style={[
              styles.edgeGradientRight,
              { width: SCROLL_EDGE_GRADIENT_WIDTH, height: gradientHeight },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['transparent', Colors[colorScheme].background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>
      ) : (
        chartContent
      )}
    </View>
  );
});

const DIMMED_OPACITY = 0.35;

type AnimatedBarProps = {
  barIndex: number;
  barHeightPx: number;
  barHeightPercent: number;
  useGradient: boolean;
  colorScheme: 'light' | 'dark';
  masterProgress: SharedValue<number>;
  totalDurationMs: number;
  formattedValue: string;
  valueLabelFontSize: number;
  fixedBarWidth?: number;
  isHighlighted?: boolean;
};

const AnimatedBar = memo(function AnimatedBar({
  barIndex,
  barHeightPx,
  barHeightPercent,
  useGradient,
  colorScheme,
  masterProgress,
  totalDurationMs,
  formattedValue,
  valueLabelFontSize,
  fixedBarWidth,
  isHighlighted = true,
}: AnimatedBarProps) {
  const barStartNorm = (barIndex * BAR_STAGGER_DELAY_MS) / totalDurationMs;
  const barEndNorm =
    (barIndex * BAR_STAGGER_DELAY_MS + BAR_ANIMATION_DURATION_MS) /
    totalDurationMs;
  const labelStartNorm = barEndNorm;
  const labelEndNorm =
    (barIndex * BAR_STAGGER_DELAY_MS +
      BAR_ANIMATION_DURATION_MS +
      LABEL_FADE_DURATION_MS) /
    totalDurationMs;

  const animatedStyle = useAnimatedStyle(() => {
    const linear = interpolate(
      masterProgress.value,
      [barStartNorm, barEndNorm],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const eased = 1 - Math.pow(1 - linear, 3);
    return { transform: [{ scaleY: eased }] };
  });

  const dimmedOpacity = isHighlighted ? 1 : DIMMED_OPACITY;

  const labelAnimatedStyle = useAnimatedStyle(() => {
    const animOpacity = interpolate(
      masterProgress.value,
      [labelStartNorm, labelEndNorm],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: animOpacity * dimmedOpacity };
  }, [dimmedOpacity]);

  return (
    <View
      style={[
        styles.barWrapper,
        fixedBarWidth != null && { width: fixedBarWidth, flex: undefined },
      ]}
    >
      <Animated.View
        style={[
          styles.barValueContainer,
          { bottom: `${barHeightPercent}%` },
          labelAnimatedStyle,
        ]}>
        <ThemedText
          style={[
            styles.barValue,
            {
              color: Colors[colorScheme].text,
              fontSize: valueLabelFontSize,
            },
          ]}>
          {formattedValue}
        </ThemedText>
      </Animated.View>

      <Animated.View
        style={[
          styles.bar,
          { height: barHeightPx, transformOrigin: '50% 100%', opacity: dimmedOpacity },
          animatedStyle,
        ]}
        collapsable={false}>
        {useGradient ? (
          <LinearGradient
            colors={
              colorScheme === 'dark'
                ? [
                    Colors[colorScheme].barBackground,
                    Colors[colorScheme].background,
                  ]
                : ['#0fc4e8', '#0a7ea4']
            }
            locations={[0, 0.99]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.barFill}
          />
        ) : (
          <View
            style={[
              styles.barFill,
              { backgroundColor: Colors[colorScheme].barBackground },
            ]}
          />
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  chartWrapper: {
    width: '100%',
  },
  scrollContainer: {
    position: 'relative',
    width: '100%',
  },
  scrollContentOverscroll: {
    paddingRight: INITIAL_OVERSCROLL_RIGHT,
  },
  edgeGradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  edgeGradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 100,
    width: '100%',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 3,
  },
  barWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  bar: {
    width: '50%',
    borderRadius: 3,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 2,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  barValueContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
  },
  barValue: {
    fontWeight: '600',
    textAlign: 'center',
  },
  xAxisLabelsContainer: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 8,
    width: '100%',
  },
  xAxisLabelWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  xAxisLabel: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
  },
  xAxisLabelDimmed: {
    opacity: 0.2,
  },
});
