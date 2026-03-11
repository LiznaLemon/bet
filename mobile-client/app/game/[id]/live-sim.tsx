import { AddPropForm } from '@/components/add-prop-form';
import { InsightCarousel } from '@/components/insight-carousel';
import { PropProgressLine } from '@/components/prop-progress-line';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  computeLivePropInsight,
  getCurrentStatValue,
} from '@/lib/props/compute-live-prop-insight';
import { formatPropDescription } from '@/lib/props/compute-prop-stats';
import { useGameBoxScores, type GameBoxScore } from '@/lib/queries/game-boxscores';
import { useLeagueQuarterStats } from '@/lib/queries/league-quarter-stats';
import { usePlayByPlay } from '@/lib/queries/play-by-play';
import {
  computeQuarterContext,
  usePlayerQuarterStats,
} from '@/lib/queries/player-quarter-stats';
import { usePlayersForTeams } from '@/lib/queries/players-for-teams';
import { useGame } from '@/lib/queries/schedule';
import type { GameLogEntry, Player } from '@/lib/types';
import type { PlayerProp } from '@/lib/types/props';
import { isSingleProp } from '@/lib/types/props';
import type { AccumulatedStats } from '@/lib/utils/live-stats';
import {
  accumulateStatsFromPlays,
  getGameStateAtPlay,
  getStatsAtQuarterEnds,
} from '@/lib/utils/live-stats';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SEASON = 2026;

export default function LiveSimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: game, isLoading: gameLoading } = useGame(id, SEASON);
  const { data: plays = [], isLoading: playsLoading } = usePlayByPlay(id, SEASON);
  const { data: boxScores = [] } = useGameBoxScores(id, SEASON);
  const { data: playersForTeams = [] } = usePlayersForTeams(
    game?.awayTeamAbbrev,
    game?.homeTeamAbbrev,
    SEASON
  );
  const { data: leagueContext } = useLeagueQuarterStats(SEASON);

  const [playIndex, setPlayIndex] = useState(0);
  const [props, setProps] = useState<PlayerProp[]>([]);

  const athleteIds = useMemo(
    () => boxScores.map((b) => b.athlete_id),
    [boxScores]
  );

  const playerMap = useMemo(() => {
    const map = new Map<string, GameBoxScore & { game_log?: unknown[] }>();
    const playerByAthlete = new Map(playersForTeams.map((p) => [p.athlete_id, p]));
    for (const b of boxScores) {
      const enhanced = playerByAthlete.get(b.athlete_id);
      map.set(b.athlete_id, {
        ...b,
        game_log: (enhanced?.game_log ?? []) as unknown[],
      });
    }
    return map;
  }, [boxScores, playersForTeams]);

  const playersForForm: Player[] = useMemo(() => {
    const boxIds = new Set(boxScores.map((b) => b.athlete_id));
    const fromTeams = playersForTeams.filter((p) => boxIds.has(p.athlete_id));
    if (fromTeams.length > 0) return fromTeams;
    return boxScores.map((b): Player => ({
      athlete_id: b.athlete_id,
      athlete_display_name: b.athlete_display_name,
      athlete_short_name: b.athlete_display_name?.split(' ').pop() ?? '',
      athlete_headshot_href: b.athlete_headshot_href,
      athlete_position_name: '',
      athlete_position_abbreviation: b.athlete_position_abbreviation,
      team_display_name: '',
      team_abbreviation: b.team_abbreviation,
      team_logo: '',
      team_color: b.team_color ?? '',
      games_played: 1,
      ppg: String(b.points),
      rpg: String(b.rebounds),
      apg: String(b.assists),
      spg: String(b.steals),
      bpg: String(b.blocks),
      tpg: '0',
      fpg: '0',
      mpg: String(b.minutes),
      fg_pct: '0',
      three_pt_pct: '0',
      ft_pct: '0',
      total_points: b.points,
      total_rebounds: b.rebounds,
      total_assists: b.assists,
      total_steals: b.steals,
      total_blocks: b.blocks,
      total_turnovers: 0,
      total_fouls: 0,
      total_minutes: b.minutes,
      total_field_goals_made: 0,
      total_field_goals_attempted: 0,
      total_three_point_made: 0,
      total_three_point_attempted: 0,
      total_free_throws_made: 0,
      total_free_throws_attempted: 0,
      total_offensive_rebounds: 0,
      total_defensive_rebounds: 0,
      total_plus_minus: 0,
      game_log: [],
    }));
  }, [boxScores, playersForTeams]);

  const liveStatsMap = useMemo(() => {
    const idx = Math.min(playIndex, Math.max(0, plays.length - 1));
    return accumulateStatsFromPlays(plays, idx, athleteIds);
  }, [plays, playIndex, athleteIds]);

  const gameState = useMemo(
    () => getGameStateAtPlay(plays, playIndex),
    [plays, playIndex]
  );

  const statsAtQuarterEnds = useMemo(
    () => getStatsAtQuarterEnds(plays, playIndex, athleteIds),
    [plays, playIndex, athleteIds]
  );

  const handleAddProp = useCallback((prop: PlayerProp) => {
    setProps((prev) => [...prev, prop]);
  }, []);

  const handleRemoveProp = useCallback((propId: string) => {
    setProps((prev) => prev.filter((p) => p.id !== propId));
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  if (!id) {
    return (
      <>
        <Stack.Screen options={{ title: 'Live Sim' }} />
        <ThemedView style={styles.center}>
          <ThemedText>Invalid game</ThemedText>
        </ThemedView>
      </>
    );
  }

  if ((gameLoading || playsLoading) && !game) {
    return (
      <>
        <Stack.Screen options={{ title: 'Live Sim' }} />
        <ThemedView style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading...
          </ThemedText>
        </ThemedView>
      </>
    );
  }

  if (!game) {
    return (
      <>
        <Stack.Screen options={{ title: 'Live Sim' }} />
        <ThemedView style={styles.center}>
          <ThemedText>Game not found</ThemedText>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <ThemedText style={{ color: colors.tint }}>Go back</ThemedText>
          </Pressable>
        </ThemedView>
      </>
    );
  }

  const title = `Live Sim: ${game.awayTeamAbbrev} @ ${game.homeTeamAbbrev}`;
  const maxPlayIndex = Math.max(0, plays.length - 1);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 + insets.bottom }]}
          showsVerticalScrollIndicator={false}>
          {/* Props and live insights - at top */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Props</ThemedText>
            <AddPropForm
              players={playersForForm}
              isLoading={false}
              onAddProp={handleAddProp}
              minGamesRequired={0}
            />
            <View style={styles.propsList}>
              {props.length === 0 ? (
                <ThemedText style={[styles.emptyState, { color: colors.secondaryText }]}>
                  Add a prop to see live likelihood insights.
                </ThemedText>
              ) : (
                props.map((prop) => (
                  <LivePropCard
                    key={prop.id}
                    prop={prop}
                    player={playerMap.get(prop.playerId) ?? null}
                    liveStats={liveStatsMap.get(prop.playerId) ?? null}
                    leagueContext={leagueContext ?? null}
                    statsAtQuarterEnds={statsAtQuarterEnds}
                    currentPeriod={gameState.period}
                    isGameOver={playIndex >= maxPlayIndex}
                    onRemove={handleRemoveProp}
                  />
                ))
              )}
            </View>
          </View>

          {/* Live stats */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Live stats</ThemedText>
            {plays.length === 0 ? (
              <ThemedText style={[styles.emptyState, { color: colors.secondaryText }]}>
                No play-by-play data for this game.
              </ThemedText>
            ) : (
              <View style={styles.statsGrid}>
                {boxScores.slice(0, 10).map((b) => {
                  const live = liveStatsMap.get(b.athlete_id);
                  return (
                    <View
                      key={b.athlete_id}
                      style={[styles.playerStatRow, { backgroundColor: colors.cardBackground }]}>
                      <Image
                        source={{ uri: b.athlete_headshot_href }}
                        style={[styles.headshot, { backgroundColor: colors.border }]}
                      />
                      <View style={styles.playerStatInfo}>
                        <ThemedText style={styles.playerName} numberOfLines={1}>
                          {b.athlete_display_name}
                        </ThemedText>
                        <ThemedText style={[styles.statLine, { color: colors.secondaryText }]}>
                          {live?.points ?? 0} PTS · {live?.rebounds ?? 0} REB · {live?.assists ?? 0} AST
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Floating bottom game progress bar */}
        <View
          style={[
            styles.floatingProgress,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: 12 + insets.bottom,
            },
          ]}>
          <ThemedText style={[styles.progressRow1, { color: colors.text }]}>
            Game progress – Q{gameState.period} {gameState.clockDisplay ?? '—'}
          </ThemedText>
          <View style={styles.progressRow2}>
            <Pressable
              style={[styles.scrubberBtn, { backgroundColor: colors.tint + '30' }]}
              onPress={() => setPlayIndex((i) => Math.max(0, i - 10))}
              disabled={plays.length === 0 || playIndex === 0}>
              <ThemedText style={{ color: colors.tint, fontWeight: '600', fontSize: 13 }}>−10</ThemedText>
            </Pressable>
            <ThemedText style={[styles.playCount, { color: colors.secondaryText }]}>
              Play {playIndex + 1} / {plays.length || 1}
            </ThemedText>
            <Pressable
              style={[styles.scrubberBtn, { backgroundColor: colors.tint + '30' }]}
              onPress={() => setPlayIndex((i) => Math.min(maxPlayIndex, i + 10))}
              disabled={plays.length === 0 || playIndex >= maxPlayIndex}>
              <ThemedText style={{ color: colors.tint, fontWeight: '600', fontSize: 13 }}>+10</ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    </>
  );
}

type LivePropCardProps = {
  prop: PlayerProp;
  player: (GameBoxScore & { game_log?: unknown[] }) | null;
  liveStats: AccumulatedStats | null;
  leagueContext: { secondHalfP50: number; secondHalfP90: number; secondHalfP99: number } | null;
  statsAtQuarterEnds: {
    q1: Map<string, AccumulatedStats> | null;
    q2: Map<string, AccumulatedStats> | null;
    q3: Map<string, AccumulatedStats> | null;
    q4: Map<string, AccumulatedStats> | null;
  };
  currentPeriod: number;
  isGameOver: boolean;
  onRemove: (propId: string) => void;
};

function LivePropCard({
  prop,
  player,
  liveStats,
  leagueContext,
  statsAtQuarterEnds,
  currentPeriod,
  isGameOver,
  onRemove,
}: LivePropCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const { data: quarterRows } = usePlayerQuarterStats(prop.playerId, SEASON);
  const quarterContext = useMemo(
    () => computeQuarterContext(quarterRows ?? []),
    [quarterRows]
  );

  const liveInsight = useMemo(() => {
    if (!isSingleProp(prop)) return null;
    const playerHistory =
      player?.game_log?.length ? { gameLog: player.game_log as GameLogEntry[] } : null;
    return computeLivePropInsight(
      liveStats,
      prop,
      undefined,
      playerHistory,
      quarterContext,
      quarterRows ?? null,
      leagueContext,
      statsAtQuarterEnds,
      currentPeriod,
      prop.playerId
    );
  }, [prop, liveStats, player?.game_log, quarterContext, quarterRows, leagueContext, statsAtQuarterEnds, currentPeriod]);

  const handleRemove = useCallback(() => {
    onRemove(prop.id);
  }, [prop.id, onRemove]);

  if (!player) {
    return (
      <ThemedView style={[styles.propCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <ThemedText style={styles.placeholder}>Player not found</ThemedText>
      </ThemedView>
    );
  }

  const isHit =
    isSingleProp(prop) &&
    liveInsight &&
    (prop.direction === 'over'
      ? liveInsight.currentValue >= Math.ceil(prop.line)
      : liveInsight.currentValue <= Math.floor(prop.line));

  const STAT_LABELS: Record<string, string> = {
    points: 'PTS',
    rebounds: 'REB',
    assists: 'AST',
    steals: 'STL',
    blocks: 'BLK',
    turnovers: 'TOV',
    fouls: 'PF',
    two_pt_made: '2PT',
    three_pt_made: '3PT',
    free_throws_made: 'FT',
  };

  return (
    <ThemedView style={[styles.propCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.propHeader}>
        <View style={styles.propPlayerRow}>
          <View style={styles.headshotWrapper}>
            <Image
              source={{ uri: player.athlete_headshot_href }}
              style={[styles.headshot, { backgroundColor: colors.border }]}
            />
            {isSingleProp(prop) && liveInsight && (
              <View
                style={[
                  styles.hitMissBadge,
                  {
                    backgroundColor: isHit ? '#24d169' : '#e53935',
                  },
                ]}>
                <MaterialIcons
                  name={isHit ? 'check' : 'close'}
                  size={14}
                  color="#fff"
                />
              </View>
            )}
          </View>
          <View>
            <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            <ThemedText style={[styles.propDesc, { color: colors.secondaryText }]}>
              {formatPropDescription(prop)}
            </ThemedText>
          </View>
        </View>
        <Pressable onPress={handleRemove} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <ThemedText style={{ color: colors.tint }}>Remove</ThemedText>
        </Pressable>
      </View>

      {isSingleProp(prop) && liveInsight && (
        <View style={styles.liveInsightSection}>
          {prop.stat !== 'minutes' && (
            <PropProgressLine
              currentValue={liveInsight.currentValue}
              line={liveInsight.line}
              direction={liveInsight.direction}
              seasonAvg={liveInsight.seasonAvg}
              projectedValue={liveInsight.projectedValue}
              averageProjectedValue={liveInsight.averageProjectedValue}
              statLabel={STAT_LABELS[prop.stat] ?? prop.stat}
              colorScheme={colorScheme ?? 'light'}
              isGameOver={isGameOver}
            />
          )}
          {(quarterContext || (liveInsight.seasonAvg != null && liveInsight.seasonAvg > 0)) &&
            prop.stat !== 'minutes' && (
              <View style={styles.quarterAvgsRow}>
                {(() => {
                  const quarterKeys = ['q1', 'q2', 'q3', 'q4'] as const;
                  let prevCumulative = 0;
                  return [1, 2, 3, 4].map((q) => {
                    const avg =
                      prop.stat === 'points' && quarterContext
                        ? [quarterContext.avgQ1, quarterContext.avgQ2, quarterContext.avgQ3, quarterContext.avgQ4][
                            q - 1
                          ]
                        : (liveInsight!.seasonAvg ?? 0) / 4;
                    const map = statsAtQuarterEnds[quarterKeys[q - 1]];
                    const qStats = map?.get(prop.playerId);
                    let result: number | null = null;
                    let delta: number | null = null;
                    if (qStats != null && currentPeriod >= q) {
                      const cumulative = getCurrentStatValue(qStats, prop.stat);
                      result = cumulative - prevCumulative;
                      prevCumulative = cumulative;
                      delta = result - avg;
                    } else if (
                      currentPeriod === q &&
                      liveStats != null
                    ) {
                      result = getCurrentStatValue(liveStats, prop.stat) - prevCumulative;
                      delta = result - avg;
                    }
                    const statLabel = STAT_LABELS[prop.stat] ?? prop.stat;
                    const hasData = result != null;
                    const displayValue = result != null ? Math.round(result).toString() : '0';
                    return (
                      <View
                        key={q}
                        style={[
                          styles.quarterAvgBox,
                          { backgroundColor: colors.background, borderColor: colors.border },
                        ]}>
                        <ThemedText style={[styles.quarterAvgLabel, { color: colors.secondaryText }]}>
                          Q{q} avg
                        </ThemedText>
                        <ThemedText style={[styles.quarterAvgValue, { color: colors.text }]}>
                          {avg.toFixed(1)}
                          {/* {statLabel} */}
                        </ThemedText>
                        <View style={styles.quarterResultColumn}>
                          <ThemedText
                            style={[
                              styles.quarterResultValue,
                              { color: hasData ? colors.text : colors.secondaryText },
                            ]}>
                            {displayValue}
                          </ThemedText>
                          {result != null && delta != null ? (
                            <View
                              style={[
                                styles.quarterDeltaOval,
                                {
                                  backgroundColor:
                                    delta >= 0
                                      ? 'rgba(36, 209, 105, 0.25)'
                                      : 'rgba(229, 57, 53, 0.25)',
                                },
                              ]}>
                              <ThemedText
                                style={[
                                  styles.quarterAvgDelta,
                                  { color: delta >= 0 ? '#24d169' : '#e53935' },
                                ]}>
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
            )}
          {/* <ThemedText style={[styles.currentValue, { color: colors.tint }]}>
            Current: {liveInsight.currentValue.toFixed(1)}
          </ThemedText> */}
          <InsightCarousel
            insights={liveInsight.insightStrings.filter(
              (s) =>
                !s.startsWith('Quarter avgs:') &&
                !s.startsWith('Quarter avg (season/4)') &&
                !s.startsWith('By quarter:') &&
                !s.startsWith('Already hit') &&
                !s.startsWith('Already over line')
            )}
            style={styles.insightCarousel}
            cycleDurationMs={5000}
          />
        </View>
      )}

      {!isSingleProp(prop) && (
        <ThemedText style={[styles.insightText, { color: colors.secondaryText }]}>
          Double-double / triple-double live insights coming soon.
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
  },
  backBtn: {
    marginTop: 16,
  },
  section: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  floatingProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  progressRow1: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  playCount: {
    fontSize: 13,
    minWidth: 80,
    textAlign: 'center',
  },
  scrubberBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statsGrid: {
    gap: 8,
  },
  playerStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  headshotWrapper: {
    position: 'relative',
  },
  headshot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  hitMissBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerStatInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  statLine: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    fontSize: 14,
    paddingVertical: 16,
    textAlign: 'center',
  },
  propsList: {
    marginTop: 12,
    gap: 12,
  },
  propCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  propHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  propPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  propDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  liveInsightSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  quarterAvgsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
    marginBottom: 8,
  },
  quarterAvgBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  quarterAvgLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  quarterAvgValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  quarterResultColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quarterResultValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  quarterDeltaOval: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'center',
  },
  quarterAvgDelta: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  insightCarousel: {
    marginTop: 4,
  },
  insightText: {
    fontSize: 14,
    marginBottom: 4,
  },
  placeholder: {
    fontSize: 14,
    opacity: 0.7,
  },
});
