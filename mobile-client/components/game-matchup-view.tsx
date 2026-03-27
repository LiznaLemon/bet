import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { GameMatchupDisplay } from '@/components/game-matchup-display';
import { InsightCarousel } from '@/components/insight-carousel';
import { PlayerAvatar } from '@/components/player-avatar';
import { SimilarPlayersModal } from '@/components/similar-players-modal';
import {
  TEAM_COMPARISON_LABEL_COLUMN_WIDTH,
  TEAM_COMPARISON_ROW_GAP,
  TeamComparisonBar,
} from '@/components/team-comparison-bar';
import { ThemedText } from '@/components/themed-text';
import { getTeamColor } from '@/constants/team-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type ESPNInjuryEntry } from '@/lib/queries/espn-live-game';
import { type GameBoxScore, useGameBoxScores } from '@/lib/queries/game-boxscores';
import { usePlayerStatRanks } from '@/lib/queries/players';
import { usePreviousMatchups } from '@/lib/queries/schedule';
import { useTeamMatchupContext } from '@/lib/queries/team-matchup-context';
import { useGameMatchupBundle } from '@/lib/queries/team-offensive-stats';
import { supabase } from '@/lib/supabase';
import type { GameLogEntry, Player, ScheduleGame } from '@/lib/types';
import {
  aggregateBoxScoresByTeam,
} from '@/lib/utils/game-team-stats';
import { athleteIdsOutFromInjuries } from '@/lib/utils/injury-roster';
import { getLeagueRank } from '@/lib/utils/league-team-rank';
import type { MatchupPointInTimeStats } from '@/lib/utils/matchup-insights';
import {
  computePlayerMatchupInsights,
  computeTeamMatchupInsights,
  getMatchupEligiblePlayers,
} from '@/lib/utils/matchup-insights';
import type { SimilarPlayerWithGames } from '@/lib/utils/player-similarity';
import { getAbbrevAliases, toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';
import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

const SEASON = 2026;

const KEY_MATCHUP_STAT_OPTIONS: { key: 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg'; label: string }[] = [
  { key: 'ppg', label: 'PTS' },
  { key: 'rpg', label: 'REB' },
  { key: 'apg', label: 'AST' },
  { key: 'spg', label: 'STL' },
  { key: 'bpg', label: 'BLK' },
];

function getPlayerStatValue(p: Player, stat: 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg'): number {
  return Number(p[stat]) || 0;
}

function getStatLabel(stat: 'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg'): string {
  const map: Record<string, string> = { ppg: 'PPG', rpg: 'RPG', apg: 'APG', spg: 'SPG', bpg: 'BPG' };
  return map[stat] ?? stat;
}

const GAME_LOG_STAT_KEY: Record<'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg', keyof GameLogEntry> = {
  ppg: 'points',
  rpg: 'rebounds',
  apg: 'assists',
  spg: 'steals',
  bpg: 'blocks',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getGamesVsOpponent(gameLog: GameLogEntry[], opp: string): GameLogEntry[] {
  const aliases = new Set(getAbbrevAliases(opp).map((a) => a.toUpperCase().trim()));
  return (gameLog ?? []).filter((g) =>
    aliases.has((g.opponent_team_abbreviation ?? '').toUpperCase().trim())
  );
}

function avgStat(games: GameLogEntry[], key: keyof GameLogEntry): number {
  if (!games.length) return 0;
  const sum = games.reduce((s, g) => s + ((g[key] as number) ?? 0), 0);
  return sum / games.length;
}

function getMatchupTeamColors(awayAbbrev: string, homeAbbrev: string): { awayColor: string; homeColor: string } {
  return {
    awayColor: getTeamColor(awayAbbrev),
    homeColor: getTeamColor(homeAbbrev),
  };
}

type GameMatchupViewProps = {
  game: ScheduleGame;
  players: Player[];
  boxScores: GameBoxScore[];
  injuries?: ESPNInjuryEntry[];
  /** ISO time from ESPN fetch; used for injury/report freshness copy. */
  liveDataFetchedAt?: string;
};

// ─── Injury Marquee ──────────────────────────────────────────────────────────

const MARQUEE_PX_PER_MS = 0.05; // scroll speed
const MARQUEE_FADE = 32;

function injuryStatusColor(status: string, secondaryText: string): string {
  const s = status.toLowerCase();
  if (s.includes('out')) return '#e53935';
  if (s.includes('day') || s === 'dtd') return '#ff9800';
  if (s.includes('quest')) return '#ffc107';
  return secondaryText;
}

function InjuryMarquee({
  injuries,
  bgColor,
  secondaryText,
}: {
  injuries: ESPNInjuryEntry[];
  bgColor: string;
  secondaryText: string;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [singleWidth, setSingleWidth] = useState(0);

  useEffect(() => {
    if (singleWidth <= 0) return;
    animRef.current?.stop();
    translateX.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -singleWidth,
        duration: singleWidth / MARQUEE_PX_PER_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();
    return () => { animRef.current?.stop(); };
  }, [singleWidth, translateX]);

  const renderItem = (inj: ESPNInjuryEntry, key: string) => (
    <View key={key} style={marqueeStyles.item}>
      <PlayerAvatar uri={inj.headshotUrl} size={36} />
      <View style={marqueeStyles.meta}>
        <Text style={marqueeStyles.name} numberOfLines={1}>
          {inj.playerName}
          {inj.teamAbbrev ? (
            <Text style={[marqueeStyles.name, marqueeStyles.teamAbbrev]}>{` (${inj.teamAbbrev})`}</Text>
          ) : null}
        </Text>
        <Text
          style={[marqueeStyles.status, { color: injuryStatusColor(inj.status, secondaryText) }]}
          numberOfLines={1}>
          {inj.status}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[marqueeStyles.wrapper, { backgroundColor: 'transparent' }]}>
      <Animated.View
        style={[marqueeStyles.track, { transform: [{ translateX }] }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setSingleWidth(w / 2);
        }}
      >
        {injuries.map((inj, i) => renderItem(inj, `a-${i}`))}
        {injuries.map((inj, i) => renderItem(inj, `b-${i}`))}
      </Animated.View>
      <LinearGradient
        colors={[bgColor, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[marqueeStyles.fade, marqueeStyles.fadeLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', bgColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[marqueeStyles.fade, marqueeStyles.fadeRight]}
        pointerEvents="none"
      />
    </View>
  );
}

const marqueeStyles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
    height: 52,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginRight: 24,
  },
  meta: {
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  teamAbbrev: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: MARQUEE_FADE,
    zIndex: 1,
  },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function GameMatchupView({
  game,
  players,
  boxScores,
  injuries = [],
  liveDataFetchedAt,
}: GameMatchupViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const {
    data: matchupBundle,
    isLoading: bundleLoading,
    isError: bundleError,
  } = useGameMatchupBundle(SEASON);
  const teamDefenseSeason = matchupBundle?.teamDefensiveAllModes?.season ?? [];
  const teamDefenseLast10 = matchupBundle?.teamDefensiveAllModes?.last10 ?? [];
  const teamDefenseLast5 = matchupBundle?.teamDefensiveAllModes?.last5 ?? [];
  const teamOffensiveSeason = matchupBundle?.teamOffensiveAllModes?.season ?? [];
  const teamOffensiveLast10 = matchupBundle?.teamOffensiveAllModes?.last10 ?? [];
  const teamOffensiveLast5 = matchupBundle?.teamOffensiveAllModes?.last5 ?? [];
  const leagueVariance = matchupBundle?.leagueVariance ?? null;
  const teamDefenseLoading = bundleLoading;
  const teamDefenseError = bundleError;
  const teamOffensiveLoading = bundleLoading;
  const teamOffensiveSeasonError = bundleError;

  const { data: matchupContext } = useTeamMatchupContext(
    game.awayTeamAbbrev,
    game.homeTeamAbbrev,
    SEASON,
    5
  );
  const awayRecentResults = matchupContext?.awayRecentResults;
  const homeRecentResults = matchupContext?.homeRecentResults;
  const activeAwayIds = matchupContext?.activeAwayIds ?? new Set<string>();
  const activeHomeIds = matchupContext?.activeHomeIds ?? new Set<string>();

  const [breakdownMode, setBreakdownMode] = useState<'season' | 'last10' | 'last5'>('season');
  const [breakdownStatType, setBreakdownStatType] = useState<'offense' | 'defense'>('offense');
  const [previousMatchupIndex, setPreviousMatchupIndex] = useState(0);
  const [previousMatchupExpanded, setPreviousMatchupExpanded] = useState(false);
  const [keyMatchupStat, setKeyMatchupStat] = useState<'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg'>('ppg');

  const displayAwayAbbrev = useMemo(
    () => toThreeLetterAbbrev((game.awayTeamAbbrev ?? '').toUpperCase().trim()),
    [game.awayTeamAbbrev]
  );
  const displayHomeAbbrev = useMemo(
    () => toThreeLetterAbbrev((game.homeTeamAbbrev ?? '').toUpperCase().trim()),
    [game.homeTeamAbbrev]
  );

  const { data: previousMatchups = [] } = usePreviousMatchups(
    game.homeTeamAbbrev,
    game.awayTeamAbbrev,
    SEASON,
    game.id
  );
  const selectedPreviousGame = previousMatchups[previousMatchupIndex] ?? null;
  const { data: previousBoxScores = [], isLoading: previousBoxScoresLoading } = useGameBoxScores(
    selectedPreviousGame?.id,
    SEASON
  );

  const previousMatchupStats = useMemo(() => {
    if (!selectedPreviousGame || !previousBoxScores.length) return null;
    return aggregateBoxScoresByTeam(
      previousBoxScores,
      game.awayTeamAbbrev ?? '',
      game.homeTeamAbbrev ?? ''
    );
  }, [selectedPreviousGame, previousBoxScores, game.awayTeamAbbrev, game.homeTeamAbbrev]);

  const previousScoreDisplay = useMemo(() => {
    if (!selectedPreviousGame || selectedPreviousGame.awayScore == null || selectedPreviousGame.homeScore == null) return null;
    const awayAbbrev = toThreeLetterAbbrev((game.awayTeamAbbrev ?? '').toUpperCase().trim());
    const homeAbbrev = toThreeLetterAbbrev((game.homeTeamAbbrev ?? '').toUpperCase().trim());
    const prevAway = toThreeLetterAbbrev((selectedPreviousGame.awayTeamAbbrev ?? '').toUpperCase().trim());
    const prevAwayScore = selectedPreviousGame.awayScore;
    const prevHomeScore = selectedPreviousGame.homeScore;
    const leftScore = prevAway === awayAbbrev ? prevAwayScore : prevHomeScore;
    const rightScore = prevAway === awayAbbrev ? prevHomeScore : prevAwayScore;
    const leftWon = leftScore > rightScore;
    const rightWon = rightScore > leftScore;
    const isTie = leftScore === rightScore;
    return { leftScore, rightScore, leftWon, rightWon, isTie };
  }, [selectedPreviousGame, game]);

  const [similarModalPlayer, setSimilarModalPlayer] = useState<{
    player: Player;
    similarPlayers: SimilarPlayerWithGames[] | null;
    isLoading: boolean;
  } | null>(null);

  const openSimilarModal = useCallback(
    async (player: Player) => {
      setSimilarModalPlayer({ player, similarPlayers: null, isLoading: true });
      try {
        const opp =
          toThreeLetterAbbrev((player.team_abbreviation ?? '').toUpperCase()) === displayHomeAbbrev
            ? displayAwayAbbrev
            : displayHomeAbbrev;
        const { data, error } = await supabase.rpc('get_similar_players', {
          p_athlete_id: player.athlete_id,
          p_opponent_abbrev: opp,
          p_season: SEASON,
          p_season_type: 2,
          p_k: 5,
        });
        if (error) throw error;
        const similar: SimilarPlayerWithGames[] = (data ?? []).map((row: Record<string, unknown>) => ({
          player: {
            athlete_id: String(row.athlete_id ?? ''),
            athlete_display_name: String(row.athlete_display_name ?? ''),
            athlete_headshot_href: String(row.athlete_headshot_href ?? ''),
            athlete_position_abbreviation: String(row.athlete_position_abbreviation ?? ''),
            team_abbreviation: String(row.team_abbreviation ?? ''),
            ppg: String(row.ppg ?? '0'),
            rpg: String(row.rpg ?? '0'),
            apg: String(row.apg ?? '0'),
            game_log: [],
          } as unknown as Player,
          similarityScore: Number(row.similarity_score ?? 0),
          gamesVsOpponent: (row.vs_game_log ?? []) as GameLogEntry[],
          avgPts: Number(row.avg_pts_vs ?? 0),
          avgReb: Number(row.avg_reb_vs ?? 0),
          avgAst: Number(row.avg_ast_vs ?? 0),
        }));
        setSimilarModalPlayer({ player, similarPlayers: similar, isLoading: false });
      } catch (err) {
        console.error('[openSimilarModal] Failed to load similar players:', err);
        setSimilarModalPlayer({ player, similarPlayers: [], isLoading: false });
      }
    },
    [displayAwayAbbrev, displayHomeAbbrev]
  );

  useEffect(() => {
    if (previousMatchupIndex >= previousMatchups.length && previousMatchups.length > 0) {
      setPreviousMatchupIndex(0);
    }
  }, [previousMatchups, previousMatchupIndex]);

  useEffect(() => {
    setPreviousMatchupExpanded(false);
  }, [previousMatchupIndex]);

  const seasonSeriesRecord = useMemo(() => {
    if (!previousMatchups.length) return null;
    const away = displayAwayAbbrev;
    const home = displayHomeAbbrev;
    let awayWins = 0;
    let homeWins = 0;
    for (const g of previousMatchups) {
      if (g.awayScore == null || g.homeScore == null) continue;
      const gAway = toThreeLetterAbbrev((g.awayTeamAbbrev ?? '').toUpperCase().trim());
      const gHome = toThreeLetterAbbrev((g.homeTeamAbbrev ?? '').toUpperCase().trim());
      if (gAway === away) {
        if (g.awayScore > g.homeScore) awayWins++;
        else homeWins++;
      } else if (gHome === away) {
        if (g.homeScore > g.awayScore) awayWins++;
        else homeWins++;
      }
    }
    return { awayWins, homeWins };
  }, [previousMatchups, displayAwayAbbrev, displayHomeAbbrev]);

  const seasonSeriesSummaryText = useMemo(() => {
    if (!seasonSeriesRecord) return null;
    const { awayWins, homeWins } = seasonSeriesRecord;
    const a = displayAwayAbbrev;
    const h = displayHomeAbbrev;
    if (awayWins === 0 && homeWins === 0) return null;
    if (awayWins === homeWins) return `${a} and ${h} split the season series ${awayWins}–${homeWins}.`;
    if (awayWins > homeWins) return `${a} leads the season series ${awayWins}–${homeWins}.`;
    return `${h} leads the season series ${homeWins}–${awayWins}.`;
  }, [seasonSeriesRecord, displayAwayAbbrev, displayHomeAbbrev]);

  const injuredOutAthleteIds = useMemo(
    () =>
      athleteIdsOutFromInjuries(
        players,
        injuries,
        game.awayTeamAbbrev ?? '',
        game.homeTeamAbbrev ?? ''
      ),
    [players, injuries, game.awayTeamAbbrev, game.homeTeamAbbrev]
  );

  const matchupEligiblePlayers = useMemo(
    () =>
      getMatchupEligiblePlayers(
        players,
        game.awayTeamAbbrev ?? '',
        game.homeTeamAbbrev ?? '',
        activeAwayIds,
        activeHomeIds,
        injuredOutAthleteIds
      ),
    [players, game.awayTeamAbbrev, game.homeTeamAbbrev, activeAwayIds, activeHomeIds, injuredOutAthleteIds]
  );

  const activeAwayPlayers = useMemo(
    () =>
      matchupEligiblePlayers.filter(
        (p) =>
          toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase().trim()) === displayAwayAbbrev
      ),
    [matchupEligiblePlayers, displayAwayAbbrev]
  );
  const activeHomePlayers = useMemo(
    () =>
      matchupEligiblePlayers.filter(
        (p) =>
          toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase().trim()) === displayHomeAbbrev
      ),
    [matchupEligiblePlayers, displayHomeAbbrev]
  );

  const breakdownTeamColors = useMemo(
    () => getMatchupTeamColors(game.awayTeamAbbrev ?? '', game.homeTeamAbbrev ?? ''),
    [game.awayTeamAbbrev, game.homeTeamAbbrev]
  );

  const previousMatchupTeamColors = useMemo(
    () => getMatchupTeamColors(game.awayTeamAbbrev ?? '', game.homeTeamAbbrev ?? ''),
    [game.awayTeamAbbrev, game.homeTeamAbbrev]
  );

  const teamOffensiveByMode =
    breakdownMode === 'season'
      ? teamOffensiveSeason
      : breakdownMode === 'last10'
        ? teamOffensiveLast10
        : teamOffensiveLast5;

  const breakdownStats = useMemo(() => {
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAliases = getAbbrevAliases(awayAbbrev);
    const homeAliases = getAbbrevAliases(homeAbbrev);
    const away = teamOffensiveByMode.find((t) =>
      awayAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    const home = teamOffensiveByMode.find((t) =>
      homeAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    if (away && home) {
      return {
        away: {
          ppg: away.pts_avg,
          rpg: away.reb_avg,
          apg: away.ast_avg,
          spg: away.stl_avg,
          bpg: away.blk_avg,
          tpg: away.tov_avg,
          fgPct: away.fg_pct ?? 0,
          threePtPct: away.three_pt_pct ?? 0,
          ftPct: away.ft_pct ?? 0,
        },
        home: {
          ppg: home.pts_avg,
          rpg: home.reb_avg,
          apg: home.ast_avg,
          spg: home.stl_avg,
          bpg: home.blk_avg,
          tpg: home.tov_avg,
          fgPct: home.fg_pct ?? 0,
          threePtPct: home.three_pt_pct ?? 0,
          ftPct: home.ft_pct ?? 0,
        },
      };
    }
    return null;
  }, [game.awayTeamAbbrev, game.homeTeamAbbrev, teamOffensiveByMode]);

  const breakdownLoading = teamOffensiveLoading;

  const SIG_K = 0.5;
  const significanceThresholds = useMemo(() => {
    if (!leagueVariance) return null;
    return {
      pts: leagueVariance.pts_std * SIG_K,
      ptsAllowed: leagueVariance.pts_allowed_std * SIG_K,
      reb: leagueVariance.reb_std * SIG_K,
      rebAllowed: leagueVariance.reb_allowed_std * SIG_K,
      ast: leagueVariance.ast_std * SIG_K,
      astAllowed: leagueVariance.ast_allowed_std * SIG_K,
      stl: leagueVariance.stl_std * SIG_K,
      blk: leagueVariance.blk_std * SIG_K,
      tov: leagueVariance.tov_std * SIG_K,
      fgPct: leagueVariance.fg_pct_std * SIG_K,
      fgPctAllowed: leagueVariance.fg_pct_allowed_std * SIG_K,
      threePtPct: leagueVariance.three_pt_pct_std * SIG_K,
      threePtPctAllowed: leagueVariance.three_pt_pct_allowed_std * SIG_K,
      ftPct: leagueVariance.ft_pct_std * SIG_K,
      ftPctAllowed: leagueVariance.ft_pct_allowed_std * SIG_K,
    };
  }, [leagueVariance]);

  const breakdownUnavailable =
    !breakdownStats && !breakdownLoading && (teamOffensiveSeasonError || teamOffensiveSeason.length === 0);

  const teamDefenseByMode =
    breakdownMode === 'season'
      ? teamDefenseSeason
      : breakdownMode === 'last10'
        ? teamDefenseLast10
        : teamDefenseLast5;

  const breakdownDefenseStats = useMemo(() => {
    if (!teamDefenseByMode.length) return null;
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAliases = getAbbrevAliases(awayAbbrev);
    const homeAliases = getAbbrevAliases(homeAbbrev);
    const away = teamDefenseByMode.find((t) =>
      awayAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    const home = teamDefenseByMode.find((t) =>
      homeAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    if (away && home) {
      return {
        away: {
          ptsAllowed: away.pts_allowed_avg,
          rebAllowed: away.reb_allowed_avg,
          astAllowed: away.ast_allowed_avg,
          fgPctAllowed: away.fg_pct_allowed ?? 0,
          threePtPctAllowed: away.three_pt_pct_allowed ?? 0,
          ftPctAllowed: away.ft_pct_allowed ?? 0,
        },
        home: {
          ptsAllowed: home.pts_allowed_avg,
          rebAllowed: home.reb_allowed_avg,
          astAllowed: home.ast_allowed_avg,
          fgPctAllowed: home.fg_pct_allowed ?? 0,
          threePtPctAllowed: home.three_pt_pct_allowed ?? 0,
          ftPctAllowed: home.ft_pct_allowed ?? 0,
        },
      };
    }
    return null;
  }, [game.awayTeamAbbrev, game.homeTeamAbbrev, teamDefenseByMode]);

  const breakdownDefenseUnavailable =
    breakdownStatType === 'defense' &&
    !breakdownDefenseStats &&
    (teamDefenseError || teamDefenseSeason.length === 0) &&
    !teamDefenseLoading;

  const seasonalBreakdownRanks = useMemo(() => {
    const awayAliases = getAbbrevAliases((game.awayTeamAbbrev ?? '').toUpperCase().trim());
    const homeAliases = getAbbrevAliases((game.homeTeamAbbrev ?? '').toUpperCase().trim());
    const o = teamOffensiveByMode;
    const d = teamDefenseByMode;
    const offense = o.length
      ? {
          ppg: {
            away: getLeagueRank(o, (t) => t.pts_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.pts_avg, false, homeAliases),
          },
          apg: {
            away: getLeagueRank(o, (t) => t.ast_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.ast_avg, false, homeAliases),
          },
          rpg: {
            away: getLeagueRank(o, (t) => t.reb_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.reb_avg, false, homeAliases),
          },
          spg: {
            away: getLeagueRank(o, (t) => t.stl_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.stl_avg, false, homeAliases),
          },
          bpg: {
            away: getLeagueRank(o, (t) => t.blk_avg, false, awayAliases),
            home: getLeagueRank(o, (t) => t.blk_avg, false, homeAliases),
          },
          tpg: {
            away: getLeagueRank(o, (t) => t.tov_avg, true, awayAliases),
            home: getLeagueRank(o, (t) => t.tov_avg, true, homeAliases),
          },
          fgPct: {
            away: getLeagueRank(o, (t) => t.fg_pct ?? 0, false, awayAliases),
            home: getLeagueRank(o, (t) => t.fg_pct ?? 0, false, homeAliases),
          },
          threePtPct: {
            away: getLeagueRank(o, (t) => t.three_pt_pct ?? 0, false, awayAliases),
            home: getLeagueRank(o, (t) => t.three_pt_pct ?? 0, false, homeAliases),
          },
          ftPct: {
            away: getLeagueRank(o, (t) => t.ft_pct ?? 0, false, awayAliases),
            home: getLeagueRank(o, (t) => t.ft_pct ?? 0, false, homeAliases),
          },
        }
      : null;
    const defense = d.length
      ? {
          ptsAllowed: {
            away: getLeagueRank(d, (t) => t.pts_allowed_avg, true, awayAliases),
            home: getLeagueRank(d, (t) => t.pts_allowed_avg, true, homeAliases),
          },
          rebAllowed: {
            away: getLeagueRank(d, (t) => t.reb_allowed_avg, true, awayAliases),
            home: getLeagueRank(d, (t) => t.reb_allowed_avg, true, homeAliases),
          },
          astAllowed: {
            away: getLeagueRank(d, (t) => t.ast_allowed_avg, true, awayAliases),
            home: getLeagueRank(d, (t) => t.ast_allowed_avg, true, homeAliases),
          },
          fgPctAllowed: {
            away: getLeagueRank(d, (t) => t.fg_pct_allowed ?? 0, true, awayAliases),
            home: getLeagueRank(d, (t) => t.fg_pct_allowed ?? 0, true, homeAliases),
          },
          threePtPctAllowed: {
            away: getLeagueRank(d, (t) => t.three_pt_pct_allowed ?? 0, true, awayAliases),
            home: getLeagueRank(d, (t) => t.three_pt_pct_allowed ?? 0, true, homeAliases),
          },
          ftPctAllowed: {
            away: getLeagueRank(d, (t) => t.ft_pct_allowed ?? 0, true, awayAliases),
            home: getLeagueRank(d, (t) => t.ft_pct_allowed ?? 0, true, homeAliases),
          },
        }
      : null;
    return { offense, defense };
  }, [teamOffensiveByMode, teamDefenseByMode, game.awayTeamAbbrev, game.homeTeamAbbrev]);

  const mismatchAlertPlayerIds = useMemo(() => {
    const allActive = [...activeAwayPlayers, ...activeHomePlayers];
    const rpgRanked = [...allActive].sort((a, b) => (Number(b.rpg) || 0) - (Number(a.rpg) || 0));
    const ppgRanked = [...allActive].sort((a, b) => (Number(b.ppg) || 0) - (Number(a.ppg) || 0));
    const topAwayRebounder = rpgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeRebounder = rpgRanked.find((p) => activeHomePlayers.includes(p));
    const topAwayScorer = ppgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeScorer = ppgRanked.find((p) => activeHomePlayers.includes(p));
    return [
      topAwayRebounder?.athlete_id,
      topHomeRebounder?.athlete_id,
      topAwayScorer?.athlete_id,
      topHomeScorer?.athlete_id,
    ].filter(Boolean) as string[];
  }, [activeAwayPlayers, activeHomePlayers]);

  const { data: playerStatRanks = {} } = usePlayerStatRanks(SEASON, mismatchAlertPlayerIds);

  const mismatchAlerts = useMemo(() => {
    if (teamDefenseError || !teamDefenseSeason.length) return [];
    const alerts: string[] = [];
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAliases = getAbbrevAliases(homeAbbrev);
    const awayAliases = getAbbrevAliases(awayAbbrev);

    const homeDef = teamDefenseSeason.find((t) =>
      homeAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );
    const awayDef = teamDefenseSeason.find((t) =>
      awayAliases.includes((t.team_abbreviation ?? '').toUpperCase().trim())
    );

    const allActive = [...activeAwayPlayers, ...activeHomePlayers];
    const rpgRanked = [...allActive].sort((a, b) => (Number(b.rpg) || 0) - (Number(a.rpg) || 0));
    const ppgRanked = [...allActive].sort((a, b) => (Number(b.ppg) || 0) - (Number(a.ppg) || 0));
    const topAwayRebounder = rpgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeRebounder = rpgRanked.find((p) => activeHomePlayers.includes(p));
    const topAwayScorer = ppgRanked.find((p) => activeAwayPlayers.includes(p));
    const topHomeScorer = ppgRanked.find((p) => activeHomePlayers.includes(p));

    if (homeDef && topAwayRebounder && homeDef.reb_allowed_rank <= 5) {
      const rpg = Number(topAwayRebounder.rpg) || 0;
      const rank = playerStatRanks[topAwayRebounder.athlete_id]?.rpg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayHomeAbbrev} allows ${homeDef.reb_allowed_avg.toFixed(1)} RPG (#${homeDef.reb_allowed_rank}). ${topAwayRebounder.athlete_display_name}: ${rpg.toFixed(1)} RPG${rankStr}`
      );
    }
    if (awayDef && topHomeRebounder && awayDef.reb_allowed_rank <= 5) {
      const rpg = Number(topHomeRebounder.rpg) || 0;
      const rank = playerStatRanks[topHomeRebounder.athlete_id]?.rpg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayAwayAbbrev} allows ${awayDef.reb_allowed_avg.toFixed(1)} RPG (#${awayDef.reb_allowed_rank}). ${topHomeRebounder.athlete_display_name}: ${rpg.toFixed(1)} RPG${rankStr}`
      );
    }
    if (homeDef && topAwayScorer && homeDef.pts_allowed_rank >= 25) {
      const ppg = Number(topAwayScorer.ppg) || 0;
      const rank = playerStatRanks[topAwayScorer.athlete_id]?.ppg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayHomeAbbrev} allows ${homeDef.pts_allowed_avg.toFixed(1)} PPG (#${homeDef.pts_allowed_rank}). ${topAwayScorer.athlete_display_name}: ${ppg.toFixed(1)} PPG${rankStr}`
      );
    }
    if (awayDef && topHomeScorer && awayDef.pts_allowed_rank >= 25) {
      const ppg = Number(topHomeScorer.ppg) || 0;
      const rank = playerStatRanks[topHomeScorer.athlete_id]?.ppg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${displayAwayAbbrev} allows ${awayDef.pts_allowed_avg.toFixed(1)} PPG (#${awayDef.pts_allowed_rank}). ${topHomeScorer.athlete_display_name}: ${ppg.toFixed(1)} PPG${rankStr}`
      );
    }
    return alerts;
  }, [
    teamDefenseSeason,
    activeHomePlayers,
    activeAwayPlayers,
    playerStatRanks,
    displayHomeAbbrev,
    displayAwayAbbrev,
  ]);

  const pointInTimeStatsByPlayerId = useMemo(() => {
    const gameDate = game.gameDate ?? null;
    const allPlayers = [...activeAwayPlayers, ...activeHomePlayers];
    const result: Record<string, Record<'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg', number>> = {};
    for (const p of allPlayers) {
      const log = (p.game_log ?? []) as GameLogEntry[];
      const filtered = gameDate ? log.filter((g) => (g.game_date ?? '') < gameDate) : log;
      const avg = (key: keyof GameLogEntry) => avgStat(filtered, key);
      result[p.athlete_id] = {
        ppg: avg('points'),
        rpg: avg('rebounds'),
        apg: avg('assists'),
        spg: avg('steals'),
        bpg: avg('blocks'),
      };
    }
    return result;
  }, [activeAwayPlayers, activeHomePlayers, game.gameDate]);

  const topPlayersByStat = useMemo(
    () =>
      [...activeAwayPlayers, ...activeHomePlayers]
        .sort((a, b) => {
          const aVal = pointInTimeStatsByPlayerId[a.athlete_id]?.[keyMatchupStat] ?? getPlayerStatValue(a, keyMatchupStat);
          const bVal = pointInTimeStatsByPlayerId[b.athlete_id]?.[keyMatchupStat] ?? getPlayerStatValue(b, keyMatchupStat);
          return bVal - aVal;
        })
        .slice(0, 6),
    [activeAwayPlayers, activeHomePlayers, keyMatchupStat, pointInTimeStatsByPlayerId]
  );

  const teamMatchupInsights = useMemo(() => {
    if (!awayRecentResults || !homeRecentResults) return [];
    return computeTeamMatchupInsights(
      game,
      teamOffensiveSeason,
      teamOffensiveLast5,
      teamDefenseSeason,
      awayRecentResults,
      homeRecentResults
    );
  }, [
    game,
    teamOffensiveSeason,
    teamOffensiveLast5,
    teamDefenseSeason,
    awayRecentResults,
    homeRecentResults,
  ]);

  const playerMatchupInsights = useMemo(() => {
    const pit: MatchupPointInTimeStats = {};
    for (const p of [...activeAwayPlayers, ...activeHomePlayers]) {
      const s = pointInTimeStatsByPlayerId[p.athlete_id];
      if (s) pit[p.athlete_id] = { ppg: s.ppg, apg: s.apg };
    }
    return computePlayerMatchupInsights(game, players, activeAwayIds, activeHomeIds, {
      excludeAthleteIds: injuredOutAthleteIds,
      pointInTimeByPlayerId: pit,
    });
  }, [
    game,
    players,
    activeAwayIds,
    activeHomeIds,
    activeAwayPlayers,
    activeHomePlayers,
    pointInTimeStatsByPlayerId,
    injuredOutAthleteIds,
  ]);

  const liveDataAsOfLabel = useMemo(() => {
    if (!liveDataFetchedAt) return null;
    try {
      const d = new Date(liveDataFetchedAt);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [liveDataFetchedAt]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}>

      <View style={styles.sectionOpen}>
        <GameMatchupDisplay game={game} colorScheme={colorScheme ?? 'light'} />
      </View>

      {injuries.length > 0 && (() => {
        const awayAbbrevSet = new Set(
          getAbbrevAliases(displayAwayAbbrev).map((a) => a.toUpperCase())
        );
        const homeAbbrevSet = new Set(
          getAbbrevAliases(displayHomeAbbrev).map((a) => a.toUpperCase())
        );
        const awayInjuries = injuries.filter((i) =>
          awayAbbrevSet.has((i.teamAbbrev ?? '').toUpperCase())
        );
        const homeInjuries = injuries.filter((i) =>
          homeAbbrevSet.has((i.teamAbbrev ?? '').toUpperCase())
        );
        const statusSortOrder = (status: string) => {
          const s = status.toLowerCase();
          if (s.includes('out')) return 0;
          if (s.includes('day') || s === 'dtd') return 1;
          if (s.includes('quest')) return 2;
          return 3;
        };
        const sortInjuries = (list: ESPNInjuryEntry[]) =>
          [...list].sort((a, b) => statusSortOrder(a.status) - statusSortOrder(b.status));
        const allInjuries = [...sortInjuries(awayInjuries), ...sortInjuries(homeInjuries)];
        return (
          <View style={styles.sectionOpen}>
            <ThemedText style={styles.sectionTitle}>Injury Report</ThemedText>
            <InjuryMarquee
              injuries={allInjuries}
              bgColor={colors.background}
              secondaryText={colors.secondaryText}
            />
            {liveDataAsOfLabel ? (
              <ThemedText style={[styles.dataFreshness, { color: colors.secondaryText }]}>
                Injury report and live data as of {liveDataAsOfLabel}
              </ThemedText>
            ) : null}
          </View>
        );
      })()}

      {!injuries.length && liveDataAsOfLabel ? (
        <View style={styles.sectionOpen}>
          <ThemedText style={[styles.dataFreshness, { color: colors.secondaryText }]}>
            Live data as of {liveDataAsOfLabel}
          </ThemedText>
        </View>
      ) : null}

      {/* Mismatch alerts temporarily disabled
      {mismatchAlerts.length > 0 && (
        <View style={[styles.sectionOpen, { backgroundColor: colors.tint + '20' }]}>
          <ThemedText style={styles.sectionTitle}>Mismatch Alerts</ThemedText>
          {mismatchAlerts.map((msg, i) => (
            <View
              key={i}
              style={[styles.alertCard, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.alertText}>{msg}</ThemedText>
            </View>
          ))}
        </View>
      )}
      */}

      {(breakdownStats || breakdownDefenseStats || breakdownLoading || teamDefenseLoading || breakdownUnavailable || breakdownDefenseUnavailable) && (
        <View style={styles.sectionOpen}>
          <ThemedText style={styles.sectionTitle}>Seasonal Breakdown</ThemedText>
          <View style={[styles.breakdownFilterRow, styles.breakdownFilterRowFirst]}>
            <FilterOptionButtons
              options={[
                { key: 'offense', label: 'Offense' },
                { key: 'defense', label: 'Defense' },
              ]}
              value={breakdownStatType}
              onSelect={(k) => setBreakdownStatType(k as 'offense' | 'defense')}
              colorScheme={colorScheme ?? 'light'}
            />
          </View>
          <View style={styles.breakdownFilterRow}>
            <FilterOptionButtons
              options={[
                { key: 'season', label: 'Season' },
                { key: 'last10', label: 'Last 10' },
                { key: 'last5', label: 'Last 5' },
              ]}
              value={breakdownMode}
              onSelect={(k) => setBreakdownMode(k as 'season' | 'last10' | 'last5')}
              colorScheme={colorScheme ?? 'light'}
              scrollable
            />
          </View>
          {teamMatchupInsights.length > 0 && (
            <InsightCarousel
              insights={teamMatchupInsights}
              style={styles.insightCarousel}
              cycleDurationMs={5000}
            />
          )}
          {(breakdownStatType === 'offense' && breakdownStats) ||
          (breakdownStatType === 'defense' && breakdownDefenseStats) ? (
            <>
              <View style={[styles.breakdownTeamHeader, { gap: TEAM_COMPARISON_ROW_GAP }]}>
                <View style={styles.breakdownTeamHeaderAway}>
                  <ThemedText
                    style={[
                      styles.previousScoreHomeAway,
                      styles.breakdownTeamHeaderAwayText,
                      { color: colors.secondaryText },
                    ]}>
                    Away
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.teamAbbrev,
                      styles.previousScoreTeamName,
                      styles.breakdownTeamHeaderAwayText,
                      { color: '#ffffff' },
                    ]}>
                    {displayAwayAbbrev}
                  </ThemedText>
                </View>
                <View
                  style={{ width: TEAM_COMPARISON_LABEL_COLUMN_WIDTH, flexShrink: 0 }}
                  accessible={false}
                />
                <View style={styles.breakdownTeamHeaderHome}>
                  <ThemedText
                    style={[
                      styles.previousScoreHomeAway,
                      styles.breakdownTeamHeaderHomeText,
                      { color: colors.secondaryText },
                    ]}>
                    Home
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.teamAbbrev,
                      styles.previousScoreTeamName,
                      styles.breakdownTeamHeaderHomeText,
                      { color: '#ffffff' },
                    ]}>
                    {displayHomeAbbrev}
                  </ThemedText>
                </View>
              </View>
              {breakdownStatType === 'offense' && breakdownStats ? (
                <>
                  <TeamComparisonBar
                    label="Points"
                    leftValue={breakdownStats.away.ppg}
                    rightValue={breakdownStats.home.ppg}
                    leftLabel={breakdownStats.away.ppg.toFixed(1)}
                    rightLabel={breakdownStats.home.ppg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.ppg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.ppg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.pts })}
                  />
                  <TeamComparisonBar
                    label="Assists"
                    leftValue={breakdownStats.away.apg}
                    rightValue={breakdownStats.home.apg}
                    leftLabel={breakdownStats.away.apg.toFixed(1)}
                    rightLabel={breakdownStats.home.apg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.apg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.apg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ast })}
                  />
                  <TeamComparisonBar
                    label="Rebounds"
                    leftValue={breakdownStats.away.rpg}
                    rightValue={breakdownStats.home.rpg}
                    leftLabel={breakdownStats.away.rpg.toFixed(1)}
                    rightLabel={breakdownStats.home.rpg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.rpg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.rpg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.reb })}
                  />
                  <TeamComparisonBar
                    label="Steals"
                    leftValue={breakdownStats.away.spg}
                    rightValue={breakdownStats.home.spg}
                    leftLabel={breakdownStats.away.spg.toFixed(1)}
                    rightLabel={breakdownStats.home.spg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.spg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.spg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.stl })}
                  />
                  <TeamComparisonBar
                    label="Blocks"
                    leftValue={breakdownStats.away.bpg}
                    rightValue={breakdownStats.home.bpg}
                    leftLabel={breakdownStats.away.bpg.toFixed(1)}
                    rightLabel={breakdownStats.home.bpg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.bpg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.bpg.home ?? undefined}
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.blk })}
                  />
                  <TeamComparisonBar
                    label="Turnovers"
                    leftValue={breakdownStats.away.tpg}
                    rightValue={breakdownStats.home.tpg}
                    leftLabel={breakdownStats.away.tpg.toFixed(1)}
                    rightLabel={breakdownStats.home.tpg.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.offense?.tpg.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.tpg.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.tov })}
                  />
                  <TeamComparisonBar
                    label="Field Goal %"
                    leftValue={breakdownStats.away.fgPct}
                    rightValue={breakdownStats.home.fgPct}
                    leftLabel={`${breakdownStats.away.fgPct.toFixed(1)}%`}
                    rightLabel={`${breakdownStats.home.fgPct.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.offense?.fgPct.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.fgPct.home ?? undefined}
                    isPercent
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.fgPct })}
                  />
                  <TeamComparisonBar
                    label="3PT%"
                    leftValue={breakdownStats.away.threePtPct}
                    rightValue={breakdownStats.home.threePtPct}
                    leftLabel={`${breakdownStats.away.threePtPct.toFixed(1)}%`}
                    rightLabel={`${breakdownStats.home.threePtPct.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.offense?.threePtPct.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.threePtPct.home ?? undefined}
                    isPercent
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.threePtPct })}
                  />
                  <TeamComparisonBar
                    label="Free Throw %"
                    leftValue={breakdownStats.away.ftPct}
                    rightValue={breakdownStats.home.ftPct}
                    leftLabel={`${breakdownStats.away.ftPct.toFixed(1)}%`}
                    rightLabel={`${breakdownStats.home.ftPct.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.offense?.ftPct.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.offense?.ftPct.home ?? undefined}
                    isPercent
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ftPct })}
                  />
                </>
              ) : breakdownDefenseStats ? (
                <>
                  <TeamComparisonBar
                    label="Points Allowed"
                    leftValue={breakdownDefenseStats.away.ptsAllowed}
                    rightValue={breakdownDefenseStats.home.ptsAllowed}
                    leftLabel={breakdownDefenseStats.away.ptsAllowed.toFixed(1)}
                    rightLabel={breakdownDefenseStats.home.ptsAllowed.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.defense?.ptsAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.ptsAllowed.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ptsAllowed })}
                  />
                  <TeamComparisonBar
                    label="Rebounds Allowed"
                    leftValue={breakdownDefenseStats.away.rebAllowed}
                    rightValue={breakdownDefenseStats.home.rebAllowed}
                    leftLabel={breakdownDefenseStats.away.rebAllowed.toFixed(1)}
                    rightLabel={breakdownDefenseStats.home.rebAllowed.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.defense?.rebAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.rebAllowed.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.rebAllowed })}
                  />
                  <TeamComparisonBar
                    label="Assists Allowed"
                    leftValue={breakdownDefenseStats.away.astAllowed}
                    rightValue={breakdownDefenseStats.home.astAllowed}
                    leftLabel={breakdownDefenseStats.away.astAllowed.toFixed(1)}
                    rightLabel={breakdownDefenseStats.home.astAllowed.toFixed(1)}
                    leftRank={seasonalBreakdownRanks?.defense?.astAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.astAllowed.home ?? undefined}
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.astAllowed })}
                  />
                  <TeamComparisonBar
                    label="FG% Allowed"
                    leftValue={breakdownDefenseStats.away.fgPctAllowed}
                    rightValue={breakdownDefenseStats.home.fgPctAllowed}
                    leftLabel={`${breakdownDefenseStats.away.fgPctAllowed.toFixed(1)}%`}
                    rightLabel={`${breakdownDefenseStats.home.fgPctAllowed.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.defense?.fgPctAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.fgPctAllowed.home ?? undefined}
                    isPercent
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.fgPctAllowed })}
                  />
                  <TeamComparisonBar
                    label="3PT% Allowed"
                    leftValue={breakdownDefenseStats.away.threePtPctAllowed}
                    rightValue={breakdownDefenseStats.home.threePtPctAllowed}
                    leftLabel={`${breakdownDefenseStats.away.threePtPctAllowed.toFixed(1)}%`}
                    rightLabel={`${breakdownDefenseStats.home.threePtPctAllowed.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.defense?.threePtPctAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.threePtPctAllowed.home ?? undefined}
                    isPercent
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.threePtPctAllowed })}
                  />
                  <TeamComparisonBar
                    label="FT% Allowed"
                    leftValue={breakdownDefenseStats.away.ftPctAllowed}
                    rightValue={breakdownDefenseStats.home.ftPctAllowed}
                    leftLabel={`${breakdownDefenseStats.away.ftPctAllowed.toFixed(1)}%`}
                    rightLabel={`${breakdownDefenseStats.home.ftPctAllowed.toFixed(1)}%`}
                    leftRank={seasonalBreakdownRanks?.defense?.ftPctAllowed.away ?? undefined}
                    rightRank={seasonalBreakdownRanks?.defense?.ftPctAllowed.home ?? undefined}
                    isPercent
                    lowerIsBetter
                    {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                    {...(significanceThresholds && { significanceThreshold: significanceThresholds.ftPctAllowed })}
                  />
                </>
              ) : null}
            </>
          ) : (breakdownStatType === 'offense' && breakdownUnavailable) ||
            (breakdownStatType === 'defense' && breakdownDefenseUnavailable) ? (
            <View style={styles.loadingPlaceholder}>
              <ThemedText style={[styles.breakdownLoadingText, { color: colors.secondaryText }]}>
                Team stats unavailable.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.loadingPlaceholder}>
              <ActivityIndicator size="small" color={colors.tint} />
              <ThemedText style={[styles.breakdownLoadingText, { color: colors.secondaryText }]}>
                Loading team stats…
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {previousMatchups.length > 0 && (
        <View style={styles.sectionOpen}>
          <ThemedText style={styles.sectionTitle}>Previous Matchups</ThemedText>
          {seasonSeriesSummaryText ? (
            <ThemedText style={[styles.seriesLine, { color: colors.secondaryText }]}>
              {seasonSeriesSummaryText}
            </ThemedText>
          ) : null}
          {previousMatchups.length > 1 && (
            <View style={styles.breakdownFilterRow}>
              <FilterOptionButtons
                options={previousMatchups.map((g, i) => ({
                  key: String(i),
                  label: formatDate(g.gameDate),
                }))}
                value={String(previousMatchupIndex)}
                onSelect={(k) => setPreviousMatchupIndex(Number(k))}
                colorScheme={colorScheme ?? 'light'}
                scrollable
              />
            </View>
          )}
          {selectedPreviousGame && (
            <>
              {previousMatchups.length === 1 && (
                <ThemedText style={[styles.venue, { color: colors.secondaryText, marginBottom: 8 }]}>
                  {formatDate(selectedPreviousGame.gameDate)}
                </ThemedText>
              )}
              {previousScoreDisplay && (
                <>
                  <View style={styles.previousScoreRow}>
                    <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
                      {previousScoreDisplay.leftWon || previousScoreDisplay.isTie ? (
                        <ThemedText
                          style={[styles.previousScoreText, previousScoreDisplay.leftWon && { color: '#24d169' }]}
                          numberOfLines={1}>
                          {previousScoreDisplay.leftScore}
                        </ThemedText>
                      ) : (
                        <View style={styles.previousScoreOutlineWrap}>
                          {[[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dy]) => (
                            <Text key={`${dx}-${dy}`} style={[styles.previousScoreText, styles.previousScoreOutlineStroke, { left: dx, top: dy }]} numberOfLines={1}>
                              {previousScoreDisplay.leftScore}
                            </Text>
                          ))}
                          <ThemedText style={[styles.previousScoreText, styles.previousScoreOutlineFill, { color: colors.background }]} numberOfLines={1}>
                            {previousScoreDisplay.leftScore}
                          </ThemedText>
                        </View>
                      )}
                      <ThemedText style={[styles.previousScoreHomeAway, { color: colors.secondaryText }]}>Away</ThemedText>
                      <ThemedText style={[styles.previousScoreTeamName, { color: '#ffffff' }]}>
                        {displayAwayAbbrev}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.scoreDash, styles.previousScoreDash, { color: colors.secondaryText }]}>–</ThemedText>
                    <View style={[styles.previousScoreSide, styles.previousScoreColumn]}>
                      {previousScoreDisplay.rightWon || previousScoreDisplay.isTie ? (
                        <ThemedText
                          style={[styles.previousScoreText, previousScoreDisplay.rightWon && { color: '#24d169' }]}
                          numberOfLines={1}>
                          {previousScoreDisplay.rightScore}
                        </ThemedText>
                      ) : (
                        <View style={styles.previousScoreOutlineWrap}>
                          {[[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dy]) => (
                            <Text key={`${dx}-${dy}`} style={[styles.previousScoreText, styles.previousScoreOutlineStroke, { left: dx, top: dy }]} numberOfLines={1}>
                              {previousScoreDisplay.rightScore}
                            </Text>
                          ))}
                          <ThemedText style={[styles.previousScoreText, styles.previousScoreOutlineFill, { color: colors.background }]} numberOfLines={1}>
                            {previousScoreDisplay.rightScore}
                          </ThemedText>
                        </View>
                      )}
                      <ThemedText style={[styles.previousScoreHomeAway, { color: colors.secondaryText }]}>Home</ThemedText>
                      <ThemedText style={[styles.teamAbbrev, styles.previousScoreTeamName, { color: '#ffffff' }]}>
                        {displayHomeAbbrev}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    style={styles.expandPreviousRow}
                    onPress={() => setPreviousMatchupExpanded((e) => !e)}
                    hitSlop={8}>
                    <ThemedText style={[styles.expandPreviousText, { color: colors.tint }]}>
                      {previousMatchupExpanded ? 'Hide game stats' : 'Show game stats'}
                    </ThemedText>
                    <Feather
                      name={previousMatchupExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.tint}
                    />
                  </Pressable>
                </>
              )}
              {previousMatchupExpanded && previousScoreDisplay ? (
                previousBoxScoresLoading ? (
                  <View style={styles.loadingPlaceholder}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.breakdownLoadingText, { color: colors.secondaryText }]}>
                      Loading game stats…
                    </ThemedText>
                  </View>
                ) : previousMatchupStats ? (
                  <>
                  <TeamComparisonBar
                    label="Assists"
                    leftValue={previousMatchupStats.away.apg}
                    rightValue={previousMatchupStats.home.apg}
                    leftLabel={String(Math.round(previousMatchupStats.away.apg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.apg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Rebounds"
                    leftValue={previousMatchupStats.away.rpg}
                    rightValue={previousMatchupStats.home.rpg}
                    leftLabel={String(Math.round(previousMatchupStats.away.rpg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.rpg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Steals"
                    leftValue={previousMatchupStats.away.spg}
                    rightValue={previousMatchupStats.home.spg}
                    leftLabel={String(Math.round(previousMatchupStats.away.spg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.spg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Blocks"
                    leftValue={previousMatchupStats.away.bpg}
                    rightValue={previousMatchupStats.home.bpg}
                    leftLabel={String(Math.round(previousMatchupStats.away.bpg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.bpg))}
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Turnovers"
                    leftValue={previousMatchupStats.away.tpg}
                    rightValue={previousMatchupStats.home.tpg}
                    leftLabel={String(Math.round(previousMatchupStats.away.tpg))}
                    rightLabel={String(Math.round(previousMatchupStats.home.tpg))}
                    lowerIsBetter
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Field Goal %"
                    leftValue={previousMatchupStats.away.fgPct}
                    rightValue={previousMatchupStats.home.fgPct}
                    leftLabel={`${previousMatchupStats.away.fgPct.toFixed(1)}%`}
                    rightLabel={`${previousMatchupStats.home.fgPct.toFixed(1)}%`}
                    isPercent
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="3PT%"
                    leftValue={previousMatchupStats.away.threePtPct}
                    rightValue={previousMatchupStats.home.threePtPct}
                    leftLabel={`${previousMatchupStats.away.threePtPct.toFixed(1)}%`}
                    rightLabel={`${previousMatchupStats.home.threePtPct.toFixed(1)}%`}
                    isPercent
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  <TeamComparisonBar
                    label="Free Throw %"
                    leftValue={previousMatchupStats.away.ftPct}
                    rightValue={previousMatchupStats.home.ftPct}
                    leftLabel={`${previousMatchupStats.away.ftPct.toFixed(1)}%`}
                    rightLabel={`${previousMatchupStats.home.ftPct.toFixed(1)}%`}
                    isPercent
                    {...(previousMatchupTeamColors && { leftColor: previousMatchupTeamColors.awayColor, rightColor: previousMatchupTeamColors.homeColor })}
                  />
                  </>
                ) : null
              ) : null}
            </>
          )}
        </View>
      )}

      <View style={styles.sectionOpen}>
        <ThemedText style={styles.sectionTitle}>Season Leaders</ThemedText>
        <View style={styles.breakdownFilterRow}>
          <FilterOptionButtons
            options={KEY_MATCHUP_STAT_OPTIONS}
            value={keyMatchupStat}
            onSelect={(k) => setKeyMatchupStat(k as typeof keyMatchupStat)}
            colorScheme={colorScheme ?? 'light'}
            scrollable
          />
        </View>
        {playerMatchupInsights.length > 0 && (
          <InsightCarousel
            insights={playerMatchupInsights}
            style={styles.insightCarousel}
            cycleDurationMs={5000}
          />
        )}
        <View style={styles.matchupGrid}>
          {topPlayersByStat.map((p) => {
            const isAway =
              toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase()) === displayAwayAbbrev;
            const opp = isAway ? displayHomeAbbrev : displayAwayAbbrev;
            const pitStats = pointInTimeStatsByPlayerId[p.athlete_id];
            const fullLog = (p.game_log ?? []) as GameLogEntry[];
            const pitLog = game.gameDate
              ? fullLog.filter((g) => (g.game_date ?? '') < game.gameDate!)
              : fullLog;
            const gamesVs = getGamesVsOpponent(pitLog, opp);
            const logKey = GAME_LOG_STAT_KEY[keyMatchupStat];
            const vsLine =
              gamesVs.length > 0
                ? `vs ${opp}: ${avgStat(gamesVs, logKey).toFixed(1)} ${getStatLabel(keyMatchupStat)} in ${gamesVs.length} games`
                : null;
            return (
              <View key={p.athlete_id} style={styles.matchupRow}>
                <Pressable
                  style={styles.playerRow}
                  onPress={() => router.push(`/player/${p.athlete_id}`)}>
                  <PlayerAvatar uri={p.athlete_headshot_href} size={44} />
                  <View style={styles.playerMeta}>
                    <ThemedText style={styles.playerName}>
                      {p.athlete_display_name}
                      <ThemedText style={[styles.playerTeamAbbrev, { color: colors.secondaryText }]}>
                        {' '}({toThreeLetterAbbrev((p.team_abbreviation ?? '').toUpperCase())})
                      </ThemedText>
                    </ThemedText>
                    <ThemedText style={[styles.playerStat, { color: colors.secondaryText }]}>
                      {(() => {
                        const fmt = (v: number) => v.toFixed(1);
                        const primary = `${fmt(pitStats?.[keyMatchupStat] ?? getPlayerStatValue(p, keyMatchupStat))} ${getStatLabel(keyMatchupStat)}`;
                        const others = (['ppg', 'rpg', 'apg'] as const).filter((s) => s !== keyMatchupStat);
                        const rest = others.map((s) => `${fmt(pitStats?.[s] ?? getPlayerStatValue(p, s))} ${getStatLabel(s)}`).join(' • ');
                        return rest ? `${primary} • ${rest}` : primary;
                      })()}
                    </ThemedText>
                    {vsLine && (
                      <ThemedText style={[styles.vsLine, { color: colors.tint }]}>
                        {vsLine}
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
                {/* <View style={styles.similarSection}>
                  <TouchableOpacity
                    style={[styles.seeSimilarBtn, { borderColor: colors.tint }]}
                    onPress={() => openSimilarModal(p)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <ThemedText style={[styles.seeSimilarText, { color: colors.tint }]}>
                      See similar players
                    </ThemedText>
                  </TouchableOpacity>
                </View> */}
              </View>
            );
          })}
        </View>
      </View>

      {game.completed && boxScores.length > 0 && (
        <View style={[styles.sectionOpen, { backgroundColor: colors.cardBackground }]}>
          <ThemedText style={styles.sectionTitle}>Top Performers</ThemedText>
          {(() => {
            const byTeam = boxScores.reduce(
              (acc, b) => {
                const raw = (b.team_abbreviation ?? '').toUpperCase();
                const t = toThreeLetterAbbrev(raw) || raw;
                if (!acc[t]) acc[t] = [];
                acc[t].push(b);
                return acc;
              },
              {} as Record<string, GameBoxScore[]>
            );
            const homeAbbrev = toThreeLetterAbbrev((game.homeTeamAbbrev ?? '').toUpperCase()) || (game.homeTeamAbbrev ?? '').toUpperCase();
            const awayAbbrev = toThreeLetterAbbrev((game.awayTeamAbbrev ?? '').toUpperCase()) || (game.awayTeamAbbrev ?? '').toUpperCase();
            const homeTop = (byTeam[homeAbbrev] ?? []).slice(0, 3);
            const awayTop = (byTeam[awayAbbrev] ?? []).slice(0, 3);
            return (
              <View style={styles.boxScoreList}>
                {awayTop.map((b) => (
                  <View key={b.athlete_id} style={styles.boxScoreRow}>
                    <PlayerAvatar uri={b.athlete_headshot_href} size={36} />
                    <View style={styles.boxScoreMeta}>
                      <ThemedText style={styles.boxScoreName}>{b.athlete_display_name}</ThemedText>
                      <ThemedText style={[styles.boxScoreStat, { color: colors.secondaryText }]}>
                        {b.points} pts, {b.rebounds} reb, {b.assists} ast
                      </ThemedText>
                    </View>
                  </View>
                ))}
                {homeTop.map((b) => (
                  <View key={b.athlete_id} style={styles.boxScoreRow}>
                    <PlayerAvatar uri={b.athlete_headshot_href} size={36} />
                    <View style={styles.boxScoreMeta}>
                      <ThemedText style={styles.boxScoreName}>{b.athlete_display_name}</ThemedText>
                      <ThemedText style={[styles.boxScoreStat, { color: colors.secondaryText }]}>
                        {b.points} pts, {b.rebounds} reb, {b.assists} ast
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>
      )}

      {similarModalPlayer && (
        <SimilarPlayersModal
          visible={!!similarModalPlayer}
          onClose={() => setSimilarModalPlayer(null)}
          sourcePlayerName={similarModalPlayer.player.athlete_display_name}
          similarPlayers={similarModalPlayer.similarPlayers}
          isLoading={similarModalPlayer.isLoading}
          opponentAbbrev={
            toThreeLetterAbbrev((similarModalPlayer.player.team_abbreviation ?? '').toUpperCase()) ===
            displayHomeAbbrev
              ? displayAwayAbbrev
              : displayHomeAbbrev
          }
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 40,
  },
  venue: {
    fontSize: 14,
    marginTop: 4,
  },
  previousScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 0,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  previousScoreSide: {
    flex: 1,
    alignItems: 'flex-start',
  },
  previousScoreColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  previousScoreHomeAway: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 14,
  },
  previousScoreTeamName: {
    marginTop: 2,
    fontWeight: '700',
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
  previousScoreDash: {
    fontSize: 32,
  },
  scoreDash: {
    fontSize: 24,
  },
  sectionOpen: {
    marginHorizontal: 12,
    // marginBottom: 20,
    // paddingTop: 12,
    // paddingBottom: 4,
    // borderTopWidth: 1,
    // borderTopColor: 'rgba(37, 37, 37, 0.5)',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 37, 37, 0.95)',
  },
  seriesLine: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  dataFreshness: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  expandPreviousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  expandPreviousText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  breakdownFilterRow: {
    marginBottom: 12,
  },
  breakdownFilterRowFirst: {
    paddingLeft: 24,
  },
  insightCarousel: {
    marginBottom: 12,
  },
  breakdownTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  breakdownTeamHeaderAway: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  breakdownTeamHeaderAwayText: {
    textAlign: 'right',
    paddingRight: 4,
  },
  breakdownTeamHeaderHome: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
    alignSelf: 'stretch',
    paddingLeft: 20,
  },
  breakdownTeamHeaderHomeText: {
    textAlign: 'left',
  },
  teamAbbrev: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  breakdownLoadingText: {
    fontSize: 14,
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 14,
  },
  matchupGrid: {
    gap: 16,
  },
  matchupRow: {
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerMeta: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerTeamAbbrev: {
    fontSize: 14,
    fontWeight: '400',
  },
  playerStat: {
    fontSize: 13,
    marginTop: 2,
  },
  vsLine: {
    fontSize: 12,
    marginTop: 2,
  },
  similarSection: {
    marginTop: 8,
    marginLeft: 56,
  },
  seeSimilarBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  seeSimilarText: {
    fontSize: 14,
    fontWeight: '500',
  },
  boxScoreList: {
    gap: 12,
  },
  boxScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boxScoreMeta: {
    flex: 1,
  },
  boxScoreName: {
    fontSize: 15,
    fontWeight: '600',
  },
  boxScoreStat: {
    fontSize: 13,
    marginTop: 2,
  },
});
