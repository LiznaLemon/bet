import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import type { ScheduleGame } from '@/lib/types';
import { isTeamOnBackToBack } from '@/lib/utils/date';
import { StyleSheet, View } from 'react-native';

/** Parse YYYY-MM-DD as local date */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format game time in the user's local timezone for upcoming games; fall back to status string (e.g. "Final") for completed ones. */
function formatLocalGameTime(game: ScheduleGame): string | null {
  if (game.completed || !game.gameDateTime) return game.gameTime;
  const d = new Date(game.gameDateTime);
  if (isNaN(d.getTime())) return game.gameTime;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Format date for display (e.g. "Today at 7:00 PM") */
function formatDateLabel(game: ScheduleGame): string {
  const dateStr = game.gameDate;
  if (!dateStr) return game.gameTime || 'TBD';
  const d = parseLocalDate(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  let label: string;
  if (d.toDateString() === today.toDateString()) label = 'Today';
  else if (d.toDateString() === tomorrow.toDateString()) label = 'Tomorrow';
  else label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = formatLocalGameTime(game);
  if (game.completed) return timeStr ? `${label} - ${timeStr}` : label;
  return timeStr ? `${label} at ${timeStr}` : label;
}

/** Ensure we only display a clean record string (e.g. "21-42"), never raw JSON/objects. */
function formatRecordForDisplay(record: string | null | undefined): string | null {
  if (record == null) return null;
  if (typeof record !== 'string') return null;
  const trimmed = record.trim();
  if (/^\d+-\d+$/.test(trimmed)) return trimmed;
  return null;
}

function TeamRecordRow({
  record,
  isB2B,
  colors,
}: {
  record: string | null | undefined;
  isB2B: boolean;
  colors: { textSecondary: string; icon?: string; chipBackgroundMuted: string; chipText: string };
}) {
  const displayRecord = formatRecordForDisplay(record);
  const recordColor = colors.icon ?? colors.textSecondary;
  return (
    <View style={styles.recordColumn}>
      {displayRecord ? (
        <ThemedText style={[styles.recordText, { color: recordColor }]}>{displayRecord}</ThemedText>
      ) : null}
      {isB2B && (
        <View style={[styles.b2bBadge, { backgroundColor: colors.chipBackgroundMuted }]}>
          <ThemedText style={[styles.b2bBadgeText, { color: colors.chipText }]}>back to back</ThemedText>
        </View>
      )}
    </View>
  );
}

export function GameMatchupDisplay({
  game,
  colorScheme,
  scheduleGames,
  liveLabel,
  scoreLayout = 'spread',
}: {
  game: ScheduleGame;
  colorScheme: 'light' | 'dark';
  scheduleGames?: ScheduleGame[];
  /** When set, replaces the date/time label with a live-game indicator. */
  liveLabel?: string;
  /** `centered`: away – home grouped in the middle (e.g. live tab). Default `spread` for schedule cards. */
  scoreLayout?: 'spread' | 'centered';
}) {
  const colors = Colors[colorScheme];
  const showScores =
    game.completed &&
    game.homeScore != null &&
    game.awayScore != null;
  const awayWon = showScores && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWon = showScores && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const isTie = showScores && (game.awayScore ?? 0) === (game.homeScore ?? 0);
  const enrichedGame =
    scheduleGames?.find((g) => g.id === game.id) ??
    scheduleGames?.find((g) => g.gameId === game.id);
  const awayB2B =
    game.awayBackToBack ??
    enrichedGame?.awayBackToBack ??
    (scheduleGames ? isTeamOnBackToBack(game.awayTeamAbbrev, game.gameDate, scheduleGames) : false);
  const homeB2B =
    game.homeBackToBack ??
    enrichedGame?.homeBackToBack ??
    (scheduleGames ? isTeamOnBackToBack(game.homeTeamAbbrev, game.gameDate, scheduleGames) : false);
  const awayRecord =
    formatRecordForDisplay(game.awayRecord) != null ? game.awayRecord : enrichedGame?.awayRecord ?? null;
  const homeRecord =
    formatRecordForDisplay(game.homeRecord) != null ? game.homeRecord : enrichedGame?.homeRecord ?? null;

  const seriesHeadline = game.seriesHeadline ?? null;

  return (
    <>
      <View style={styles.headerTop}>
        {liveLabel ? (
          <View style={styles.liveLabelRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.statusLive }]} />
            <ThemedText style={[styles.dateLabel, styles.liveLabelText, { color: colors.statusLive }]}>{liveLabel}</ThemedText>
          </View>
        ) : (
          <ThemedText style={styles.dateLabel}>{formatDateLabel(game)}</ThemedText>
        )}
        {seriesHeadline ? (
          <ThemedText style={[styles.seriesHeadline, { color: colors.textSecondary }]}>
            {seriesHeadline}
          </ThemedText>
        ) : null}
      </View>
      {showScores ? (
        <View
          style={[
            styles.previousScoreRow,
            scoreLayout === 'centered' && styles.previousScoreRowCentered,
          ]}>
          <View
            style={[
              styles.previousScoreSide,
              styles.previousScoreColumn,
              scoreLayout === 'centered' && styles.previousScoreSideCentered,
            ]}>
            <ThemedText
              style={[
                styles.previousScoreText,
                awayWon && { color: colors.scoreWinner },
                !awayWon && !isTie && { color: colors.scoreLoser },
              ]}
              numberOfLines={1}>
              {game.awayScore}
            </ThemedText>
            <ThemedText style={[styles.previousScoreTeamName, { color: colors.scoreTeamLabel }]}>
              {game.awayTeamAbbrev}
            </ThemedText>
            <TeamRecordRow record={awayRecord} isB2B={awayB2B} colors={colors} />
          </View>
          <View style={[styles.atWrapper, scoreLayout === 'centered' && styles.atWrapperCentered]}>
            <ThemedText style={[styles.scoreDash, styles.previousScoreDash, { color: colors.textSecondary }]}>–</ThemedText>
          </View>
          <View
            style={[
              styles.previousScoreSide,
              styles.previousScoreColumn,
              scoreLayout === 'centered' && styles.previousScoreSideCentered,
            ]}>
            <ThemedText
              style={[
                styles.previousScoreText,
                homeWon && { color: colors.scoreWinner },
                !homeWon && !isTie && { color: colors.scoreLoser },
              ]}
              numberOfLines={1}>
              {game.homeScore}
            </ThemedText>
            <ThemedText style={[styles.previousScoreTeamName, { color: colors.scoreTeamLabel }]}>
              {game.homeTeamAbbrev}
            </ThemedText>
            <TeamRecordRow record={homeRecord} isB2B={homeB2B} colors={colors} />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.previousScoreRow,
            scoreLayout === 'centered' && styles.previousScoreRowCentered,
          ]}>
          <View
            style={[
              styles.previousScoreSide,
              styles.previousScoreColumn,
              scoreLayout === 'centered' && styles.previousScoreSideCentered,
            ]}>
            <ThemedText style={[styles.previousScoreText, { color: colors.scoreTeamLabel }]}>{game.awayTeamAbbrev}</ThemedText>
            <TeamRecordRow record={awayRecord} isB2B={awayB2B} colors={colors} />
          </View>
          <View style={[styles.atWrapper, scoreLayout === 'centered' && styles.atWrapperCentered]}>
            <ThemedText style={[styles.scoreDash, styles.previousScoreDash, { color: colors.textSecondary }]}>–</ThemedText>
          </View>
          <View
            style={[
              styles.previousScoreSide,
              styles.previousScoreColumn,
              scoreLayout === 'centered' && styles.previousScoreSideCentered,
            ]}>
            <ThemedText style={[styles.previousScoreText, { color: colors.scoreTeamLabel }]}>{game.homeTeamAbbrev}</ThemedText>
            <TeamRecordRow record={homeRecord} isB2B={homeB2B} colors={colors} />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    marginBottom: 8,
  },
  liveLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveLabelText: {},
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  seriesHeadline: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  previousScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  previousScoreRowCentered: {
    justifyContent: 'center',
    gap: 20,
  },
  previousScoreSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  previousScoreSideCentered: {
    flex: 0,
    flexShrink: 0,
    alignItems: 'center',
  },
  previousScoreColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  recordColumn: {
    marginTop: 2,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    minHeight: 36,
  },
  recordText: {
    textAlign: 'center',
    fontSize: 14,
  },
  b2bBadge: {
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  b2bBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  previousScoreTeamName: {
    marginTop: 0,
    fontWeight: '700',
    fontSize: 14,
  },
  previousScoreText: {
    fontSize: 40,
    fontWeight: '800',
    minWidth: 48,
    lineHeight: 48,
    textAlign: 'center',
  },
  atWrapper: {
    alignSelf: 'flex-start',
  },
  atWrapperCentered: {
    alignSelf: 'center',
  },
  scoreDash: {
    fontSize: 16,
    fontWeight: '700',
    paddingTop: 12,
  },
  previousScoreDash: {
    fontSize: 16,
    fontWeight: '700',
  },
});
