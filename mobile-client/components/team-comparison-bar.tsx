import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

type TeamComparisonBarProps = {
  label: string;
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  leftColor?: string;
  rightColor?: string;
  /** Max value for bar scaling. If not provided, uses max(left, right) * 1.1 */
  maxValue?: number;
  /** When true, values are percentages (0-100) for scaling */
  isPercent?: boolean;
  /** When true, lower value gets the green highlight (e.g. Turnovers). Default: higher wins */
  lowerIsBetter?: boolean;
  /** Min diff to count as "significant". When provided: yellow = significant, green = minor. When omitted: green for any better. */
  significanceThreshold?: number;
};

const MINOR_WIN_BG_COLOR = '#24d1692e';
const SIGNIFICANT_WIN_BG_COLOR = '#24d1696e';

export const TeamComparisonBar = memo(function TeamComparisonBar({
  label,
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  leftColor,
  rightColor,
  maxValue: maxValueProp,
  isPercent = false,
  lowerIsBetter = false,
  significanceThreshold,
}: TeamComparisonBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const left = leftColor ?? '#e53935';
  const right = rightColor ?? '#2196F3';

  const maxVal =
    maxValueProp ??
    (isPercent ? 100 : Math.max(leftValue, rightValue, 1) * 1.1);
  const leftPct = Math.min(1, Math.max(0, leftValue / maxVal));
  const rightPct = Math.min(1, Math.max(0, rightValue / maxVal));

  const leftWins =
    lowerIsBetter ? leftValue < rightValue : leftValue > rightValue;
  const rightWins =
    lowerIsBetter ? rightValue < leftValue : rightValue > leftValue;

  const diff = Math.abs(leftValue - rightValue);
  const isSignificant =
    significanceThreshold != null && diff >= significanceThreshold;
  const getWinBgColor = () => {
    if (significanceThreshold == null) return MINOR_WIN_BG_COLOR;
    return isSignificant ? SIGNIFICANT_WIN_BG_COLOR : MINOR_WIN_BG_COLOR;
  };
  const winBgColor = getWinBgColor();

  return (
    <View style={styles.row}>
      <View style={[styles.valueWrapper, styles.valueWrapperLeft]}>
        <View
          style={[
            styles.valueInner,
            leftWins && { backgroundColor: winBgColor },
          ]}
        >
          <ThemedText style={[styles.value, styles.leftValue]} numberOfLines={1}>
            {leftLabel}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.barTrack, styles.barTrackLeft, { backgroundColor: colors.border + '60' }]}>
        <View
          style={[
            styles.barFill,
            { width: `${leftPct * 100}%`, backgroundColor: left },
          ]}
        />
      </View>
      <ThemedText style={[styles.label, { color: colors.secondaryText }]} numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={[styles.barTrack, styles.barTrackRight, { backgroundColor: colors.border + '60' }]}>
        <View
          style={[
            styles.barFill,
            { width: `${rightPct * 100}%`, backgroundColor: right },
          ]}
        />
      </View>
      <View style={[styles.valueWrapper, styles.valueWrapperRight]}>
        <View
          style={[
            styles.valueInner,
            rightWins && { backgroundColor: winBgColor },
          ]}
        >
          <ThemedText style={[styles.value, styles.rightValue]} numberOfLines={1}>
            {rightLabel}
          </ThemedText>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
    width: '100%'
  },
  valueWrapper: {
    width: 50,
  },
  valueWrapperLeft: {
    alignItems: 'flex-start',
  },
  valueWrapperRight: {
    alignItems: 'flex-end',
  },
  valueInner: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    // width: '100%',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
  },
  leftValue: {
    textAlign: 'left',
  },
  rightValue: {
    textAlign: 'right',
  },
  barTrack: {
    width: 65,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barTrackLeft: {
    justifyContent: 'flex-end',
    // borderWidth: 1,
    // borderColor: 'yellow'
  },
  barTrackRight: {
    justifyContent: 'flex-start',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
    textAlign: 'center',
  },
});
