import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { GameMatchupDisplay } from '@/components/game-matchup-display';
import { InsightCarousel } from '@/components/insight-carousel';
// import { PropProgressLine } from '@/components/prop-progress-line';
import { RiveProgressBar } from '@/components/rive-progress-bar';
import { TeamComparisonBar } from '@/components/team-comparison-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTeamColor } from '@/constants/team-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  computeLivePropInsight,
  getCurrentStatValue,
} from '@/lib/props/compute-live-prop-insight';
import { formatPropDescription } from '@/lib/props/compute-prop-stats';
import { type ESPNLiveGameResult } from '@/lib/queries/espn-live-game';
import { type GameBoxScore } from '@/lib/queries/game-boxscores';
import { useLeagueQuarterStats } from '@/lib/queries/league-quarter-stats';
import { type PlayByPlayRecord } from '@/lib/queries/play-by-play';
import {
  computeQuarterContext,
  type QuarterAvgsStatKey,
  usePlayerQuarterStats,
} from '@/lib/queries/player-quarter-stats';
import { useScheduleForDateRange } from '@/lib/queries/schedule';
import type { GameLogEntry, Player, ScheduleGame } from '@/lib/types';
import type { PlayerProp } from '@/lib/types/props';
import { isSingleProp } from '@/lib/types/props';
import { getPrevDayDateStr } from '@/lib/utils/date';
import {
  aggregateBoxScoresByTeam,
  aggregateLiveStatsByTeam,
} from '@/lib/utils/game-team-stats';
import type { AccumulatedStats } from '@/lib/utils/live-stats';
import {
  accumulateStatsFromPlays,
  computeOnCourtAtPlayIndex,
  getGameStateAtPlay,
  getScoreAtPlayIndex,
  getStatsAtQuarterEnds,
  isQuarterEndedAtPlayIndex,
} from '@/lib/utils/live-stats';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SEASON = 2026;

type GameLiveViewProps = {
  game: ScheduleGame;
  plays: PlayByPlayRecord[];
  playsLoading: boolean;
  supabaseBoxScores: GameBoxScore[];
  espnData: ESPNLiveGameResult | undefined;
  playersForTeams: Player[];
  props: PlayerProp[];
  setProps: (updater: (prev: PlayerProp[]) => PlayerProp[]) => void;
};

export function GameLiveView({
  game,
  plays,
  playsLoading,
  supabaseBoxScores,
  espnData,
  playersForTeams,
  props,
  setProps,
}: GameLiveViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const { data: leagueContext } = useLeagueQuarterStats(SEASON);

  const b2bStartDate = game.gameDate ? getPrevDayDateStr(game.gameDate) : '';
  const b2bEndDate = game.gameDate ?? '';
  const { data: scheduleForB2B = [] } = useScheduleForDateRange(
    b2bStartDate,
    b2bEndDate,
    SEASON,
    { enabled: !!game.gameDate && !!b2bStartDate }
  );

  const useESPN = !playsLoading && plays.length === 0 && supabaseBoxScores.length === 0;

  const boxScores =
    supabaseBoxScores.length > 0 ? supabaseBoxScores : (espnData?.boxScores ?? []);
  const allPlays = plays.length > 0 ? plays : (espnData?.plays ?? []);

  const [playIndex, setPlayIndex] = useState(0);
  const [liveStatsView, setLiveStatsView] = useState<'players' | 'team'>('players');
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [autoplayIntervalSec, setAutoplayIntervalSec] = useState(5);

  const isLiveESPN = useESPN && espnData && !espnData.isFinal;
  const isCompletedGame =
    !useESPN ||
    (useESPN && espnData?.isFinal);

  useEffect(() => {
    if (isLiveESPN && allPlays.length > 0) {
      setPlayIndex(allPlays.length - 1);
    }
  }, [isLiveESPN, allPlays.length]);

  useEffect(() => {
    if (isCompletedGame && allPlays.length > 0) {
      setPlayIndex(allPlays.length - 1);
    }
  }, [isCompletedGame, allPlays.length]);

  useEffect(() => {
    if (!isAutoplay || allPlays.length === 0) return;
    const maxIdx = allPlays.length - 1;
    const iv = setInterval(() => {
      setPlayIndex((i) => {
        if (i >= maxIdx) {
          setIsAutoplay(false);
          return maxIdx;
        }
        return Math.min(maxIdx, i + 1);
      });
    }, autoplayIntervalSec * 1000);
    return () => clearInterval(iv);
  }, [isAutoplay, autoplayIntervalSec, allPlays.length]);

  const athleteIds = useMemo(
    () =>
      boxScores.length > 0
        ? boxScores.map((b) => b.athlete_id)
        : playersForTeams.map((p) => p.athlete_id),
    [boxScores, playersForTeams]
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
    if (map.size === 0) {
      for (const p of playersForTeams) {
        map.set(p.athlete_id, {
          athlete_id: p.athlete_id,
          athlete_display_name: p.athlete_display_name,
          athlete_headshot_href: p.athlete_headshot_href,
          athlete_position_abbreviation: p.athlete_position_abbreviation,
          team_abbreviation: p.team_abbreviation,
          team_color: p.team_color ?? null,
          points: p.total_points ?? 0,
          rebounds: p.total_rebounds ?? 0,
          assists: p.total_assists ?? 0,
          steals: p.total_steals ?? 0,
          blocks: p.total_blocks ?? 0,
          minutes: p.total_minutes ?? 0,
          field_goals_made: 0,
          field_goals_attempted: 0,
          three_point_made: 0,
          three_point_attempted: 0,
          free_throws_made: 0,
          free_throws_attempted: 0,
          turnovers: 0,
          fouls: 0,
          plus_minus: 0,
          game_log: (p.game_log ?? []) as unknown[],
        });
      }
    }
    return map;
  }, [boxScores, playersForTeams]);

  const playersForForm: Player[] = useMemo(() => {
    const boxScorePlayers: Player[] = boxScores.map((b) => ({
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

    if (playersForTeams.length === 0) return boxScorePlayers;

    // Merge: use Supabase players (richer data) as base, then fill in any
    // players present in ESPN box scores but missing from Supabase (e.g. due
    // to team abbreviation mismatch like NY vs NYK).
    const supabaseIds = new Set(playersForTeams.map((p) => p.athlete_id));
    const missing = boxScorePlayers.filter((p) => !supabaseIds.has(p.athlete_id));
    return missing.length > 0 ? [...playersForTeams, ...missing] : playersForTeams;
  }, [boxScores, playersForTeams]);

  const liveStatsMap = useMemo(() => {
    const idx = Math.min(playIndex, Math.max(0, allPlays.length - 1));
    return accumulateStatsFromPlays(allPlays, idx);
  }, [allPlays, playIndex]);

  const gameState = useMemo(
    () => getGameStateAtPlay(allPlays, playIndex),
    [allPlays, playIndex]
  );

  const statsAtQuarterEnds = useMemo(
    () => getStatsAtQuarterEnds(allPlays, playIndex, athleteIds),
    [allPlays, playIndex, athleteIds]
  );

  const athleteToTeam = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of playersForTeams) {
      map.set(p.athlete_id, p.team_abbreviation);
    }
    for (const b of boxScores) {
      map.set(b.athlete_id, b.team_abbreviation);
    }
    return map;
  }, [playersForTeams, boxScores]);

  const onCourtPlayerIds = useMemo((): Set<string> | null => {
    if (allPlays.length === 0 || athleteToTeam.size === 0) return null;
    return computeOnCourtAtPlayIndex(
      allPlays,
      playIndex,
      athleteToTeam,
      game.awayTeamAbbrev ?? '',
      game.homeTeamAbbrev ?? ''
    );
  }, [allPlays, playIndex, athleteToTeam, game.awayTeamAbbrev, game.homeTeamAbbrev]);

  const getPlayDescriptionWithActor = useCallback(
    (play: PlayByPlayRecord & { play_text?: string }) => {
      const raw = (play.play_text ?? play.type_text ?? '').replace(/[\r\n]+/g, ' ').trim();
      let baseText = raw || '';
      const isMissedShot = play.shooting_play && !play.scoring_play;
      if (isMissedShot && baseText && !/miss/i.test(baseText)) {
        baseText = `Missed ${baseText}`;
      }
      const aid = play.athlete_id_1;
      if (aid == null || !baseText) return baseText;
      const player =
        playerMap.get(String(aid)) ??
        playerMap.get(String(Number(aid))) ??
        boxScores.find(
          (b) =>
            String(b.athlete_id) === String(aid) ||
            String(Number(b.athlete_id)) === String(aid)
        );
      const name = player?.athlete_display_name;
      if (!name) return baseText;
      const lastName = name.split(' ').pop() ?? '';
      if (lastName && baseText.includes(lastName)) return baseText;
      return `${name} — ${baseText}`;
    },
    [playerMap, boxScores]
  );

  const liveStatLeaders = useMemo(() => {
    const entries = Array.from(liveStatsMap.entries());
    const sorted = entries
      .sort(([, a], [, b]) => {
        const pts = (b.points ?? 0) - (a.points ?? 0);
        if (pts !== 0) return pts;
        const reb = (b.rebounds ?? 0) - (a.rebounds ?? 0);
        if (reb !== 0) return reb;
        return (b.assists ?? 0) - (a.assists ?? 0);
      })
      .slice(0, 15);
    const getDisplay = (athleteId: string) =>
      playerMap.get(athleteId) ?? playerMap.get(String(Number(athleteId))) ?? boxScores.find((b) => b.athlete_id === athleteId || String(Number(b.athlete_id)) === athleteId);
    return sorted
      .map(([athleteId, stats]) => ({ athleteId, stats, display: getDisplay(athleteId) }))
      .filter((x): x is { athleteId: string; stats: AccumulatedStats; display: GameBoxScore & { game_log?: unknown[] } } => !!x.display)
      .slice(0, 10);
  }, [liveStatsMap, playerMap, boxScores]);

  const liveScore = useMemo(() => {
    if (allPlays.length === 0) return null;
    return getScoreAtPlayIndex(
      allPlays,
      playIndex,
      athleteToTeam,
      game.awayTeamAbbrev ?? '',
      game.homeTeamAbbrev ?? ''
    );
  }, [allPlays, playIndex, athleteToTeam, game.awayTeamAbbrev, game.homeTeamAbbrev]);

  const handleAddProp = useCallback((prop: PlayerProp) => {
    setProps((prev) => [...prev, prop]);
  }, [setProps]);

  const handleRemoveProp = useCallback((propId: string) => {
    setProps((prev) => prev.filter((p) => p.id !== propId));
  }, [setProps]);

  const maxPlayIndex = Math.max(0, allPlays.length - 1);
  const isLiveMode = useESPN && espnData && !espnData.isFinal;
  const isReplayMode = !isLiveMode;
  const isGameOver =
    (useESPN && espnData?.isFinal) ||
    (game.completed ?? false) ||
    (!isLiveMode && allPlays.length > 0 && playIndex >= allPlays.length - 1);

  const playsForFeed = useMemo(() => allPlays.slice(-30), [allPlays]);

  const playsForReplayFeed = useMemo(() => {
    if (allPlays.length === 0) return [];
    const end = Math.min(playIndex + 1, allPlays.length);
    const start = Math.max(0, end - 30);
    return allPlays.slice(start, end);
  }, [allPlays, playIndex]);

  const playByPlayListRef = useRef<FlatList<(typeof allPlays)[0]>>(null);

  useEffect(() => {
    if (!isLiveMode && playIndex > 0 && playsForReplayFeed.length > 0) {
      const t = setTimeout(() => {
        playByPlayListRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isLiveMode, playIndex, playsForReplayFeed.length]);

  if (playsLoading && allPlays.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={[styles.loadingText, { color: colors.secondaryText }]}>
          Loading game data...
        </ThemedText>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        {liveScore != null && (
          <View style={[styles.section, { borderColor: colors.border }]}>
            <GameMatchupDisplay
              game={{
                ...game,
                awayScore: liveScore.awayScore,
                homeScore: liveScore.homeScore,
                completed: true,
              }}
              colorScheme={colorScheme ?? 'light'}
              scheduleGames={scheduleForB2B}
            />
          </View>
        )}

        {allPlays.length > 0 && (
          <View style={[styles.section, styles.playByPlaySection, { borderColor: colors.border }]}>
            <View style={styles.playByPlayHeader}>
              <ThemedText style={styles.sectionTitle}>Play-by-Play</ThemedText>
              <View style={styles.playByPlayLiveBadge}>
                <ThemedText style={[styles.playByPlayLiveBadgeText]}>
                  {isLiveMode
                    ? `LIVE · Q${gameState.period} ${gameState.clockDisplay ?? '—'}`
                    : `Replay · Q${gameState.period} ${gameState.clockDisplay ?? '—'}`}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.playByPlayScrollWrap, { height: 180 }]}>
              <FlatList
                ref={playByPlayListRef}
                data={isLiveMode ? playsForFeed : playsForReplayFeed}
                keyExtractor={(item) => `play-${item.id}-${item.game_play_number}`}
                inverted
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const displayText = getPlayDescriptionWithActor(item as PlayByPlayRecord & { play_text?: string });
                  return (
                    <View style={[styles.playByPlayRow, { borderBottomColor: colors.border }]}>
                      <ThemedText style={[styles.playByPlayMeta, { color: colors.secondaryText }]}>
                        Q{item.period_number} {item.clock_display_value ?? '—'}
                        {item.scoring_play && item.score_value != null && (
                          <ThemedText style={{ color: colors.tint }}> · +{item.score_value}</ThemedText>
                        )}
                      </ThemedText>
                      <ThemedText style={[styles.playByPlayText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                        {displayText}
                      </ThemedText>
                    </View>
                  );
                }}
              />
              <LinearGradient
                colors={[colors.background, 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.playByPlayGradient, styles.playByPlayGradientTop]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', colors.background]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[styles.playByPlayGradient, styles.playByPlayGradientBottom]}
                pointerEvents="none"
              />
            </View>
          </View>
        )}

        <View style={[styles.section, { borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>Props</ThemedText>
          <Pressable
            style={[styles.addPropButton, { backgroundColor: '#ffffff' }]}
            onPress={() => router.push(`/game/${game.id}/select-props` as const)}>
            <ThemedText style={[styles.addPropButtonText, { color: '#000000' }]}>
              Add Prop
            </ThemedText>
          </Pressable>
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
                  plays={allPlays}
                  isOnCourt={
                    onCourtPlayerIds != null &&
                    (onCourtPlayerIds.has(prop.playerId) || onCourtPlayerIds.has(String(Number(prop.playerId))))
                  }
                  playIndex={playIndex}
                  isGameOver={isGameOver}
                  isLiveMode={!!isLiveMode}
                  gameDate={game.gameDate ?? null}
                  onRemove={handleRemoveProp}
                />
              ))
            )}
          </View>
        </View>

        <View style={[styles.section, { borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>Live stats</ThemedText>
          {allPlays.length === 0 ? (
            <ThemedText style={[styles.emptyState, { color: colors.secondaryText }]}>
              No play-by-play data for this game.
            </ThemedText>
          ) : (
            <>
              <View style={{ marginBottom: 12 }}>
                <FilterOptionButtons
                  options={[
                    { key: 'players', label: 'Players' },
                    { key: 'team', label: 'Team' },
                  ]}
                  value={liveStatsView}
                  onSelect={(k) => setLiveStatsView(k as 'players' | 'team')}
                  colorScheme={colorScheme ?? 'light'}
                />
              </View>
              {liveStatsView === 'players' ? (
                <View style={styles.statsGrid}>
                  {(liveStatLeaders.length > 0
                    ? liveStatLeaders.map((x) => ({ player: x.display, liveStats: x.stats }))
                    : (boxScores.length > 0 ? boxScores : Array.from(playerMap.values()))
                        .slice(0, 10)
                        .map((p) => ({
                          player: p,
                          liveStats:
                            liveStatsMap.get(p.athlete_id) ??
                            liveStatsMap.get(String(Number(p.athlete_id))),
                        }))
                  ).map(({ player, liveStats }) => {
                    const isOnCourt =
                      onCourtPlayerIds != null &&
                      (onCourtPlayerIds.has(player.athlete_id) ||
                        onCourtPlayerIds.has(String(Number(player.athlete_id))));
                    return (
                      <View
                        key={player.athlete_id}
                        style={[styles.playerStatRow, { backgroundColor: colors.background }]}>
                        <Image
                          source={{ uri: player.athlete_headshot_href }}
                          style={[styles.headshot, { backgroundColor: colors.border }]}
                        />
                        <View style={styles.playerStatInfo}>
                          <View style={styles.playerNameRow}>
                            <ThemedText style={styles.playerName} numberOfLines={1}>
                              {player.athlete_display_name}
                            </ThemedText>
                            {isOnCourt && (
                              <View style={styles.onCourtBadge}>
                                <ThemedText style={styles.onCourtBadgeText}>On court</ThemedText>
                              </View>
                            )}
                          </View>
                          <ThemedText style={[styles.statLine, { color: colors.secondaryText }]}>
                            {liveStats?.points ?? 0} PTS · {liveStats?.rebounds ?? 0} REB · {liveStats?.assists ?? 0} AST
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <LiveTeamStats
                  game={game}
                  liveStatsMap={liveStatsMap}
                  athleteToTeam={athleteToTeam}
                  supabaseBoxScores={supabaseBoxScores}
                  isGameOver={isGameOver}
                  atFinalPlay={playIndex >= Math.max(0, allPlays.length - 1)}
                  playsLength={allPlays.length}
                  colorScheme={colorScheme ?? 'light'}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      {isReplayMode && (
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
            {isGameOver
              ? `Final · Q${gameState.period} ${gameState.clockDisplay ?? '—'}`
              : `Replay · Q${gameState.period} ${gameState.clockDisplay ?? '—'}`}
            {' · Play '}
            {playIndex + 1}
            {' / '}
            {allPlays.length || 1}
          </ThemedText>
          {allPlays.length > 0 && playIndex >= 0 && allPlays[playIndex] && (
            <View style={[styles.progressPlayDescription, { borderBottomColor: colors.border }]}>
              <ThemedText style={[styles.playByPlayMeta, { color: colors.secondaryText }]}>
                Q{allPlays[playIndex].period_number} {allPlays[playIndex].clock_display_value ?? '—'}
                {allPlays[playIndex].scoring_play && allPlays[playIndex].score_value != null && (
                  <ThemedText style={{ color: colors.tint }}> · +{allPlays[playIndex].score_value}</ThemedText>
                )}
              </ThemedText>
              <ThemedText style={[styles.playByPlayText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {getPlayDescriptionWithActor(allPlays[playIndex] as PlayByPlayRecord & { play_text?: string })}
              </ThemedText>
            </View>
          )}
          <View style={styles.progressRow2}>
            <Pressable
              style={({ pressed }) => [
                styles.stepBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: 'transparent',
                  opacity: allPlays.length === 0 || playIndex === 0 ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => setPlayIndex(0)}
              disabled={allPlays.length === 0 || playIndex === 0}>
              <MaterialIcons name="skip-previous" size={18} color={playIndex === 0 ? colors.tabIconDefault : colors.tint} />
            </Pressable>
            {[
              { key: '-10', delta: -10 },
              { key: '-1', delta: -1 },
            ].map(({ key, delta }) => {
              const isDisabled = allPlays.length === 0 || playIndex <= 0;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: 'transparent',
                      opacity: isDisabled ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setPlayIndex((i) => Math.max(0, i + delta))}
                  disabled={isDisabled}>
                  <ThemedText
                    style={[styles.stepBtnText, { color: isDisabled ? colors.secondaryText : colors.tint }]}>
                    {delta}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [
                styles.autoplayBtn,
                {
                  backgroundColor: isAutoplay ? colors.cardBackground : 'transparent',
                  borderColor: isAutoplay ? colors.tint : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => {
                if (playIndex >= maxPlayIndex && !isAutoplay) {
                  setPlayIndex(0);
                }
                setIsAutoplay((v) => !v);
              }}
              disabled={allPlays.length === 0}>
              <MaterialIcons name={isAutoplay ? 'pause' : 'play-arrow'} size={18} color={isAutoplay ? colors.tint : colors.secondaryText} />
              <ThemedText style={[styles.autoplayLabel, { color: isAutoplay ? colors.tint : colors.secondaryText }]}>
                {isAutoplay ? 'Pause' : 'Play'}
              </ThemedText>
            </Pressable>
            {[
              { key: '+1', delta: 1 },
              { key: '+10', delta: 10 },
            ].map(({ key, delta }) => {
              const isDisabled = allPlays.length === 0 || playIndex >= maxPlayIndex;
              return (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: 'transparent',
                      opacity: isDisabled ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setPlayIndex((i) => Math.min(maxPlayIndex, i + delta))}
                  disabled={isDisabled}>
                  <ThemedText
                    style={[styles.stepBtnText, { color: isDisabled ? colors.secondaryText : colors.tint }]}>
                    +{delta}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [
                styles.stepBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: 'transparent',
                  opacity: allPlays.length === 0 || playIndex >= maxPlayIndex ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => setPlayIndex(maxPlayIndex)}
              disabled={allPlays.length === 0 || playIndex >= maxPlayIndex}>
              <MaterialIcons name="skip-next" size={18} color={playIndex >= maxPlayIndex ? colors.tabIconDefault : colors.tint} />
            </Pressable>
          </View>
          <View style={[styles.progressRow3, { borderTopColor: colors.border }]}>
            <View style={styles.intervalRow}>
              <ThemedText style={[styles.intervalLabel, { color: colors.secondaryText }]}>Auto-play interval:</ThemedText>
              {[3, 5, 10, 15, 30].map((sec) => {
                const isActive = autoplayIntervalSec === sec;
                return (
                  <Pressable
                    key={sec}
                    style={({ pressed }) => [
                      styles.intervalBtn,
                      {
                        backgroundColor: isActive ? colors.cardBackground : 'transparent',
                        borderColor: isActive ? colors.tint : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => setAutoplayIntervalSec(sec)}
                    disabled={allPlays.length === 0}>
                    <ThemedText style={[styles.intervalBtnText, { color: isActive ? colors.tint : colors.secondaryText }]}>
                      {sec}s
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

type LiveTeamStatsProps = {
  game: { awayTeamAbbrev?: string; homeTeamAbbrev?: string };
  liveStatsMap: Map<string, AccumulatedStats>;
  athleteToTeam: Map<string, string>;
  supabaseBoxScores: GameBoxScore[];
  isGameOver: boolean;
  atFinalPlay: boolean;
  playsLength: number;
  colorScheme: 'light' | 'dark';
};

function LiveTeamStats({
  game,
  liveStatsMap,
  athleteToTeam,
  supabaseBoxScores,
  isGameOver,
  atFinalPlay,
  playsLength,
  colorScheme,
}: LiveTeamStatsProps) {
  const awayAbbrev = game?.awayTeamAbbrev ?? '';
  const homeAbbrev = game?.homeTeamAbbrev ?? '';
  const leftColor = getTeamColor(awayAbbrev);
  const rightColor = getTeamColor(homeAbbrev);

  const teamStats = useMemo(() => {
    if (atFinalPlay && playsLength > 0 && supabaseBoxScores.length > 0) {
      const fromSupabase = aggregateBoxScoresByTeam(supabaseBoxScores, awayAbbrev, homeAbbrev);
      if (fromSupabase) return fromSupabase;
    }
    return aggregateLiveStatsByTeam(liveStatsMap, athleteToTeam, awayAbbrev, homeAbbrev);
  }, [atFinalPlay, playsLength, supabaseBoxScores, liveStatsMap, athleteToTeam, awayAbbrev, homeAbbrev]);

  const { away, home } = teamStats;

  return (
    <>
      <TeamComparisonBar label="Points" leftValue={away.ppg} rightValue={home.ppg} leftLabel={away.ppg.toFixed(0)} rightLabel={home.ppg.toFixed(0)} leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Assists" leftValue={away.apg} rightValue={home.apg} leftLabel={away.apg.toFixed(1)} rightLabel={home.apg.toFixed(1)} leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Rebounds" leftValue={away.rpg} rightValue={home.rpg} leftLabel={away.rpg.toFixed(1)} rightLabel={home.rpg.toFixed(1)} leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Steals" leftValue={away.spg} rightValue={home.spg} leftLabel={away.spg.toFixed(1)} rightLabel={home.spg.toFixed(1)} leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Blocks" leftValue={away.bpg} rightValue={home.bpg} leftLabel={away.bpg.toFixed(1)} rightLabel={home.bpg.toFixed(1)} leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Turnovers" leftValue={away.tpg} rightValue={home.tpg} leftLabel={away.tpg.toFixed(1)} rightLabel={home.tpg.toFixed(1)} lowerIsBetter leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Field Goal %" leftValue={away.fgPct} rightValue={home.fgPct} leftLabel={`${away.fgPct.toFixed(1)}%`} rightLabel={`${home.fgPct.toFixed(1)}%`} isPercent leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="3PT%" leftValue={away.threePtPct} rightValue={home.threePtPct} leftLabel={`${away.threePtPct.toFixed(1)}%`} rightLabel={`${home.threePtPct.toFixed(1)}%`} isPercent leftColor={leftColor} rightColor={rightColor} />
      <TeamComparisonBar label="Free Throw %" leftValue={away.ftPct} rightValue={home.ftPct} leftLabel={`${away.ftPct.toFixed(1)}%`} rightLabel={`${home.ftPct.toFixed(1)}%`} isPercent leftColor={leftColor} rightColor={rightColor} />
    </>
  );
}

type LivePropCardProps = {
  prop: PlayerProp;
  player: (GameBoxScore & { game_log?: unknown[] }) | null;
  liveStats: AccumulatedStats | null;
  leagueContext: { secondHalfP50: number; secondHalfP90: number; secondHalfP99: number } | null;
  plays: PlayByPlayRecord[];
  playIndex: number;
  statsAtQuarterEnds: {
    q1: Map<string, AccumulatedStats> | null;
    q2: Map<string, AccumulatedStats> | null;
    q3: Map<string, AccumulatedStats> | null;
    q4: Map<string, AccumulatedStats> | null;
  };
  currentPeriod: number;
  isGameOver: boolean;
  isLiveMode?: boolean;
  gameDate?: string | null;
  isOnCourt?: boolean;
  onRemove: (propId: string) => void;
};

const STATS_WITH_QUARTER_AVGS = new Set([
  'points',
  'rebounds',
  'assists',
  'turnovers',
  'steals',
  'blocks',
  'fouls',
  'three_pt_made',
  'two_pt_made',
  'free_throws_made',
]);

function LivePropCard({
  prop,
  player,
  liveStats,
  leagueContext,
  plays,
  playIndex,
  statsAtQuarterEnds,
  currentPeriod,
  isGameOver,
  isLiveMode = false,
  gameDate = null,
  isOnCourt = false,
  onRemove,
}: LivePropCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const { data: quarterRowsPrimary } = usePlayerQuarterStats(
    prop.playerId,
    SEASON,
    gameDate ?? undefined
  );
  const altAthleteId = (() => {
    const n = Number(prop.playerId);
    if (Number.isNaN(n)) return '';
    const s = String(n);
    return s !== prop.playerId ? s : '';
  })();
  const { data: quarterRowsAlt } = usePlayerQuarterStats(
    altAthleteId && !(quarterRowsPrimary?.length) ? altAthleteId : '',
    SEASON,
    gameDate ?? undefined
  );
  const quarterRows = (quarterRowsPrimary?.length ? quarterRowsPrimary : quarterRowsAlt) ?? [];
  const quarterContext = useMemo(
    () => computeQuarterContext(quarterRows),
    [quarterRows]
  );

  const filteredGameLog = useMemo(() => {
    if (!player?.game_log?.length) return null;
    const log = player.game_log as GameLogEntry[];
    if (!gameDate) return log;
    return log.filter((g) => (g.game_date ?? '') < gameDate);
  }, [player?.game_log, gameDate]);

  const liveInsight = useMemo(() => {
    if (!isSingleProp(prop)) return null;
    const playerHistory = filteredGameLog?.length
      ? { gameLog: filteredGameLog }
      : null;
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
  }, [prop, liveStats, filteredGameLog, quarterContext, quarterRows, leagueContext, statsAtQuarterEnds, currentPeriod]);

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

  const isLockedOut =
    isSingleProp(prop) &&
    liveInsight &&
    !isHit &&
    (prop.direction === 'under'
      ? liveInsight.currentValue > prop.line
      : isGameOver && liveInsight.currentValue < prop.line);
  const showBadge = isHit || isLockedOut || isGameOver;

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
            {isSingleProp(prop) && liveInsight && showBadge && (
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
            <View style={styles.propPlayerNameRow}>
              <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
              {isOnCourt && (
                <View style={styles.onCourtBadge}>
                  <ThemedText style={styles.onCourtBadgeText}>On court</ThemedText>
                </View>
              )}
            </View>
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
            <RiveProgressBar
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
          {prop.stat !== 'minutes' &&
            liveInsight.seasonAvg != null &&
            liveInsight.seasonAvg > 0 && (
              <View style={styles.quarterAvgsCompact}>
                {(() => {
                  const quarterKeys = ['q1', 'q2', 'q3', 'q4'] as const;
                  let prevCumulative = 0;
                  const hasRealQuarterData =
                    STATS_WITH_QUARTER_AVGS.has(prop.stat) &&
                    quarterContext != null &&
                    quarterContext.quarterAvgsByStat[prop.stat as QuarterAvgsStatKey] != null;
                  const quarterAvgs = hasRealQuarterData
                    ? quarterContext!.quarterAvgsByStat[prop.stat as QuarterAvgsStatKey]
                    : null;
                  const rows = [1, 2, 3, 4].map((q) => {
                    const avg = quarterAvgs
                      ? [quarterAvgs.avgQ1, quarterAvgs.avgQ2, quarterAvgs.avgQ3, quarterAvgs.avgQ4][q - 1]
                      : (liveInsight!.seasonAvg ?? 0) / 4;
                    const map = statsAtQuarterEnds[quarterKeys[q - 1]];
                    const qStats = map?.get(prop.playerId);
                    let result: number | null = null;
                    let delta: number | null = null;
                    let quarterCompleted = false;
                    if (qStats != null && currentPeriod >= q) {
                      const cumulative = getCurrentStatValue(qStats, prop.stat);
                      result = cumulative - prevCumulative;
                      prevCumulative = cumulative;
                      delta = result - avg;
                      quarterCompleted = isQuarterEndedAtPlayIndex(plays, playIndex, q);
                    } else if (
                      currentPeriod === q &&
                      liveStats != null
                    ) {
                      result = getCurrentStatValue(liveStats, prop.stat) - prevCumulative;
                      delta = result - avg;
                    }
                    const hasData = result != null;
                    const displayValue = result != null ? Math.round(result).toString() : '—';
                    return { q, avg, result, delta, quarterCompleted, hasData, displayValue };
                  });
                  return (
                    <>
                      <View style={styles.quarterAvgsCompactRow}>
                        <View style={styles.quarterAvgsCompactLabelPlaceholder} />
                        <View style={styles.quarterAvgsCompactQuarters}>
                          {[1, 2, 3, 4].map((q) => (
                            <View key={q} style={styles.quarterAvgsCompactCell}>
                              <ThemedText style={[styles.quarterAvgsCompactQ, { color: colors.secondaryText }]}>
                                Q{q}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View style={styles.quarterAvgsCompactRow}>
                        <View style={styles.quarterAvgsCompactLabelCol}>
                          <ThemedText style={[styles.quarterAvgsCompactLabel, { color: colors.secondaryText }]}>
                            Average{!quarterAvgs ? ' (est.)' : ''}
                          </ThemedText>
                        </View>
                        <View style={styles.quarterAvgsCompactQuarters}>
                          {rows.map(({ q, avg }) => (
                            <View key={q} style={styles.quarterAvgsCompactCell}>
                              <ThemedText style={[styles.quarterAvgsCompactVal, { color: colors.text }]}>
                                {avg.toFixed(1)}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View style={styles.quarterAvgsCompactRow}>
                        <View style={styles.quarterAvgsCompactLabelCol}>
                          <ThemedText style={[styles.quarterAvgsCompactLabel, { color: colors.secondaryText }]}>
                            Today
                          </ThemedText>
                        </View>
                        <View style={styles.quarterAvgsCompactQuarters}>
                          {rows.map(({ q, displayValue, hasData, delta, quarterCompleted }) => (
                            <View key={q} style={styles.quarterAvgsCompactCell}>
                              <View style={styles.quarterAvgsCompactActualRow}>
                                <ThemedText
                                  style={[
                                    styles.quarterAvgsCompactVal,
                                    { color: hasData ? colors.text : colors.secondaryText },
                                  ]}>
                                  {displayValue}
                                </ThemedText>
                                {delta != null && quarterCompleted ? (
                                  <ThemedText
                                    style={[
                                      styles.quarterAvgsCompactDelta,
                                      { color: delta >= 0 ? '#24d169' : '#e53935' },
                                    ]}>
                                    {' '}
                                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                                  </ThemedText>
                                ) : null}
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>
            )}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
  },
  scroll: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 16,
    overflow: 'visible',
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
  progressPlayDescription: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  progressRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  stepBtn: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  stepBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressRow3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 12,
  },
  autoplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  autoplayLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intervalLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  intervalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  intervalBtnText: {
    fontSize: 13,
    fontWeight: '500',
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
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  onCourtBadge: {
    borderWidth: 1,
    borderColor: '#373737',
    // backgroundColor: '#24d16940',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  onCourtBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#24d169',
    // color: '#fff',
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
    overflow: 'visible',
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
  propPlayerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  propDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  liveInsightSection: {
    marginTop: 12,
    // paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    overflow: 'visible',
  },
  quarterAvgsCompact: {
    marginTop: 0,
    marginBottom: 8,
    gap: 0,
  },
  quarterAvgsCompactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  quarterAvgsCompactLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  quarterAvgsCompactLabelPlaceholder: {
    width: 48,
  },
  quarterAvgsCompactLabelCol: {
    width: 48,
  },
  quarterAvgsCompactQuarters: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  quarterAvgsCompactCell: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  quarterAvgsCompactActualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  quarterAvgsCompactQ: {
    fontSize: 9,
    fontWeight: '600',
  },
  quarterAvgsCompactVal: {
    fontSize: 11,
    // fontWeight: '600',
  },
  quarterAvgsCompactDelta: {
    fontSize: 9,
    fontWeight: '600',
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
  playByPlaySection: {
    marginBottom: 20,
  },
  playByPlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addPropButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  addPropButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  playByPlayLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    // borderWidth: 1,
    // // borderColor: '#373737',
    backgroundColor: '#e5393580',
  },
  playByPlayLiveBadgeText: {
    fontSize: 14,
    // fontWeight: '600',
    // color: '#e53935',
  },
  playByPlayScrollWrap: {
    overflow: 'hidden',
    borderRadius: 8,
    position: 'relative',
  },
  playByPlayRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  playByPlayMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  playByPlayText: {
    fontSize: 13,
  },
  playByPlayGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 28,
    pointerEvents: 'none',
  },
  playByPlayGradientTop: {
    top: 0,
  },
  playByPlayGradientBottom: {
    bottom: 0,
  },
});
