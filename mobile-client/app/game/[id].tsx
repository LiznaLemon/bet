import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { GameMatchupDisplay } from '@/components/game-matchup-display';
import { InsightCarousel } from '@/components/insight-carousel';
import { SimilarPlayersModal } from '@/components/similar-players-modal';
import { TeamComparisonBar } from '@/components/team-comparison-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGameBoxScores, type GameBoxScore } from '@/lib/queries/game-boxscores';
import { fetchPlayers, usePlayerStatRanks } from '@/lib/queries/players';
import { usePlayersForTeams } from '@/lib/queries/players-for-teams';
import { useGame, usePreviousMatchups, useSchedule } from '@/lib/queries/schedule';
import { useTeamDefensiveStatsAllModes } from '@/lib/queries/team-defensive-stats';
import { useTeamMatchupContext } from '@/lib/queries/team-matchup-context';
import {
  useLeagueStatVariance,
  useTeamOffensiveStatsAllModes,
} from '@/lib/queries/team-offensive-stats';
import type { GameLogEntry, Player } from '@/lib/types';
import {
  computePlayerMatchupInsights,
  computeTeamMatchupInsights,
} from '@/lib/utils/matchup-insights';
import {
  getSimilarPlayers,
  type SimilarPlayerWithGames,
} from '@/lib/utils/player-similarity';
import { getAbbrevAliases } from '@/lib/utils/team-abbreviation';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

function formatLastGameDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getLastGameDate(player: Player): string | null {
  const log = (player.game_log ?? []) as GameLogEntry[];
  if (!log.length) return null;
  const sorted = [...log].sort((a, b) => (b.game_date ?? '').localeCompare(a.game_date ?? ''));
  return sorted[0]?.game_date ?? null;
}

function getGamesVsOpponent(gameLog: GameLogEntry[], opp: string): GameLogEntry[] {
  const o = (opp ?? '').toUpperCase().trim();
  return (gameLog ?? []).filter(
    (g) => (g.opponent_team_abbreviation ?? '').toUpperCase().trim() === o
  );
}

function avgStat(games: GameLogEntry[], key: keyof GameLogEntry): number {
  if (!games.length) return 0;
  const sum = games.reduce((s, g) => s + ((g[key] as number) ?? 0), 0);
  return sum / games.length;
}

/** Extract team colors from box scores. Returns { awayColor, homeColor } or null if missing. */
function getTeamColorsFromBoxScores(
  boxScores: GameBoxScore[],
  awayAbbrev: string,
  homeAbbrev: string
): { awayColor: string; homeColor: string } | null {
  const awayUpper = (awayAbbrev ?? '').toUpperCase().trim();
  const homeUpper = (homeAbbrev ?? '').toUpperCase().trim();
  let awayColor: string | null = null;
  let homeColor: string | null = null;
  for (const b of boxScores) {
    const t = (b.team_abbreviation ?? '').toUpperCase().trim();
    const c = b.team_color ? (b.team_color.startsWith('#') ? b.team_color : `#${b.team_color}`) : null;
    if (t === awayUpper && c) awayColor = c;
    if (t === homeUpper && c) homeColor = c;
    if (awayColor && homeColor) break;
  }
  return awayColor && homeColor ? { awayColor, homeColor } : null;
}

/** Aggregate box scores by team into game totals. Returns { away, home } keyed by current game's team order. */
function aggregateBoxScoresByTeam(
  boxScores: GameBoxScore[],
  awayAbbrev: string,
  homeAbbrev: string
): { away: GameTeamStats; home: GameTeamStats } | null {
  const awayUpper = (awayAbbrev ?? '').toUpperCase().trim();
  const homeUpper = (homeAbbrev ?? '').toUpperCase().trim();
  const byTeam = boxScores.reduce(
    (acc, b) => {
      const t = (b.team_abbreviation ?? '').toUpperCase().trim();
      if (!acc[t]) {
        acc[t] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, f3pm: 0, f3pa: 0, ftm: 0, fta: 0 };
      }
      acc[t].pts += b.points;
      acc[t].reb += b.rebounds;
      acc[t].ast += b.assists;
      acc[t].stl += b.steals;
      acc[t].blk += b.blocks;
      acc[t].tov += b.turnovers;
      acc[t].fgm += b.field_goals_made;
      acc[t].fga += b.field_goals_attempted;
      acc[t].f3pm += b.three_point_made;
      acc[t].f3pa += b.three_point_attempted;
      acc[t].ftm += b.free_throws_made;
      acc[t].fta += b.free_throws_attempted;
      return acc;
    },
    {} as Record<string, { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fgm: number; fga: number; f3pm: number; f3pa: number; ftm: number; fta: number }>
  );
  const awayData = byTeam[awayUpper];
  const homeData = byTeam[homeUpper];
  if (!awayData || !homeData) return null;
  return {
    away: {
      ppg: awayData.pts,
      rpg: awayData.reb,
      apg: awayData.ast,
      spg: awayData.stl,
      bpg: awayData.blk,
      tpg: awayData.tov,
      fgPct: awayData.fga > 0 ? (100 * awayData.fgm) / awayData.fga : 0,
      threePtPct: awayData.f3pa > 0 ? (100 * awayData.f3pm) / awayData.f3pa : 0,
      ftPct: awayData.fta > 0 ? (100 * awayData.ftm) / awayData.fta : 0,
    },
    home: {
      ppg: homeData.pts,
      rpg: homeData.reb,
      apg: homeData.ast,
      spg: homeData.stl,
      bpg: homeData.blk,
      tpg: homeData.tov,
      fgPct: homeData.fga > 0 ? (100 * homeData.fgm) / homeData.fga : 0,
      threePtPct: homeData.f3pa > 0 ? (100 * homeData.f3pm) / homeData.f3pa : 0,
      ftPct: homeData.fta > 0 ? (100 * homeData.ftm) / homeData.fta : 0,
    },
  };
}

type GameTeamStats = {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number;
  fgPct: number;
  threePtPct: number;
  ftPct: number;
};

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const queryClient = useQueryClient();

  const { data: game, isLoading: gameLoading } = useGame(id, SEASON);
  const { data: scheduleData = [] } = useSchedule(SEASON);
  const { data: players = [], isLoading: playersLoading } = usePlayersForTeams(
    game?.awayTeamAbbrev,
    game?.homeTeamAbbrev,
    SEASON
  );
  const { data: boxScores = [], isLoading: boxLoading } = useGameBoxScores(id, SEASON);
  const {
    data: teamDefenseAllModes,
    isLoading: teamDefenseLoading,
    isError: teamDefenseError,
  } = useTeamDefensiveStatsAllModes(SEASON);
  const teamDefenseSeason = teamDefenseAllModes?.season ?? [];
  const teamDefenseLast10 = teamDefenseAllModes?.last10 ?? [];
  const teamDefenseLast5 = teamDefenseAllModes?.last5 ?? [];
  const {
    data: teamOffensiveAllModes,
    isLoading: teamOffensiveLoading,
    isError: teamOffensiveSeasonError,
  } = useTeamOffensiveStatsAllModes(SEASON);
  const teamOffensiveSeason = teamOffensiveAllModes?.season ?? [];
  const teamOffensiveLast10 = teamOffensiveAllModes?.last10 ?? [];
  const teamOffensiveLast5 = teamOffensiveAllModes?.last5 ?? [];
  const { data: leagueVariance } = useLeagueStatVariance(SEASON);

  const { data: matchupContext } = useTeamMatchupContext(
    game?.awayTeamAbbrev,
    game?.homeTeamAbbrev,
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
  const [keyMatchupStat, setKeyMatchupStat] = useState<'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg'>('ppg');

  const { data: previousMatchups = [] } = usePreviousMatchups(
    game?.homeTeamAbbrev,
    game?.awayTeamAbbrev,
    SEASON,
    id
  );
  const selectedPreviousGame = previousMatchups[previousMatchupIndex] ?? null;
  const { data: previousBoxScores = [], isLoading: previousBoxScoresLoading } = useGameBoxScores(
    selectedPreviousGame?.id,
    SEASON
  );

  const previousMatchupStats = useMemo(() => {
    if (!selectedPreviousGame || !previousBoxScores.length || !game) return null;
    return aggregateBoxScoresByTeam(
      previousBoxScores,
      game.awayTeamAbbrev ?? '',
      game.homeTeamAbbrev ?? ''
    );
  }, [selectedPreviousGame, previousBoxScores, game?.awayTeamAbbrev, game?.homeTeamAbbrev]);

  /** Maps previous game scores to current game team order (left = away, right = home) and winner info */
  const previousScoreDisplay = useMemo(() => {
    if (!selectedPreviousGame || !game || selectedPreviousGame.awayScore == null || selectedPreviousGame.homeScore == null) return null;
    const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase();
    const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase();
    const prevAway = (selectedPreviousGame.awayTeamAbbrev ?? '').toUpperCase();
    const prevHome = (selectedPreviousGame.homeTeamAbbrev ?? '').toUpperCase();
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
        const allPlayers = await queryClient.fetchQuery({
          queryKey: ['players', SEASON],
          queryFn: () => fetchPlayers(SEASON),
        });
        const opp =
          (player.team_abbreviation ?? '').toUpperCase() === (game?.homeTeamAbbrev ?? '').toUpperCase()
            ? (game?.awayTeamAbbrev ?? '')
            : (game?.homeTeamAbbrev ?? '');
        const similar = getSimilarPlayers(player, allPlayers, opp, 5);
        setSimilarModalPlayer({ player, similarPlayers: similar, isLoading: false });
      } catch (err) {
        console.error('[openSimilarModal] Failed to load similar players:', err);
        setSimilarModalPlayer({ player, similarPlayers: [], isLoading: false });
      }
    },
    [queryClient, game?.awayTeamAbbrev, game?.homeTeamAbbrev]
  );

  useEffect(() => {
    if (previousMatchupIndex >= previousMatchups.length && previousMatchups.length > 0) {
      setPreviousMatchupIndex(0);
    }
  }, [previousMatchups, previousMatchupIndex]);

  const homePlayers = useMemo(() => {
    const abbrev = (game?.homeTeamAbbrev ?? '').toUpperCase().trim();
    return players.filter((p) => (p.team_abbreviation ?? '').toUpperCase().trim() === abbrev);
  }, [players, game?.homeTeamAbbrev]);

  const awayPlayers = useMemo(() => {
    const abbrev = (game?.awayTeamAbbrev ?? '').toUpperCase().trim();
    return players.filter((p) => (p.team_abbreviation ?? '').toUpperCase().trim() === abbrev);
  }, [players, game?.awayTeamAbbrev]);

  /** Active = played in team's last 5 games. Inactive = did not. Fallback: if active set empty, treat all as active. */
  const activeHomePlayers = useMemo(() => {
    if (!activeHomeIds.size) return homePlayers;
    return homePlayers.filter((p) => activeHomeIds.has(p.athlete_id));
  }, [homePlayers, activeHomeIds]);
  const activeAwayPlayers = useMemo(() => {
    if (!activeAwayIds.size) return awayPlayers;
    return awayPlayers.filter((p) => activeAwayIds.has(p.athlete_id));
  }, [awayPlayers, activeAwayIds]);
  const inactiveHomePlayers = useMemo(() => {
    if (!activeHomeIds.size) return [];
    return homePlayers.filter((p) => !activeHomeIds.has(p.athlete_id));
  }, [homePlayers, activeHomeIds]);
  const inactiveAwayPlayers = useMemo(() => {
    if (!activeAwayIds.size) return [];
    return awayPlayers.filter((p) => !activeAwayIds.has(p.athlete_id));
  }, [awayPlayers, activeAwayIds]);

  /** Team colors for Seasonal Breakdown: prefer box scores, fall back to players for immediate display */
  const breakdownTeamColors = useMemo(() => {
    if (!game) return null;
    const scores = boxScores.length > 0 ? boxScores : previousBoxScores;
    const fromBoxScores = getTeamColorsFromBoxScores(scores, game.awayTeamAbbrev ?? '', game.homeTeamAbbrev ?? '');
    if (fromBoxScores) return fromBoxScores;
    const awayColor = awayPlayers[0]?.team_color;
    const homeColor = homePlayers[0]?.team_color;
    if (awayColor && homeColor) {
      return {
        awayColor: awayColor.startsWith('#') ? awayColor : `#${awayColor}`,
        homeColor: homeColor.startsWith('#') ? homeColor : `#${homeColor}`,
      };
    }
    return null;
  }, [game, boxScores, previousBoxScores, awayPlayers, homePlayers]);

  /** Team colors for Previous Matchups: prefer box scores, fall back to players for immediate display */
  const previousMatchupTeamColors = useMemo(() => {
    if (!game) return null;
    const fromBoxScores = previousBoxScores.length > 0
      ? getTeamColorsFromBoxScores(previousBoxScores, game.awayTeamAbbrev ?? '', game.homeTeamAbbrev ?? '')
      : null;
    if (fromBoxScores) return fromBoxScores;
    const awayColor = awayPlayers[0]?.team_color;
    const homeColor = homePlayers[0]?.team_color;
    if (awayColor && homeColor) {
      return {
        awayColor: awayColor.startsWith('#') ? awayColor : `#${awayColor}`,
        homeColor: homeColor.startsWith('#') ? homeColor : `#${homeColor}`,
      };
    }
    return null;
  }, [game, previousBoxScores, awayPlayers, homePlayers]);

  const teamOffensiveByMode =
    breakdownMode === 'season'
      ? teamOffensiveSeason
      : breakdownMode === 'last10'
        ? teamOffensiveLast10
        : teamOffensiveLast5;

  const breakdownStats = useMemo(() => {
    const awayAbbrev = (game?.awayTeamAbbrev ?? '').toUpperCase().trim();
    const homeAbbrev = (game?.homeTeamAbbrev ?? '').toUpperCase().trim();
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
  }, [game?.awayTeamAbbrev, game?.homeTeamAbbrev, teamOffensiveByMode]);

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
    if (!game || !teamDefenseByMode.length) return null;
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
  }, [game?.awayTeamAbbrev, game?.homeTeamAbbrev, teamDefenseByMode]);

  const breakdownDefenseUnavailable =
    breakdownStatType === 'defense' &&
    !breakdownDefenseStats &&
    (teamDefenseError || !teamDefenseAllModes) &&
    !teamDefenseLoading;

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
    if (teamDefenseError || !teamDefenseSeason.length || !game) return [];
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
        `${game.homeTeamAbbrev} allows ${homeDef.reb_allowed_avg.toFixed(1)} RPG (#${homeDef.reb_allowed_rank}). ${topAwayRebounder.athlete_display_name}: ${rpg.toFixed(1)} RPG${rankStr}`
      );
    }
    if (awayDef && topHomeRebounder && awayDef.reb_allowed_rank <= 5) {
      const rpg = Number(topHomeRebounder.rpg) || 0;
      const rank = playerStatRanks[topHomeRebounder.athlete_id]?.rpg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${game.awayTeamAbbrev} allows ${awayDef.reb_allowed_avg.toFixed(1)} RPG (#${awayDef.reb_allowed_rank}). ${topHomeRebounder.athlete_display_name}: ${rpg.toFixed(1)} RPG${rankStr}`
      );
    }

    if (homeDef && topAwayScorer && homeDef.pts_allowed_rank >= 25) {
      const ppg = Number(topAwayScorer.ppg) || 0;
      const rank = playerStatRanks[topAwayScorer.athlete_id]?.ppg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${game.homeTeamAbbrev} allows ${homeDef.pts_allowed_avg.toFixed(1)} PPG (#${homeDef.pts_allowed_rank}). ${topAwayScorer.athlete_display_name}: ${ppg.toFixed(1)} PPG${rankStr}`
      );
    }
    if (awayDef && topHomeScorer && awayDef.pts_allowed_rank >= 25) {
      const ppg = Number(topHomeScorer.ppg) || 0;
      const rank = playerStatRanks[topHomeScorer.athlete_id]?.ppg_rank;
      const rankStr = rank != null ? ` (#${rank})` : '';
      alerts.push(
        `${game.awayTeamAbbrev} allows ${awayDef.pts_allowed_avg.toFixed(1)} PPG (#${awayDef.pts_allowed_rank}). ${topHomeScorer.athlete_display_name}: ${ppg.toFixed(1)} PPG${rankStr}`
      );
    }
    return alerts;
  }, [game, teamDefenseSeason, activeHomePlayers, activeAwayPlayers, playerStatRanks]);

  const topPlayersByStat = useMemo(
    () =>
      [...activeAwayPlayers, ...activeHomePlayers]
        .sort((a, b) => getPlayerStatValue(b, keyMatchupStat) - getPlayerStatValue(a, keyMatchupStat))
        .slice(0, 6),
    [activeAwayPlayers, activeHomePlayers, keyMatchupStat]
  );

  const teamMatchupInsights = useMemo(() => {
    if (!game || !awayRecentResults || !homeRecentResults) return [];
    return computeTeamMatchupInsights(
      game,
      teamOffensiveSeason,
      teamOffensiveLast5,
      teamDefenseSeason,
      awayRecentResults,
      homeRecentResults,
      scheduleData
    );
  }, [
    game,
    teamOffensiveSeason,
    teamOffensiveLast5,
    teamDefenseSeason,
    awayRecentResults,
    homeRecentResults,
    scheduleData,
  ]);

  const playerMatchupInsights = useMemo(() => {
    if (!game) return [];
    return computePlayerMatchupInsights(game, players, activeAwayIds, activeHomeIds);
  }, [game, players, activeAwayIds, activeHomeIds]);

  const isLoading = gameLoading || (game && playersLoading);

  if (!id) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={styles.center}>
          <ThemedText>Invalid game</ThemedText>
        </ThemedView>
      </>
    );
  }

  if (gameLoading && !game) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading game...
          </ThemedText>
        </ThemedView>
      </>
    );
  }

  if (!game) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={styles.center}>
          <ThemedText>Game not found</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText style={{ color: colors.tint }}>Go back</ThemedText>
          </Pressable>
        </ThemedView>
      </>
    );
  }

  const title = `${game.awayTeamAbbrev} @ ${game.homeTeamAbbrev}`;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}>
          {/* Header - matches Schedule card layout */}
          <View style={styles.header}>
            <GameMatchupDisplay game={game} colorScheme={colorScheme ?? 'light'} />
            <Pressable
              style={({ pressed }) => [
                styles.liveSimButton,
                { backgroundColor: colors.tint + '20', opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => router.push(`/game/${id}/live-sim` as const)}>
              <ThemedText style={[styles.liveSimButtonText, { color: colors.tint }]}>
                Simulate Live
              </ThemedText>
            </Pressable>
          </View>

          {/* Mismatch alerts */}
          {mismatchAlerts.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.tint + '20' }]}>
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

          {/* Team comparison - Seasonal Breakdown with horizontal bars */}
          {(breakdownStats || breakdownDefenseStats || breakdownLoading || teamDefenseLoading || breakdownUnavailable || breakdownDefenseUnavailable) && (
            <View style={styles.section}>
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
                  <View style={styles.breakdownTeamHeader}>
                    <View style={styles.breakdownTeamHeaderColumn}>
                      <ThemedText style={[styles.previousScoreHomeAway, { color: colors.secondaryText }]}>Away</ThemedText>
                      <ThemedText style={[styles.teamAbbrev, styles.previousScoreTeamName, { color: '#ffffff' }]}>
                        {game.awayTeamAbbrev}
                      </ThemedText>
                    </View>
                    <View style={styles.breakdownTeamHeaderColumn}>
                      <ThemedText style={[styles.previousScoreHomeAway, { color: colors.secondaryText }]}>Home</ThemedText>
                      <ThemedText style={[styles.teamAbbrev, styles.previousScoreTeamName, { color: '#ffffff' }]}>
                        {game.homeTeamAbbrev}
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
                        {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                        {...(significanceThresholds && { significanceThreshold: significanceThresholds.pts })}
                      />
                      <TeamComparisonBar
                        label="Assists"
                        leftValue={breakdownStats.away.apg}
                        rightValue={breakdownStats.home.apg}
                        leftLabel={breakdownStats.away.apg.toFixed(1)}
                        rightLabel={breakdownStats.home.apg.toFixed(1)}
                        {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                        {...(significanceThresholds && { significanceThreshold: significanceThresholds.ast })}
                      />
                      <TeamComparisonBar
                        label="Rebounds"
                        leftValue={breakdownStats.away.rpg}
                        rightValue={breakdownStats.home.rpg}
                        leftLabel={breakdownStats.away.rpg.toFixed(1)}
                        rightLabel={breakdownStats.home.rpg.toFixed(1)}
                        {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                        {...(significanceThresholds && { significanceThreshold: significanceThresholds.reb })}
                      />
                      <TeamComparisonBar
                        label="Steals"
                        leftValue={breakdownStats.away.spg}
                        rightValue={breakdownStats.home.spg}
                        leftLabel={breakdownStats.away.spg.toFixed(1)}
                        rightLabel={breakdownStats.home.spg.toFixed(1)}
                        {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                        {...(significanceThresholds && { significanceThreshold: significanceThresholds.stl })}
                      />
                      <TeamComparisonBar
                        label="Blocks"
                        leftValue={breakdownStats.away.bpg}
                        rightValue={breakdownStats.home.bpg}
                        leftLabel={breakdownStats.away.bpg.toFixed(1)}
                        rightLabel={breakdownStats.home.bpg.toFixed(1)}
                        {...(breakdownTeamColors && { leftColor: breakdownTeamColors.awayColor, rightColor: breakdownTeamColors.homeColor })}
                        {...(significanceThresholds && { significanceThreshold: significanceThresholds.blk })}
                      />
                      <TeamComparisonBar
                        label="Turnovers"
                        leftValue={breakdownStats.away.tpg}
                        rightValue={breakdownStats.home.tpg}
                        leftLabel={breakdownStats.away.tpg.toFixed(1)}
                        rightLabel={breakdownStats.home.tpg.toFixed(1)}
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

          {/* Previous Matchups */}
          {previousMatchups.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Previous Matchups</ThemedText>
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
                          {game.awayTeamAbbrev}
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
                          {game.homeTeamAbbrev}
                        </ThemedText>
                      </View>
                    </View>
                  )}
                  {previousBoxScoresLoading ? (
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
                  ) : null}
                </>
              )}
            </View>
          )}

          {/* Key matchups */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Key Matchups</ThemedText>
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
                  (p.team_abbreviation ?? '').toUpperCase() === (game.awayTeamAbbrev ?? '').toUpperCase();
                const opp = isAway ? (game.homeTeamAbbrev ?? '') : (game.awayTeamAbbrev ?? '');
                const gamesVs = getGamesVsOpponent((p.game_log ?? []) as GameLogEntry[], opp);
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
                      <Image source={{ uri: p.athlete_headshot_href }} style={[styles.avatar, { backgroundColor: colors.border }]} />
                      <View style={styles.playerMeta}>
                        <ThemedText style={styles.playerName}>
                          {p.athlete_display_name}
                          <ThemedText style={[styles.playerTeamAbbrev, { color: colors.secondaryText }]}>
                            {' '}({p.team_abbreviation})
                          </ThemedText>
                        </ThemedText>
                        <ThemedText style={[styles.playerStat, { color: colors.secondaryText }]}>
                          {(() => {
                            const primary = `${p[keyMatchupStat]} ${getStatLabel(keyMatchupStat)}`;
                            const others = (['ppg', 'rpg', 'apg'] as const).filter((s) => s !== keyMatchupStat);
                            const rest = others.map((s) => `${p[s]} ${getStatLabel(s)}`).join(' • ');
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
                    <View style={styles.similarSection}>
                      <TouchableOpacity
                        style={[styles.seeSimilarBtn, { borderColor: colors.tint }]}
                        onPress={() => openSimilarModal(p)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <ThemedText style={[styles.seeSimilarText, { color: colors.tint }]}>
                          See similar players
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
            {(inactiveAwayPlayers.length > 0 || inactiveHomePlayers.length > 0) && (
              <View style={[styles.inactiveSection, { borderTopColor: colors.border }]}>
                <ThemedText style={[styles.inactiveSectionTitle, { color: colors.secondaryText }]}>
                  Inactive (last 5 games)
                </ThemedText>
                {inactiveAwayPlayers.map((p) => {
                  const lastDate = getLastGameDate(p);
                  const note = lastDate
                    ? `Last game ${formatLastGameDate(lastDate)}`
                    : 'Has not played in last 5 games';
                  return (
                    <Pressable
                      key={p.athlete_id}
                      style={styles.inactivePlayerRow}
                      onPress={() => router.push(`/player/${p.athlete_id}`)}>
                      <Image
                        source={{ uri: p.athlete_headshot_href }}
                        style={[styles.inactiveAvatar, { backgroundColor: colors.border }]}
                      />
                      <View style={styles.inactivePlayerMeta}>
                        <ThemedText style={[styles.inactivePlayerName, { color: colors.secondaryText }]}>
                          {game.awayTeamAbbrev}: {p.athlete_display_name}
                        </ThemedText>
                        <ThemedText style={[styles.inactivePlayerNote, { color: colors.secondaryText, opacity: 0.8 }]}>
                          {note}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
                {inactiveHomePlayers.map((p) => {
                  const lastDate = getLastGameDate(p);
                  const note = lastDate
                    ? `Last game ${formatLastGameDate(lastDate)}`
                    : 'Has not played in last 5 games';
                  return (
                    <Pressable
                      key={p.athlete_id}
                      style={styles.inactivePlayerRow}
                      onPress={() => router.push(`/player/${p.athlete_id}`)}>
                      <Image
                        source={{ uri: p.athlete_headshot_href }}
                        style={[styles.inactiveAvatar, { backgroundColor: colors.border }]}
                      />
                      <View style={styles.inactivePlayerMeta}>
                        <ThemedText style={[styles.inactivePlayerName, { color: colors.secondaryText }]}>
                          {game.homeTeamAbbrev}: {p.athlete_display_name}
                        </ThemedText>
                        <ThemedText style={[styles.inactivePlayerNote, { color: colors.secondaryText, opacity: 0.8 }]}>
                          {note}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Post-game: Top performers */}
          {game.completed && boxScores.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
              <ThemedText style={styles.sectionTitle}>Top Performers</ThemedText>
              {(() => {
                const byTeam = boxScores.reduce(
                  (acc, b) => {
                    const t = (b.team_abbreviation ?? '').toUpperCase();
                    if (!acc[t]) acc[t] = [];
                    acc[t].push(b);
                    return acc;
                  },
                  {} as Record<string, GameBoxScore[]>
                );
                const homeAbbrev = (game.homeTeamAbbrev ?? '').toUpperCase();
                const awayAbbrev = (game.awayTeamAbbrev ?? '').toUpperCase();
                const homeTop = (byTeam[homeAbbrev] ?? []).slice(0, 3);
                const awayTop = (byTeam[awayAbbrev] ?? []).slice(0, 3);
                return (
                  <View style={styles.boxScoreList}>
                    {awayTop.map((b) => (
                      <View key={b.athlete_id} style={styles.boxScoreRow}>
                        <Image source={{ uri: b.athlete_headshot_href }} style={[styles.smallAvatar, { backgroundColor: colors.border }]} />
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
                        <Image source={{ uri: b.athlete_headshot_href }} style={[styles.smallAvatar, { backgroundColor: colors.border }]} />
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
        </ScrollView>
      </ThemedView>

      {similarModalPlayer && (
        <SimilarPlayersModal
          visible={!!similarModalPlayer}
          onClose={() => setSimilarModalPlayer(null)}
          sourcePlayerName={similarModalPlayer.player.athlete_display_name}
          similarPlayers={similarModalPlayer.similarPlayers}
          isLoading={similarModalPlayer.isLoading}
          opponentAbbrev={
            (similarModalPlayer.player.team_abbreviation ?? '').toUpperCase() ===
            (game?.homeTeamAbbrev ?? '').toUpperCase()
              ? (game?.awayTeamAbbrev ?? '')
              : (game?.homeTeamAbbrev ?? '')
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
  },
  backBtn: {
    marginTop: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    marginBottom: 16,
  },
  liveSimButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  liveSimButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  matchupTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  venue: {
    fontSize: 14,
    marginTop: 4,
  },
  dateTime: {
    fontSize: 14,
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
    height: 60,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: '700',
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
    fontSize: 14
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
    // color: '#fff',
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
  section: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
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
  teamComparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownTeamHeaderColumn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
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
  inactiveSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  inactiveSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  inactivePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  inactiveAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    opacity: 0.7,
  },
  inactivePlayerMeta: {
    flex: 1,
  },
  inactivePlayerName: {
    fontSize: 14,
  },
  inactivePlayerNote: {
    fontSize: 12,
    marginTop: 2,
  },
  matchupRow: {
    marginBottom: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  calloutText: {
    fontSize: 13,
    marginBottom: 6,
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
