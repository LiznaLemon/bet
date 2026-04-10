import { PlayerAvatar } from '@/components/player-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Platform, StyleSheet, View } from 'react-native';

/** Top inset above the circular avatar (must match `styles.avatarTopInset`). */
export const PLAYER_AVATAR_STAT_CHIP_TOP_INSET = 0;
/** Pixels the chip overlaps the bottom of the headshot in flow layout. */
const CHIP_OVERLAP_PX = 4;

export function playerAvatarStatChipLayoutHeight(avatarSize: number) {
  return PLAYER_AVATAR_STAT_CHIP_TOP_INSET + avatarSize;
}

export type PlayerAvatarWithStatChipProps = {
  uri?: string | null;
  avatarSize?: number;
  /**
   * Text in the pill overlapping the bottom of the avatar (e.g. "24.5 PPG", "+3").
   * Omit or pass null/empty to show only the avatar.
   */
  chipLabel?: string | null;
  /**
   * `outlined` — bordered pill with card background (player list / props picker).
   * `filled` — solid pill (e.g. scoring delta on play-by-play).
   */
  chipVariant?: 'outlined' | 'filled';
  /** Used when `chipVariant` is `filled` (defaults to theme `scoreWinner`). */
  chipBackgroundColor?: string;
  chipTextColor?: string;
  colorScheme: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  avatarStyle?: StyleProp<ViewStyle>;
  /** Merged onto the overlapping pill (e.g. `minWidth`, extra padding). */
  chipStyle?: StyleProp<ViewStyle>;
  chipTextStyle?: StyleProp<TextStyle>;
  /**
   * `flow` — chip sits in layout (default; used on player cards / prop picker).
   * `overlay` — chip is absolutely positioned so this column’s height is only the headshot
   *   (top inset + diameter). Lets a sibling row align to the avatar without the chip stretching it.
   */
  chipLayout?: 'flow' | 'overlay';
};

/**
 * Avatar with a stat / label chip that overlaps the bottom of the headshot,
 * matching the `long` layout pattern in {@link PlayerCard}.
 */
export function PlayerAvatarWithStatChip({
  uri,
  avatarSize = 48,
  chipLabel,
  chipVariant = 'outlined',
  chipBackgroundColor,
  chipTextColor = '#FFFFFF',
  colorScheme,
  style,
  avatarStyle,
  chipStyle,
  chipTextStyle,
  chipLayout = 'flow',
}: PlayerAvatarWithStatChipProps) {
  const colors = Colors[colorScheme];
  const trimmed = chipLabel?.trim() ?? '';
  const showChip = trimmed.length > 0;

  const chipBg =
    chipVariant === 'filled'
      ? (chipBackgroundColor ?? colors.scoreWinner)
      : colors.cardBackground;
  const chipBorder =
    chipVariant === 'outlined'
      ? { borderWidth: 1, borderColor: colors.border }
      : { borderWidth: 0 };
  const labelColor =
    chipVariant === 'filled' ? chipTextColor : colors.text;

  const chipInner = showChip ? (
    <View
      style={[
        styles.chip,
        chipLayout === 'overlay' && styles.chipOverlayFlowDetach,
        chipBorder,
        { backgroundColor: chipBg },
        chipStyle,
      ]}>
      <ThemedText
        style={[
          styles.chipText,
          { color: labelColor },
          Platform.OS === 'android' ? styles.chipTextAndroid : null,
          chipTextStyle,
        ]}
        {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}>
        {trimmed}
      </ThemedText>
    </View>
  ) : null;

  if (chipLayout === 'overlay') {
    const measureH = playerAvatarStatChipLayoutHeight(avatarSize);
    const chipTop = PLAYER_AVATAR_STAT_CHIP_TOP_INSET + avatarSize - CHIP_OVERLAP_PX;
    return (
      <View style={[styles.column, style]}>
        <View style={[styles.overlayMeasureBox, { width: avatarSize, height: measureH }]}>
          <PlayerAvatar
            uri={uri}
            size={avatarSize}
            style={[styles.avatarTopInset, avatarStyle]}
          />
          {chipInner != null ? (
            <View
              style={[styles.chipOverlaySlot, { top: chipTop }]}
              pointerEvents="box-none">
              <View style={styles.chipOverlayInner}>{chipInner}</View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.column, style]}>
      <PlayerAvatar
        uri={uri}
        size={avatarSize}
        style={[styles.avatarTopInset, avatarStyle]}
      />
      {chipInner}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  avatarTopInset: {
    marginTop: PLAYER_AVATAR_STAT_CHIP_TOP_INSET,
  },
  overlayMeasureBox: {
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
  },
  chipOverlaySlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  /** `alignItems: 'center'` so the pill keeps intrinsic width; default stretch was forcing full slot width and fighting flex on the chip. */
  chipOverlayInner: {
    maxWidth: '140%',
    alignItems: 'center',
  },
  chipOverlayFlowDetach: {
    marginTop: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -CHIP_OVERLAP_PX,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    // Override ThemedText `default` lineHeight (24) so flex centering in short pills works.
    lineHeight: 18,
  },
  chipTextAndroid: {
    textAlignVertical: 'center',
  },
});
