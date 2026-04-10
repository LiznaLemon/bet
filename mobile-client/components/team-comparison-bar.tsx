import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Keep Seasonal Breakdown header and bar rows pixel-aligned. */
export const TEAM_COMPARISON_LABEL_COLUMN_WIDTH = 144;
export const TEAM_COMPARISON_ROW_GAP = 6;

type TeamComparisonBarProps = {
  label: string;
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  /** League rank (1 = best) for seasonal breakdown; omit for screens without league context */
  leftRank?: number | null;
  rightRank?: number | null;
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

/** e.g. 1 → "1st", 22 → "22nd" */
export function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export const TeamComparisonBar = memo(function TeamComparisonBar({
  label,
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  leftRank,
  rightRank,
  leftColor,
  rightColor,
  maxValue: maxValueProp,
  isPercent = false,
  lowerIsBetter: _lowerIsBetter = false,
  significanceThreshold: _significanceThreshold,
}: TeamComparisonBarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const left = leftColor ?? '#e53935';
  const right = rightColor ?? '#2196F3';
  /** Matches Seasonal Breakdown header halves (flex:1 + centered). */
  const sideWidth = 104;

  const maxVal =
    maxValueProp ??
    (isPercent ? 100 : Math.max(leftValue, rightValue, 1) * 1.1);
  const leftPct = Math.min(1, Math.max(0, leftValue / maxVal));
  const rightPct = Math.min(1, Math.max(0, rightValue / maxVal));

  return (
    <View style={[styles.row, { gap: TEAM_COMPARISON_ROW_GAP }]}>
      <View style={styles.sideOuter}>
        <View style={{ width: sideWidth }}>
          <View style={styles.valueInner}>
            <ThemedText style={[styles.valueLine, styles.leftValueLine]} numberOfLines={1}>
              {leftRank != null ? (
                <ThemedText style={[styles.rankSuffix, { color: colors.textSecondary }]}>
                  {`${formatOrdinal(leftRank)} • `}
                </ThemedText>
              ) : null}
              {leftLabel}
            </ThemedText>
          </View>
          <View
            style={[
              styles.barTrack,
              styles.barTrackLeft,
              isPercent && { backgroundColor: colors.chartBackground },
            ]}
          >
            <View
              style={[
                styles.barFill,
                { width: `${leftPct * 100}%`, backgroundColor: left },
              ]}
            />
          </View>
        </View>
      </View>
      <ThemedText
        style={[
          styles.label,
          { width: TEAM_COMPARISON_LABEL_COLUMN_WIDTH, color: colors.text },
        ]}
        numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.sideOuter}>
        <View style={{ width: sideWidth }}>
          <View style={styles.valueInner}>
            <ThemedText style={[styles.valueLine, styles.rightValueLine]} numberOfLines={1}>
              {rightLabel}
              {rightRank != null ? (
                <ThemedText style={[styles.rankSuffix, { color: colors.textSecondary }]}>
                  {` • ${formatOrdinal(rightRank)}`}
                </ThemedText>
              ) : null}
            </ThemedText>
          </View>
          <View
            style={[
              styles.barTrack,
              styles.barTrackRight,
              isPercent && { backgroundColor: colors.chartBackground },
            ]}
          >
            <View
              style={[
                styles.barFill,
                { width: `${rightPct * 100}%`, backgroundColor: right },
              ]}
            />
          </View>
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
    width: '100%',
  },
  /** Mirrors Seasonal Breakdown header halves (flex:1; content centered via inner 104px column). */
  sideOuter: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 0,
  },
  valueInner: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 2,
    borderRadius: 4,
  },
  valueLine: {
    fontSize: 11,
    fontWeight: '600',
  },
  rankSuffix: {
    fontSize: 11,
    fontWeight: '500',
  },
  leftValueLine: {
    textAlign: 'right',
  },
  rightValueLine: {
    textAlign: 'left',
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barTrackLeft: {
    justifyContent: 'flex-end',
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
    flexShrink: 0,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
