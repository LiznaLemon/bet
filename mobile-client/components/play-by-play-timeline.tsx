import {
  PlayerAvatarWithStatChip,
  playerAvatarStatChipLayoutHeight,
} from '@/components/player-avatar-with-stat-chip';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import type { GameBoxScore } from '@/lib/queries/game-boxscores';
import type { PlayByPlayRecord } from '@/lib/queries/play-by-play';
import {
  getGameProgress01,
  playIndexFromProgress01,
} from '@/lib/utils/live-stats';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const THUMB_MIN_WIDTH = 32;
const TRACK_HEIGHT = 8;
/** Vertical padding around the 8px bar — touch target without reserving a full 44px layout row. */
const TRACK_HIT_PADDING_V = 10;
/** ~half visual height of clock pill; centers pill on the padded track row. */
const CLOCK_PILL_CENTER_OFFSET = 12;
const PLAY_ROW_AVATAR_SIZE = 48;

export type PlayByPlayTimelineProps = {
  plays: PlayByPlayRecord[];
  playIndex: number;
  onPlayIndexChange: (index: number) => void;
  clockDisplay: string | null;
  colorScheme: 'light' | 'dark';
  getPlayDescriptionWithActor: (
    play: PlayByPlayRecord & { play_text?: string }
  ) => string;
  playerMap: Map<string, GameBoxScore & { game_log?: unknown[] }>;
  athleteToTeam: Map<string, string>;
  awayTeamAbbrev: string;
  homeTeamAbbrev: string;
  isLiveMode: boolean;
};

/** Roster full name for `athlete_id_1`, if known. */
function actorDisplayNameForPlay(
  play: PlayByPlayRecord,
  playerMap: Map<string, GameBoxScore & { game_log?: unknown[] }>
): string | null {
  const aid = play.athlete_id_1;
  if (aid == null) return null;
  const p = playerMap.get(String(aid)) ?? playerMap.get(String(Number(aid)));
  const n = p?.athlete_display_name?.trim();
  return n || null;
}

/**
 * When `getPlayDescriptionWithActor` returns `Full Name — play`, drop the prefix for the secondary row
 * (primary already shows the full name). Only matches a leading exact roster name + dash separator.
 */
function stripLeadingActorDescription(text: string, fullName: string | null): string {
  const t = text.trim();
  const name = fullName?.trim();
  if (!name || !t) return t;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\s*[\\u2014\\u2013\\-]\\s*(.*)$`);
  const m = t.match(re);
  if (m) return m[1].trim();
  return t;
}

function primaryLineForPlay(
  play: PlayByPlayRecord,
  playerMap: Map<string, GameBoxScore & { game_log?: unknown[] }>,
  athleteToTeam: Map<string, string>,
  awayAbbrev: string,
  homeAbbrev: string
): string {
  const aid = play.athlete_id_1;
  if (aid != null) {
    const key = String(aid);
    const p =
      playerMap.get(key) ?? playerMap.get(String(Number(aid)));
    if (p?.athlete_display_name) {
      return p.athlete_display_name.trim();
    }
    const team =
      athleteToTeam.get(key) ?? athleteToTeam.get(String(Number(aid)));
    if (team) return team;
  }
  return `${awayAbbrev} · ${homeAbbrev}`;
}

/**
 * Visual for plays with no `athlete_id_1`. ESPN often omits athlete on team rebounds
 * and some turnovers; those are not clock stoppages — avoid the pause icon there.
 */
function nonPlayerPlayVisual(
  play: PlayByPlayRecord,
  description: string
): 'period-end' | 'pause' | 'basketball' {
  const d = description.toLowerCase();
  const type = (play.type_text ?? '').toLowerCase();
  const typeCompact = type.replace(/\s+/g, '');

  if (
    d.includes('end period') ||
    d.includes('end of period') ||
    (d.includes('end of') && d.includes('quarter')) ||
    typeCompact.includes('endperiod') ||
    typeCompact.includes('endofperiod')
  ) {
    return 'period-end';
  }

  const isClockStoppage =
    type.includes('timeout') ||
    d.includes('timeout') ||
    type.includes('challenge') ||
    d.includes('challenge') ||
    type.includes('replay center') ||
    type.includes('coach\'s challenge') ||
    type.includes('instant replay');

  if (isClockStoppage) {
    return 'pause';
  }

  return 'basketball';
}

export function PlayByPlayTimeline({
  plays,
  playIndex,
  onPlayIndexChange,
  clockDisplay,
  colorScheme,
  getPlayDescriptionWithActor,
  playerMap,
  athleteToTeam,
  awayTeamAbbrev,
  homeTeamAbbrev,
  isLiveMode,
}: PlayByPlayTimelineProps) {
  const colors = Colors[colorScheme];
  const [trackWidth, setTrackWidth] = useState(0);

  const currentPlay = plays[playIndex];
  const hasOt = useMemo(() => plays.some((p) => p.period_number > 4), [plays]);

  const progress = useMemo(
    () => getGameProgress01(plays, playIndex),
    [plays, playIndex]
  );

  const applyScrubX = useCallback(
    (x: number) => {
      if (trackWidth <= 0 || plays.length === 0) return;
      const p = Math.min(1, Math.max(0, x / trackWidth));
      const next = playIndexFromProgress01(plays, p);
      if (isLiveMode) {
        const liveEnd = plays.length - 1;
        onPlayIndexChange(Math.min(next, liveEnd));
      } else {
        onPlayIndexChange(next);
      }
    },
    [trackWidth, plays, onPlayIndexChange, isLiveMode]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => plays.length > 1,
        onMoveShouldSetPanResponder: () => plays.length > 1,
        onPanResponderGrant: (e) => applyScrubX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => applyScrubX(e.nativeEvent.locationX),
      }),
    [applyScrubX, plays.length]
  );

  const onTrackLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const thumbLeft =
    trackWidth > 0
      ? Math.min(
          Math.max(0, progress * trackWidth - THUMB_MIN_WIDTH / 2),
          trackWidth - THUMB_MIN_WIDTH
        )
      : 0;

  const headshotUri =
    currentPlay?.athlete_id_1 != null
      ? playerMap.get(String(currentPlay.athlete_id_1))?.athlete_headshot_href ??
        playerMap.get(String(Number(currentPlay.athlete_id_1)))
          ?.athlete_headshot_href
      : null;

  const primary = currentPlay
    ? primaryLineForPlay(
        currentPlay,
        playerMap,
        athleteToTeam,
        awayTeamAbbrev,
        homeTeamAbbrev
      )
    : '';
  const secondaryRaw = currentPlay
    ? getPlayDescriptionWithActor(
        currentPlay as PlayByPlayRecord & { play_text?: string }
      )
    : '';

  const actorFullName = currentPlay
    ? actorDisplayNameForPlay(currentPlay, playerMap)
    : null;
  const secondary = stripLeadingActorDescription(secondaryRaw, actorFullName);

  const showScoreBadge =
    currentPlay?.scoring_play &&
    currentPlay.score_value != null &&
    currentPlay.score_value > 0;

  const hasPlayActor = currentPlay.athlete_id_1 != null;
  const eventSlotHeight = playerAvatarStatChipLayoutHeight(PLAY_ROW_AVATAR_SIZE);
  const noPlayerVisual =
    !hasPlayActor && currentPlay ? nonPlayerPlayVisual(currentPlay, secondaryRaw) : null;

  if (!currentPlay) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.playRow}>
        {hasPlayActor ? (
          <PlayerAvatarWithStatChip
            uri={headshotUri}
            avatarSize={PLAY_ROW_AVATAR_SIZE}
            chipLabel={showScoreBadge ? `+${currentPlay.score_value}` : null}
            chipVariant={showScoreBadge ? 'filled' : 'outlined'}
            chipBackgroundColor={colors.scoreWinner}
            colorScheme={colorScheme}
            chipLayout="overlay"
            style={styles.avatarCol}
            chipStyle={styles.scoreChip}
            chipTextStyle={styles.scoreChipText}
          />
        ) : noPlayerVisual === 'period-end' ? (
          <View style={[styles.gameEventSlot, { height: eventSlotHeight, borderColor: colors.border }]}>
            <ThemedText style={[styles.periodEndQuarterLabel, { color: colors.text }]}>
              Q{currentPlay.period_number}
            </ThemedText>
            <View
              style={[
                styles.periodEndCheckCircle,
                { backgroundColor: colors.scoreWinner },
              ]}>
              <MaterialIcons name="check" size={10} color="#fff" />
            </View>
          </View>
        ) : noPlayerVisual === 'pause' ? (
          <View style={[styles.gameEventSlot, { height: eventSlotHeight, borderColor: colors.border }]}>
            <MaterialIcons name="pause" size={30} color={colors.text} />
          </View>
        ) : (
          <View style={[styles.gameEventSlot, { height: eventSlotHeight, borderColor: colors.border }]}>
            <MaterialIcons name="sports-basketball" size={30} color={colors.text} />
          </View>
        )}
        <View style={[styles.textCol, { height: eventSlotHeight }]}>
          <ThemedText
            style={[styles.primaryText, { color: colors.text }]}
            numberOfLines={1}>
            {primary}
          </ThemedText>
          <ThemedText
            style={[styles.secondaryText, { color: colors.textSecondary }]}
            numberOfLines={2}>
            {secondary}
          </ThemedText>
        </View>
      </View>

      <View style={styles.timelineStack}>
        <View style={styles.trackBlock} onLayout={onTrackLayout}>
          <View
            style={styles.trackHit}
            {...panResponder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Game timeline"
            accessibilityValue={{
              text: `Play ${playIndex + 1} of ${plays.length}, ${clockDisplay ?? ''}`,
            }}>
            <View
              style={[
                styles.trackBg,
                {
                  height: TRACK_HEIGHT,
                  backgroundColor: colors.chartBackground,
                },
              ]}>
              <View
                style={[
                  styles.trackFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: colors.scoreWinner,
                  },
                ]}
              />
            </View>
          </View>
          {trackWidth > 0 ? (
            <View
              style={[
                styles.clockPill,
                {
                  left: thumbLeft,
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                },
              ]}
              pointerEvents="none">
              <ThemedText style={[styles.clockPillText, { color: colors.text }]}>
                {clockDisplay ?? '—'}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.labelsUnderTrack}>
          <View style={styles.labelsRow}>
            {[1, 2, 3, 4].map((q) => (
              <View key={q} style={styles.labelQuarterSegment}>
                <ThemedText style={[styles.quarterLabel, { color: colors.textSecondary }]}>
                  Q{q}
                </ThemedText>
              </View>
            ))}
          </View>
          {hasOt ? (
            <ThemedText style={[styles.quarterLabel, styles.otLabel, { color: colors.textSecondary }]}>
              OT
            </ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  playRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCol: {
    alignSelf: 'flex-start',
  },
  gameEventSlot: {
    width: PLAY_ROW_AVATAR_SIZE,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 48,
  },
  periodEndQuarterLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  periodEndCheckCircle: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 16,
    height: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * Pill container only — flex/height/padding apply here. Text metrics go in `scoreChipText`.
   * RN ignores `bottom` unless `position: 'absolute'`; nudge with `transform: [{ translateY: 4 }]`.
   */
  scoreChip: {
    minWidth: 48,
    paddingHorizontal: 12,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    transform: [{ translateY: -4 }],
  },
  /** Merged after base chip text styles; use for fontSize, lineHeight, letterSpacing, etc. */
  scoreChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  labelsUnderTrack: {
    position: 'relative',
    width: '100%',
    /** Air above the parent section’s bottom border (`game-live-view` `styles.section`). */
    paddingBottom: 12,
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  labelQuarterSegment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  quarterLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  otLabel: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  timelineStack: {
    width: '100%',
    transform: [{ translateY: 10 }],
  },
  /** Track + clock pill share width; pill is absolutely positioned over the bar. */
  trackBlock: {
    position: 'relative',
    width: '100%',
  },
  clockPill: {
    position: 'absolute',
    top: '50%',
    zIndex: 1,
    transform: [{ translateY: -CLOCK_PILL_CENTER_OFFSET }],
    minWidth: THUMB_MIN_WIDTH,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  trackHit: {
    justifyContent: 'center',
    width: '100%',
    paddingVertical: TRACK_HIT_PADDING_V,
  },
  trackBg: {
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
  },
});
