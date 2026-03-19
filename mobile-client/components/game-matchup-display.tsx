import { ThemedText } from '@/components/themed-text';
import { getTeamColors } from '@/constants/team-colors';
import { Colors } from '@/constants/theme';
import type { ScheduleGame } from '@/lib/types';
import { isTeamOnBackToBack } from '@/lib/utils/date';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// TEMP: set to true to disable team shadow, show plain white text
const USE_PLAIN_WHITE_TEXT = true;

const STROKE_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const SHADOW_OFFSET_X = 5;
const SHADOW_OFFSET_Y = 2;
const SHADOW_SCALE = 0.95;

function TextWithTeamShadow({
  children,
  teamColors,
  baseStyle,
  colors,
}: {
  children: ReactNode;
  teamColors: readonly string[];
  baseStyle: object;
  colors: { text: string };
}) {
  const chars = String(children).split('');
  const palette = teamColors.length > 0 ? [...teamColors] : ['#6b7280'];
  const flat = StyleSheet.flatten(baseStyle as object) as Record<string, unknown>;
  const { minWidth: _, ...charStyle } = flat;
  const style = charStyle as object;

  return (
    <View style={[styles.shadowTextWrap, styles.charRow]}>
      {chars.map((char, i) => {
        const borderColor = palette[i % palette.length];
        return (
          <View key={i} style={styles.charCell}>
            <Text style={[style, styles.charSizer]} numberOfLines={1}>
              {char}
            </Text>
            {STROKE_OFFSETS.map(([dx, dy]) => (
              <Text
                key={`${dx}-${dy}`}
                style={[
                  style,
                  styles.charStroke,
                  {
                    color: borderColor,
                    left: dx + SHADOW_OFFSET_X,
                    top: dy + SHADOW_OFFSET_Y,
                    transform: [{ scale: SHADOW_SCALE }],
                  },
                ]}
                numberOfLines={1}>
                {char}
              </Text>
            ))}
            <Text
              style={[
                style,
                styles.charFill,
                {
                  color: '#000000',
                  left: SHADOW_OFFSET_X,
                  top: SHADOW_OFFSET_Y,
                  transform: [{ scale: SHADOW_SCALE }],
                },
              ]}
              numberOfLines={1}>
              {char}
            </Text>
            <ThemedText style={[style, styles.charTop, { color: colors.text }]} numberOfLines={1}>
              {char}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** Parse YYYY-MM-DD as local date */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format date for display (e.g. "Today at 7:00 PM EDT") */
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
  return game.gameTime ? `${label} at ${game.gameTime}` : label;
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
  colors: { secondaryText: string; icon?: string };
}) {
  const displayRecord = formatRecordForDisplay(record);
  const recordColor = colors.icon ?? colors.secondaryText;
  return (
    <View style={styles.recordColumn}>
      {displayRecord ? (
        <ThemedText style={[styles.recordText, { color: recordColor }]}>{displayRecord}</ThemedText>
      ) : null}
      {isB2B && (
        <View style={styles.b2bBadge}>
          <ThemedText style={styles.b2bBadgeText}>back to back</ThemedText>
        </View>
      )}
    </View>
  );
}

export function GameMatchupDisplay({
  game,
  colorScheme,
  scheduleGames,
}: {
  game: ScheduleGame;
  colorScheme: 'light' | 'dark';
  scheduleGames?: ScheduleGame[];
}) {
  const colors = Colors[colorScheme];
  const showScores =
    game.completed &&
    game.homeScore != null &&
    game.awayScore != null;
  const awayWon = showScores && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWon = showScores && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const isTie = showScores && (game.awayScore ?? 0) === (game.homeScore ?? 0);
  const awayColors = getTeamColors(game.awayTeamAbbrev);
  const homeColors = getTeamColors(game.homeTeamAbbrev);
  const awayB2B =
    game.awayBackToBack ?? (scheduleGames ? isTeamOnBackToBack(game.awayTeamAbbrev, game.gameDate, scheduleGames) : false);
  const homeB2B =
    game.homeBackToBack ?? (scheduleGames ? isTeamOnBackToBack(game.homeTeamAbbrev, game.gameDate, scheduleGames) : false);
  const awayRecord = game.awayRecord ?? null;
  const homeRecord = game.homeRecord ?? null;

  return (
    <>
      <View style={styles.headerTop}>
        <ThemedText style={styles.dateLabel}>{formatDateLabel(game)}</ThemedText>
      </View>
      {showScores ? (
        <View style={styles.previousScoreRow}>
          <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
            {awayWon || isTie ? (
              <ThemedText
                style={[styles.previousScoreText, awayWon && { color: '#24d169' }]}
                numberOfLines={1}>
                {game.awayScore}
              </ThemedText>
            ) : (
              <View style={styles.previousScoreOutlineWrap}>
                {STROKE_OFFSETS.map(([dx, dy]) => (
                  <Text key={`${dx}-${dy}`} style={[styles.previousScoreText, styles.previousScoreOutlineStroke, { left: dx, top: dy }]} numberOfLines={1}>
                    {game.awayScore}
                  </Text>
                ))}
                <ThemedText style={[styles.previousScoreText, styles.previousScoreOutlineFill, { color: colors.background }]} numberOfLines={1}>
                  {game.awayScore}
                </ThemedText>
              </View>
            )}
            <ThemedText style={[styles.previousScoreTeamName, { color: '#ffffff' }]}>
              {game.awayTeamAbbrev}
            </ThemedText>
            <TeamRecordRow record={awayRecord} isB2B={awayB2B} colors={colors} />
          </View>
          <View style={styles.atWrapper}>
            <ThemedText style={[styles.scoreDash, styles.previousScoreDash, { color: colors.secondaryText }]}>–</ThemedText>
          </View>
          <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
            {homeWon || isTie ? (
              <ThemedText
                style={[styles.previousScoreText, homeWon && { color: '#24d169' }]}
                numberOfLines={1}>
                {game.homeScore}
              </ThemedText>
            ) : (
              <View style={styles.previousScoreOutlineWrap}>
                {STROKE_OFFSETS.map(([dx, dy]) => (
                  <Text key={`${dx}-${dy}`} style={[styles.previousScoreText, styles.previousScoreOutlineStroke, { left: dx, top: dy }]} numberOfLines={1}>
                    {game.homeScore}
                  </Text>
                ))}
                <ThemedText style={[styles.previousScoreText, styles.previousScoreOutlineFill, { color: colors.background }]} numberOfLines={1}>
                  {game.homeScore}
                </ThemedText>
              </View>
            )}
            <ThemedText style={[styles.previousScoreTeamName, { color: '#ffffff' }]}>
              {game.homeTeamAbbrev}
            </ThemedText>
            <TeamRecordRow record={homeRecord} isB2B={homeB2B} colors={colors} />
          </View>
        </View>
      ) : (
        <View style={styles.previousScoreRow}>
          <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
            {USE_PLAIN_WHITE_TEXT ? (
              <ThemedText style={[styles.previousScoreText, { color: '#ffffff' }]}>{game.awayTeamAbbrev}</ThemedText>
            ) : (
              <TextWithTeamShadow teamColors={awayColors} baseStyle={styles.previousScoreText} colors={colors}>
                {game.awayTeamAbbrev}
              </TextWithTeamShadow>
            )}
            <TeamRecordRow record={awayRecord} isB2B={awayB2B} colors={colors} />
          </View>
          <View style={styles.atWrapper}>
            <ThemedText style={[styles.scoreDash, styles.previousScoreDash, { color: colors.secondaryText }]}>–</ThemedText>
          </View>
          <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
            {USE_PLAIN_WHITE_TEXT ? (
              <ThemedText style={[styles.previousScoreText, { color: '#ffffff' }]}>{game.homeTeamAbbrev}</ThemedText>
            ) : (
              <TextWithTeamShadow teamColors={homeColors} baseStyle={styles.previousScoreText} colors={colors}>
                {game.homeTeamAbbrev}
              </TextWithTeamShadow>
            )}
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
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  previousScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  previousScoreSide: {
    flex: 1,
    alignItems: 'flex-start',
    // borderWidth: 1,
    // borderColor: 'purple',
  },
  previousScoreColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    // borderWidth: 1,
    // borderColor: 'orange',
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
    // paddingVertical: 2,
    borderRadius: 4,
    // backgroundColor: '#9ca3af',
    backgroundColor: '#373737',
  },
  b2bBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  previousScoreTeamName: {
    marginTop: 0,
    fontWeight: '700',
    fontSize: 14,
  },
  previousScoreText: {
    fontSize: 40,
    fontWeight: '700',
    minWidth: 48,
    lineHeight: 48,
  },
  previousScoreOutlineWrap: {
    position: 'relative',
  },
  previousScoreOutlineStroke: {
    position: 'absolute',
    color: '#939393',
    fontSize: 40,
    fontWeight: '700',
    minWidth: 48,
    lineHeight: 48,
  },
  previousScoreOutlineFill: {
    position: 'relative',
  },
  atWrapper: {
    alignSelf: 'flex-start',
    // borderWidth: 1,
    // borderColor: 'cyan',
  },
  scoreDash: {
    fontSize: 16,
    fontWeight: '700',
    // textTransform: 'uppercase',
    paddingTop: 12,
    // borderWidth: 1,
    // borderColor: 'red',
  },
  previousScoreDash: {
    fontSize: 16,
    fontWeight: '700',
    // textTransform: 'uppercase',
    // borderWidth: 1,
    // borderColor: 'magenta',
  },
  shadowTextWrap: {
    position: 'relative',
  },
  charRow: {
    flexDirection: 'row',
  },
  charCell: {
    position: 'relative',
  },
  charSizer: {
    opacity: 0,
  },
  charStroke: {
    position: 'absolute',
  },
  charFill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  charTop: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
