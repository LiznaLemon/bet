import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { InsightCarousel } from '@/components/insight-carousel';
import { MiniBarChart } from '@/components/mini-bar-chart';
import { ShotChart } from '@/components/shot-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getStatCardWidthPercent,
  getStatSections,
  resolveStatTotal,
  resolveStatValue,
  STAT_LABELS,
  STAT_TOTAL_KEYS,
  type TimePeriod,
} from '@/constants/player-stats-config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DimensionValue } from 'react-native';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { getUpcomingGamesFallback } from '@/constants/schedule';
import { Colors } from '@/constants/theme';
import { usePlayers } from '@/lib/queries/players';
import { useSchedule } from '@/lib/queries/schedule';
import { useShots } from '@/lib/queries/shots';
import type { ScheduleGame, ShotAttempt } from '@/lib/types';

type EnhancedPlayer = {
  athlete_id: string;
  athlete_display_name: string;
  team_color?: string;
  game_log?: unknown[];
  games_played?: number;
  total_free_throws_made?: number;
  total_free_throws_attempted?: number;
  quarter_averages?: unknown;
  shots?: ShotAttempt[];
  [key: string]: unknown;
};

type GameLogEntry = {
  points?: number;
  rebounds?: number;
  assists?: number;
  minutes?: number;
  field_goals_made?: number;
  three_point_made?: number;
  free_throws_made?: number;
  opponent_team_abbreviation?: string;
  game_date?: string;
};

type ChartStatKey = 'points' | 'rebounds' | 'assists' | 'minutes' | 'two_pt_made' | 'three_pt_made' | 'free_throws_made';

function getStatFromGame(g: GameLogEntry, stat: ChartStatKey): number {
  if (stat === 'two_pt_made') {
    const fgm = g.field_goals_made ?? 0;
    const tpm = g.three_point_made ?? 0;
    return Math.max(0, fgm - tpm);
  }
  if (stat === 'three_pt_made') return (g.three_point_made ?? 0) as number;
  if (stat === 'free_throws_made') return (g.free_throws_made ?? 0) as number;
  return (g[stat] ?? 0) as number;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

function daysBetween(dateStrA: string, dateStrB: string): number {
  if (!dateStrA || !dateStrB) return 0;
  const a = new Date(dateStrA + 'T12:00:00').getTime();
  const b = new Date(dateStrB + 'T12:00:00').getTime();
  return Math.round(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

function getLocalDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns today's opponent if the team has a game today; null otherwise. No fallback to future games. */
function getTonightOpponent(teamAbbrev: string, scheduleGames: ScheduleGame[]): string | null {
  const todayStr = getLocalDateStr();
  const teamUpper = (teamAbbrev ?? '').toUpperCase().trim();
  const games = getUpcomingGamesFallback(scheduleGames);
  const isTeamInGame = (g: ScheduleGame) =>
    (g.homeTeamAbbrev ?? '').toUpperCase().trim() === teamUpper ||
    (g.awayTeamAbbrev ?? '').toUpperCase().trim() === teamUpper;
  const todaysGame = games.find((g) => g.gameDate === todayStr && isTeamInGame(g));
  if (!todaysGame) return null;
  return (todaysGame.homeTeamAbbrev ?? '').toUpperCase().trim() === teamUpper
    ? (todaysGame.awayTeamAbbrev ?? '')
    : (todaysGame.homeTeamAbbrev ?? '');
}

function getPlayerStatPerGame(p: { games_played?: number; [key: string]: unknown }, stat: ChartStatKey): number {
  const gp = Math.max(1, Number(p.games_played ?? 1));
  if (stat === 'points') return Number(p.total_points ?? 0) / gp;
  if (stat === 'rebounds') return Number(p.total_rebounds ?? 0) / gp;
  if (stat === 'assists') return Number(p.total_assists ?? 0) / gp;
  if (stat === 'minutes') return Number(p.total_minutes ?? 0) / gp;
  if (stat === 'two_pt_made') {
    const fgm = Number(p.total_field_goals_made ?? 0);
    const tpm = Number(p.total_three_point_made ?? 0);
    return Math.max(0, fgm - tpm) / gp;
  }
  if (stat === 'three_pt_made') return Number(p.total_three_point_made ?? 0) / gp;
  if (stat === 'free_throws_made') return Number(p.total_free_throws_made ?? 0) / gp;
  return 0;
}

function computeTrendInsights(
  gameLog: GameLogEntry[],
  chartStat: ChartStatKey,
  teamAbbrev?: string,
  scheduleGames: ScheduleGame[] = [],
  player?: { athlete_id?: string; games_played?: number; [key: string]: unknown },
  allPlayers: { athlete_id?: string; games_played?: number; [key: string]: unknown }[] = []
): string[] {
  const insights: string[] = [];
  if (gameLog.length === 0) return insights;

  if (gameLog.length >= 1) {
    const lastGame = gameLog[0];
    const lastDate = String(lastGame.game_date ?? '');
    const lastOpponent = (lastGame.opponent_team_abbreviation ?? '').trim() || null;
    const againstStr = lastOpponent ? ` against ${lastOpponent}` : '';
    const todayStr = new Date().toISOString().slice(0, 10);
    const daysSince = daysBetween(todayStr, lastDate);
    const daysOfRest = Math.max(0, daysSince - 1); // Off-days between last game and today
    const lastGameFmt = formatShortDate(lastDate);
    const REST_CUTOFF = 4; // Beyond this, likely injured/inactive rather than resting
    if (daysSince <= REST_CUTOFF) {
      if (daysSince === 1 && daysOfRest === 0) {
        // Back-to-back only when we've confirmed they have a game today
        const opponent = teamAbbrev ? getTonightOpponent(teamAbbrev, scheduleGames) : null;
        if (opponent) {
          insights.push(`Playing a back-to-back game tonight against ${opponent}.`);
        } else {
          insights.push(`1 day of rest since last game on ${lastGameFmt}${againstStr}.`);
        }
      } else if (daysOfRest === 0) {
        // Played today
        insights.push(`0 days of rest since last game on ${lastGameFmt}${againstStr}.`);
      } else if (daysOfRest === 1) {
        insights.push(`1 day of rest since last game on ${lastGameFmt}${againstStr}.`);
      } else {
        insights.push(`${daysOfRest} days of rest since last game on ${lastGameFmt}${againstStr}.`);
      }
    } else {
      insights.push(`${daysSince} days since their last game on ${lastGameFmt}${againstStr}.`);
    }
  }

  const getVal = (g: GameLogEntry) => getStatFromGame(g, chartStat);
  const statLabel =
    chartStat === 'points'
      ? 'points'
      : chartStat === 'rebounds'
        ? 'rebounds'
        : chartStat === 'assists'
          ? 'assists'
          : chartStat === 'minutes'
            ? 'minutes'
            : chartStat === 'two_pt_made'
              ? '2PT'
              : chartStat === 'three_pt_made'
                ? '3PT'
                : 'FT';

  const opp = (g: GameLogEntry) => g.opponent_team_abbreviation ?? '—';
  const fmt = (g: GameLogEntry) => formatShortDate(String(g.game_date ?? ''));

  const minGame = gameLog.reduce((a, b) => (getVal(a) <= getVal(b) ? a : b));
  const maxGame = gameLog.reduce((a, b) => (getVal(a) >= getVal(b) ? a : b));
  const minVal = getVal(minGame);
  const maxVal = getVal(maxGame);

  if (maxVal > 0) {
    if (minVal < maxVal) {
      insights.push(
        `Season range: ${minVal}–${maxVal} ${statLabel} (low vs ${opp(minGame)} on ${fmt(minGame)}; high vs ${opp(maxGame)} on ${fmt(maxGame)}).`
      );
    } else {
      insights.push(
        `Season: ${maxVal} ${statLabel} every game.`
      );
    }
  }

  if (chartStat === 'assists' && gameLog.length >= 2) {
    const sorted = [...gameLog].sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0));
    const top = sorted.slice(0, 2).filter((g) => (g.assists ?? 0) >= 10);
    if (top.length >= 1 && !insights.some((i) => i.includes(`${top[0].assists} assists`))) {
      insights.push(
        `${top[0].assists} assists vs ${opp(top[0])} (${fmt(top[0])})${top.length >= 2 ? ` and ${top[1].assists} vs ${opp(top[1])}.` : '.'}`
      );
    }
  }

  if (chartStat === 'rebounds' && gameLog.length >= 1) {
    const maxReb = gameLog.reduce((a, b) =>
      (b.rebounds ?? 0) >= (a.rebounds ?? 0) ? b : a
    );
    const rebVal = maxReb.rebounds ?? 0;
    if (rebVal >= 10 && !insights.some((i) => i.includes(`${rebVal} boards`))) {
      insights.push(
        `${rebVal} boards vs ${opp(maxReb)} on ${fmt(maxReb)} is season high.`
      );
    }
  }

  const LAST_N = 10;
  const shortLabels: Record<ChartStatKey, string> = {
    points: 'pts',
    rebounds: 'reb',
    assists: 'ast',
    minutes: 'min',
    two_pt_made: '2PT',
    three_pt_made: '3PT',
    free_throws_made: 'FT',
  };
  const eliteLabels: Record<ChartStatKey, string> = {
    points: 'pts scored',
    rebounds: 'rebounds',
    assists: 'assists',
    minutes: 'minutes',
    two_pt_made: '2PT made',
    three_pt_made: '3PT made',
    free_throws_made: 'FT made',
  };
  const shortLabel = shortLabels[chartStat];
  const eliteLabel = eliteLabels[chartStat];

  if (gameLog.length >= LAST_N) {
    const lastN = gameLog.slice(0, LAST_N);
    const priorN = gameLog.slice(LAST_N, LAST_N * 2);

    // 1. Elite: X of last 10 at/above league 90th percentile
    const qualified = allPlayers.filter((p) => Number(p.games_played ?? 0) >= 10);
    if (qualified.length >= 10 && player) {
      const leagueValues = qualified
        .map((p) => getPlayerStatPerGame(p, chartStat))
        .filter((v) => !Number.isNaN(v) && v >= 0)
        .sort((a, b) => b - a);
      if (leagueValues.length >= 10) {
        const p90Index = Math.floor(leagueValues.length * 0.1);
        const p90Threshold = leagueValues[p90Index];
        const atOrAbove = lastN.filter((g) => getVal(g) >= p90Threshold).length;
        if (atOrAbove >= 5) {
          const thresholdStr = Number.isInteger(p90Threshold) ? `${p90Threshold}+` : `${p90Threshold.toFixed(1)}+`;
          insights.push(
            `💎 ${atOrAbove} of last ${LAST_N} games within top 10% for ${eliteLabel} (${thresholdStr}).`
          );
        }
      }
    }

    // 2. Hot/Cold: X of last 10 above their season average (use full-season avg from player, not gameLog)
    const seasonAvg = player ? getPlayerStatPerGame(player, chartStat) : 0;
    const aboveAvg = lastN.filter((g) => getVal(g) >= seasonAvg).length;
    if (aboveAvg >= 7) {
      insights.push(
        `🔥 ${aboveAvg} of last ${LAST_N} games above their season avg (${seasonAvg.toFixed(1)} ${shortLabel}).`
      );
    } else if (aboveAvg <= 3 && seasonAvg > 0) {
      insights.push(
        `❄️ ${aboveAvg} of last ${LAST_N} games above their season avg (${seasonAvg.toFixed(1)} ${shortLabel}).`
      );
    }

    // 3. Trend: X of last 10 above their prior 10-game average (always show when we have data)
    if (priorN.length >= LAST_N) {
      const priorAvg =
        priorN.reduce((s, g) => s + getVal(g), 0) / priorN.length;
      const abovePrior = lastN.filter((g) => getVal(g) >= priorAvg).length;
      if (priorAvg > 0) {
        const trendEmoji = abovePrior >= 7 ? '📈' : abovePrior <= 3 ? '📉' : '➡️';
        insights.push(
          `${trendEmoji} ${abovePrior} of last ${LAST_N} games above prior 10-game avg (${priorAvg.toFixed(1)} ${shortLabel}).`
        );
      }
    }
  }

  return insights.filter(Boolean).slice(0, 7);
}

function computeAverageInsights(
  player: EnhancedPlayer,
  allPlayers: EnhancedPlayer[]
): string[] {
  const insights: string[] = [];
  const qualified = allPlayers.filter((p) => Number(p.games_played ?? 0) >= 10);
  if (qualified.length === 0) return insights;

  const getPpg = (p: EnhancedPlayer) =>
    Number(p.total_points ?? 0) / Math.max(1, Number(p.games_played ?? 1));
  const getRpg = (p: EnhancedPlayer) =>
    Number(p.total_rebounds ?? 0) / Math.max(1, Number(p.games_played ?? 1));
  const getApg = (p: EnhancedPlayer) =>
    Number(p.total_assists ?? 0) / Math.max(1, Number(p.games_played ?? 1));
  const getTpg = (p: EnhancedPlayer) =>
    Number(p.total_turnovers ?? 0) / Math.max(1, Number(p.games_played ?? 1));
  const getFpg = (p: EnhancedPlayer) =>
    Number(p.total_fouls ?? 0) / Math.max(1, Number(p.games_played ?? 1));

  const totalPlayers = qualified.length;

  const ppgRank =
    [...qualified].sort((a, b) => getPpg(b) - getPpg(a)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const rpgRank =
    [...qualified].sort((a, b) => getRpg(b) - getRpg(a)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const apgRank =
    [...qualified].sort((a, b) => getApg(b) - getApg(a)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const tpgRank =
    [...qualified].sort((a, b) => getTpg(b) - getTpg(a)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const fpgRank =
    [...qualified].sort((a, b) => getFpg(b) - getFpg(a)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;

  const totalPtsRank =
    [...qualified].sort((a, b) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const totalRebRank =
    [...qualified].sort((a, b) => Number(b.total_rebounds ?? 0) - Number(a.total_rebounds ?? 0)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const totalAstRank =
    [...qualified].sort((a, b) => Number(b.total_assists ?? 0) - Number(a.total_assists ?? 0)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const totalTovRank =
    [...qualified].sort((a, b) => Number(b.total_turnovers ?? 0) - Number(a.total_turnovers ?? 0)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;
  const totalFoulRank =
    [...qualified].sort((a, b) => Number(b.total_fouls ?? 0) - Number(a.total_fouls ?? 0)).findIndex((p) => p.athlete_id === player.athlete_id) + 1;

  const ord = (n: number) => {
    const s = String(n);
    if (s.endsWith('1') && s !== '11') return `${n}st`;
    if (s.endsWith('2') && s !== '12') return `${n}nd`;
    if (s.endsWith('3') && s !== '13') return `${n}rd`;
    return `${n}th`;
  };

  const g = Math.max(1, Number(player.games_played ?? 1));
  const ppg = Number(player.total_points ?? 0) / g;
  const apg = Number(player.total_assists ?? 0) / g;
  const rpg = Number(player.total_rebounds ?? 0) / g;
  const tpg = Number(player.total_turnovers ?? 0) / g;
  const fpgVal = Number(player.total_fouls ?? 0) / g;
  const totalPts = Math.round(Number(player.total_points ?? 0));
  const totalReb = Math.round(Number(player.total_rebounds ?? 0));
  const totalAst = Math.round(Number(player.total_assists ?? 0));
  const totalTov = Math.round(Number(player.total_turnovers ?? 0));
  const totalFoul = Math.round(Number(player.total_fouls ?? 0));

  const fmtDual = (
    totalRank: number,
    totalVal: number,
    avgRank: number,
    avgVal: string,
    avgLabel: string,
    totalLabel: string
  ) => {
    const totalNoteworthy = totalRank <= 10;
    const avgNoteworthy = avgRank <= 10;
    if (!totalNoteworthy && !avgNoteworthy) return null;
    const parts: string[] = [];
    parts.push(`${ord(totalRank)} in ${totalLabel} (${totalVal})`);
    parts.push(`${ord(avgRank)} in ${avgLabel} (${avgVal})`);
    return parts.join(', ');
  };

  const ptsInsight = fmtDual(totalPtsRank, totalPts, ppgRank, `${ppg.toFixed(1)} PPG`, 'average points', 'total points');
  if (ptsInsight) insights.push(`${ptsInsight} among qualified players.`);
  const astInsight = fmtDual(totalAstRank, totalAst, apgRank, `${apg.toFixed(1)} APG`, 'average assists', 'total assists');
  if (astInsight) insights.push(`${astInsight} among qualified players.`);
  const rebInsight = fmtDual(totalRebRank, totalReb, rpgRank, `${rpg.toFixed(1)} RPG`, 'average rebounds', 'total rebounds');
  if (rebInsight) insights.push(`${rebInsight} among qualified players.`);

  const fmtDualBad = (
    totalRank: number,
    totalVal: number,
    avgRank: number,
    avgVal: string,
    totalLabel: string,
    avgLabel: string
  ) => {
    const totalNoteworthy = totalRank <= 10 || totalRank >= totalPlayers - 9;
    const avgNoteworthy = avgRank <= 10 || avgRank >= totalPlayers - 9;
    if (!totalNoteworthy && !avgNoteworthy) return null;
    const totalOrd = totalRank <= 10 ? ord(totalRank) : totalRank >= totalPlayers - 9 ? ord(totalPlayers - totalRank + 1) : ord(totalRank);
    const fmtTotal = totalRank <= 10
      ? totalRank === 1 ? `1st in total ${totalLabel} (${totalVal})` : `${totalOrd} most total ${totalLabel} (${totalVal})`
      : totalRank >= totalPlayers - 9
        ? totalRank === totalPlayers ? `1st in fewest total ${totalLabel} (${totalVal})` : `${totalOrd} fewest total ${totalLabel} (${totalVal})`
        : `${ord(totalRank)} in total ${totalLabel} (${totalVal})`;
    const avgOrd = avgRank <= 10 ? ord(avgRank) : avgRank >= totalPlayers - 9 ? ord(totalPlayers - avgRank + 1) : ord(avgRank);
    const fmtAvg = avgRank <= 10
      ? avgRank === 1 ? `1st in ${avgLabel} (${avgVal})` : `${avgOrd} most ${avgLabel} (${avgVal})`
      : avgRank >= totalPlayers - 9
        ? avgRank === totalPlayers ? `1st in fewest ${avgLabel} (${avgVal})` : `${avgOrd} fewest ${avgLabel} (${avgVal})`
        : `${ord(avgRank)} in ${avgLabel} (${avgVal})`;
    return `${fmtTotal}, ${fmtAvg}`;
  };

  const tovInsight = fmtDualBad(totalTovRank, totalTov, tpgRank, `${tpg.toFixed(1)} TPG`, 'turnovers', 'turnovers per game');
  if (tovInsight) insights.push(tovInsight + '.');
  const foulInsight = fmtDualBad(totalFoulRank, totalFoul, fpgRank, `${fpgVal.toFixed(1)} FPG`, 'fouls', 'fouls per game');
  if (foulInsight) insights.push(foulInsight + '.');

  if ((player.game_log ?? []).length >= 10) {
    const gameLog = (player.game_log ?? []) as GameLogEntry[];
    const seasonPpg = Number(player.total_points ?? 0) / Math.max(1, Number(player.games_played ?? 1));
    const last10 = gameLog.slice(0, 10);
    const last10Ppg = last10.reduce((s, g) => s + (g.points ?? 0), 0) / 10;
    const last5 = gameLog.slice(0, 5);
    const last5Ppg = last5.reduce((s, g) => s + (g.points ?? 0), 0) / 5;
    const diff10 = last10Ppg - seasonPpg;
    const diff5 = last5Ppg - last10Ppg;
    if (Math.abs(diff10) >= 1 || Math.abs(diff5) >= 0.5) {
      const dir10 = diff10 >= 0 ? 'above' : 'below';
      const dir5 = diff5 >= 0 ? 'up' : 'down';
      insights.push(
        `Last 10: ${last10Ppg.toFixed(1)} PPG (${dir10} season). Last 5 trending ${dir5}.`
      );
    }
  }

  return insights.filter(Boolean).slice(0, 4);
}

function ord(n: number): string {
  const s = String(n);
  if (s.endsWith('1') && s !== '11') return `${n}st`;
  if (s.endsWith('2') && s !== '12') return `${n}nd`;
  if (s.endsWith('3') && s !== '13') return `${n}rd`;
  return `${n}th`;
}

function formatShootingInsight(
  label: string,
  player: {
    fg_pct?: unknown;
    three_pt_pct?: unknown;
    ft_pct?: unknown;
    total_field_goals_attempted?: number;
    total_three_point_attempted?: number;
    total_free_throws_attempted?: number;
    pts_ft?: number;
    pts_fg?: number;
    pts_3pt?: number;
    pct_pts_ft?: number;
    pct_pts_fg?: number;
    pct_pts_3pt?: number;
    fga_rank?: number;
    tpa_rank?: number;
    fta_rank?: number;
    pts_ft_rank?: number;
    pts_fg_rank?: number;
    pts_3pt_rank?: number;
    pct_pts_ft_rank?: number;
    pct_pts_fg_rank?: number;
    pct_pts_3pt_rank?: number;
    fg_acc_rank?: number;
    three_acc_rank?: number;
    ft_acc_rank?: number;
    min_fga_90?: number;
    min_3pa_90?: number;
    min_fta_90?: number;
  }
): string | null {
  const parsePct = (v: unknown): number => {
    if (v == null) return NaN;
    const s = String(v).replace(/%/g, '');
    const n = parseFloat(s);
    return Number.isNaN(n) ? NaN : n;
  };

  const fmt = (
    l: string,
    accRank: number | undefined,
    pct: number,
    attRank: number | undefined,
    att: number,
    minAtt: number | undefined,
    ptsRank: number | undefined,
    ptsVal: number,
    pctPtsRank: number | undefined,
    pctPtsVal: number
  ) => {
    const pctStr = Number.isNaN(pct) ? '—' : `${pct.toFixed(1)}%`;
    const accStr =
      accRank != null && accRank >= 1
        ? `${ord(accRank)} in accuracy (${pctStr})`
        : pctStr;
    const attStr = attRank != null ? `${ord(attRank)} in attempts (${att})` : `— in attempts (${att})`;
    const ptsStr = ptsRank != null ? `${ord(ptsRank)} in pts (${ptsVal})` : `— in pts (${ptsVal})`;
    const pctPtsStr =
      pctPtsRank != null ? `${ord(pctPtsRank)} in % of total (${pctPtsVal.toFixed(0)}%)` : `— in % of total (${pctPtsVal.toFixed(0)}%)`;
    return `${l}: ${accStr}, ${attStr}. ${ptsStr}, ${pctPtsStr}.`;
  };

  if (label === 'FT') {
    const pct = parsePct(player.ft_pct);
    const att = Number(player.total_free_throws_attempted ?? 0);
    const ptsVal = Number(player.pts_ft ?? 0);
    const pctVal = Number(player.pct_pts_ft ?? 0);
    return fmt(
      'Free Throws',
      player.ft_acc_rank,
      pct,
      player.fta_rank,
      att,
      player.min_fta_90,
      player.pts_ft_rank,
      ptsVal,
      player.pct_pts_ft_rank,
      pctVal
    );
  }
  if (label === 'FG') {
    const pct = parsePct(player.fg_pct);
    const att = Number(player.total_field_goals_attempted ?? 0);
    const ptsVal = Number(player.pts_fg ?? 0);
    const pctVal = Number(player.pct_pts_fg ?? 0);
    return fmt(
      'Field Goals',
      player.fg_acc_rank,
      pct,
      player.fga_rank,
      att,
      player.min_fga_90,
      player.pts_fg_rank,
      ptsVal,
      player.pct_pts_fg_rank,
      pctVal
    );
  }
  if (label === '3PT') {
    const pct = parsePct(player.three_pt_pct);
    const att = Number(player.total_three_point_attempted ?? 0);
    const ptsVal = Number(player.pts_3pt ?? 0);
    const pctVal = Number(player.pct_pts_3pt ?? 0);
    return fmt(
      'Threes',
      player.three_acc_rank,
      pct,
      player.tpa_rank,
      att,
      player.min_3pa_90,
      player.pts_3pt_rank,
      ptsVal,
      player.pct_pts_3pt_rank,
      pctVal
    );
  }
  return null;
}

function getShootingInsights(player: EnhancedPlayer): string[] {
  if (player.pts_ft == null && player.pts_fg == null && player.pts_3pt == null) return [];
  const insights: string[] = [];
  const ft = formatShootingInsight('FT', player);
  const fg = formatShootingInsight('FG', player);
  const three = formatShootingInsight('3PT', player);
  if (ft) insights.push(ft);
  if (fg) insights.push(fg);
  if (three) insights.push(three);
  return insights;
}

function resolveItemsPerRow(
  row: { itemsPerRow?: 1 | 2 | 3; rowLayout?: string }
): 1 | 2 | 3 {
  if (row.itemsPerRow != null) return row.itemsPerRow;
  if (row.rowLayout === 'highlight') return 1;
  return 2;
}

const STAT_ENTRANCE_OFFSET = 8;
const STAT_ENTRANCE_DURATION = 300;
const STAT_CARD_STAGGER = 50;
const STAT_ELEMENT_STAGGER = 35;
const STAT_ELEMENT_OFFSET = 4;

function AnimatedStatElement({
  children,
  timePeriod,
  index,
}: {
  children: React.ReactNode;
  timePeriod: TimePeriod;
  index: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      index * STAT_ELEMENT_STAGGER,
      withTiming(1, {
        duration: STAT_ENTRANCE_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [timePeriod, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * STAT_ELEMENT_OFFSET }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

/** Parses stat value for animation. Returns { num, suffix, decimals } or null if not animatable. */
function parseAnimatableValue(value: string): { num: number; suffix: string; decimals: number } | null {
  if (!value || value.includes('/')) return null; // Skip ratios like "8.5/18.2"
  const pctMatch = value.match(/^([\d.]+)%$/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    if (Number.isNaN(num)) return null;
    return { num, suffix: '%', decimals: 1 };
  }
  const num = parseFloat(value);
  if (Number.isNaN(num)) return null;
  const decimals = value.includes('.') ? 1 : 0;
  return { num, suffix: '', decimals };
}

const STAT_VALUE_ANIM_DURATION = 350;

function AnimatedStatValue({
  value,
  timePeriod,
  style,
}: {
  value: string;
  timePeriod: TimePeriod;
  style?: object;
}) {
  const parsed = parseAnimatableValue(value);
  const [displayValue, setDisplayValue] = useState(value);

  const prevNum = useSharedValue(parsed?.num ?? 0);
  const currNum = useSharedValue(parsed?.num ?? 0);
  const progress = useSharedValue(1);

  useEffect(() => {
    const next = parseAnimatableValue(value);
    if (!next) {
      setDisplayValue(value);
      return;
    }
    prevNum.value = currNum.value;
    currNum.value = next.num;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: STAT_VALUE_ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, timePeriod]);

  const updateDisplay = useCallback((interp: number) => {
    const next = parseAnimatableValue(value);
    if (!next) return;
    const formatted =
      next.decimals === 0 ? Math.round(interp).toString() : interp.toFixed(next.decimals);
    const text = formatted + next.suffix;
    setDisplayValue((prev) => (prev === text ? prev : text));
  }, [value]);

  useAnimatedReaction(
    () => progress.value,
    (p) => {
      const interp = prevNum.value + (currNum.value - prevNum.value) * p;
      runOnJS(updateDisplay)(interp);
    },
    [updateDisplay],
  );

  if (!parsed) {
    return <ThemedText style={style}>{value}</ThemedText>;
  }

  return <ThemedText style={style}>{displayValue}</ThemedText>;
}

function AnimatedStatCard({
  children,
  timePeriod,
  index,
  style,
}: {
  children: React.ReactNode;
  timePeriod: TimePeriod;
  index: number;
  style?: object;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      index * STAT_CARD_STAGGER,
      withTiming(1, {
        duration: STAT_ENTRANCE_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [timePeriod, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * STAT_ENTRANCE_OFFSET }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function StatsOverlay({ opacity }: { opacity: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      style={[styles.statsOverlay, animatedStyle]}
      pointerEvents="none"
    />
  );
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const { data: playersData = [], isLoading: playersLoading } = usePlayers();
  const { data: scheduleData = [] } = useSchedule();
  const { data: fetchedShots = [], isLoading: shotsLoading } = useShots(id, 2026);

  const [timePeriod, setTimePeriod] = useState<TimePeriod>('season');
  const statsOverlayOpacity = useSharedValue(0);
  const isInitialMount = useRef(true);
  const [chartStat, setChartStat] = useState<ChartStatKey>('points');
  const statSections = useMemo(() => getStatSections(), []);
  const { width: screenWidth } = useWindowDimensions();

  const player = (playersData as EnhancedPlayer[]).find((p) => p.athlete_id === id);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    statsOverlayOpacity.value = withSequence(
      withTiming(0.35, { duration: 80, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 180, easing: Easing.inOut(Easing.ease) }),
    );
  }, [timePeriod]);

  const gameLog = player ? ((player.game_log ?? []) as GameLogEntry[]) : [];

  const seasonPerGame = useMemo(() => {
    if (!player) return { data: [], labels: [] };
    const log = (player.game_log ?? []) as GameLogEntry[];
    const reversed = [...log].reverse();
    const data = reversed.map((g) => getStatFromGame(g, chartStat));
    const labels = reversed.map((g) => (g.opponent_team_abbreviation ?? '—').toUpperCase());
    return { data, labels };
  }, [player?.game_log, chartStat]);

  const allPlayers = useMemo(
    () => (playersData as EnhancedPlayer[]),
    [playersData]
  );

  const trendInsights = useMemo(
    () => {
      if (!player) return [];
      return computeTrendInsights(
        gameLog,
        chartStat,
        typeof player.team_abbreviation === 'string' ? player.team_abbreviation : undefined,
        scheduleData,
        player,
        allPlayers
      );
    },
    [gameLog, chartStat, player, player?.team_abbreviation, scheduleData, allPlayers]
  );

  const averageInsights = useMemo(
    () => player ? computeAverageInsights(player, allPlayers) : [],
    [player, allPlayers]
  );

  const shootingInsights = useMemo(
    () => player ? getShootingInsights(player) : [],
    [player]
  );

  if (playersLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading player...</ThemedText>
      </ThemedView>
    );
  }

  if (!player) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Player not found</ThemedText>
      </ThemedView>
    );
  }

  const isEnhanced = 'quarter_averages' in player && player.quarter_averages;
  const teamColor = player.team_color ? `#${player.team_color}` : '#552583';

  const embeddedShots = ('shots' in player && Array.isArray((player as { shots?: ShotAttempt[] }).shots))
    ? ((player as { shots: ShotAttempt[] }).shots ?? [])
    : [];
  const shots: ShotAttempt[] = embeddedShots.length > 0 ? embeddedShots : fetchedShots;

  const gamesInPeriod =
    timePeriod === 'last_5'
      ? (player as { last_5?: { games?: number } }).last_5?.games ?? 5
      : timePeriod === 'last_10'
        ? (player as { last_10?: { games?: number } }).last_10?.games ?? 10
        : player.games_played;

  const seasonBarWidth = Math.max(28, Math.floor((screenWidth - 48) / 10) - 3);

  const chartStatLabels: Record<typeof chartStat, string> = {
    points: 'Points',
    rebounds: 'Rebounds',
    assists: 'Assists',
    minutes: 'Minutes',
    two_pt_made: 'Two Pointers Made',
    three_pt_made: 'Threes Made',
    free_throws_made: 'Free Throws Made',
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: player.athlete_display_name,
          headerShown: true,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Player Header */}
        {/* <View style={[styles.header, { backgroundColor: teamColor }]}>
          <Image
            source={{ uri: player.athlete_headshot_href }}
            style={styles.playerImage}
            contentFit="cover"
          />
          <View style={styles.headerInfo}>
            <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            <ThemedText style={styles.playerPosition}>
              {player.athlete_position_name ?? player.athlete_position_abbreviation}
            </ThemedText>
            <View style={styles.teamContainer}>
              <Image
                source={{ uri: player.team_logo }}
                style={styles.teamLogo}
                contentFit="contain"
              />
              <ThemedText style={styles.teamName}>
                {player.team_display_name ?? player.team_abbreviation}
              </ThemedText>
            </View>
          </View>
        </View> */}

        {/* STATS (with time filter + bar chart) */}
        <View style={styles.section}>
          <View style={styles.filterRow}>
            <FilterOptionButtons
              options={[
                { key: 'season', label: 'Season' },
                { key: 'last_10', label: 'Last 10 Games' },
                { key: 'last_5', label: 'Last 5 Games' },
              ]}
              value={timePeriod}
              onSelect={(key) => setTimePeriod(key as TimePeriod)}
              colorScheme={colorScheme ?? 'light'}
            />
          </View>

          <View style={styles.statsContentWrapper}>
          {/* Bar chart - always full season; time filter highlights last N games */}
          {(() => {
            const chartData = seasonPerGame.data;
            const xLabels = seasonPerGame.labels;
            const hasData = chartData.length > 0;
            if (!hasData) return null;

            const chartTitle =
              timePeriod === 'season'
              ? `${chartStatLabels[chartStat]} by Game`
              : `${timePeriod === 'last_10' ? 'Last 10' : 'Last 5'} Games (${chartStatLabels[chartStat]})`;
            const highlightLastN =
              timePeriod === 'season'
                ? undefined
                : timePeriod === 'last_10'
                  ? 10
                  : 5;

            return (
              <View style={[styles.chartCard, { marginBottom: 20 }]}>
                <View style={styles.chartStatTabs}>
                  <FilterOptionButtons
                    options={[
                      { key: 'points', label: 'PTS' },
                      { key: 'rebounds', label: 'REB' },
                      { key: 'assists', label: 'AST' },
                      { key: 'minutes', label: 'MIN' },
                      { key: 'two_pt_made', label: '2PT' },
                      { key: 'three_pt_made', label: '3PT' },
                      { key: 'free_throws_made', label: 'FT' },
                    ]}
                    value={chartStat}
                    onSelect={(key) => setChartStat(key as typeof chartStat)}
                    colorScheme={colorScheme ?? 'light'}
                    scrollable
                  />
                </View>
                <ThemedText style={styles.subsectionTitle}>{chartTitle}</ThemedText>
                <MiniBarChart
                  data={chartData}
                  colorScheme={colorScheme ?? 'light'}
                  useGradient={false}
                  chartHeight={100}
                  xAxisLabels={xLabels}
                  scrollable
                  barWidth={seasonBarWidth}
                  highlightLastN={highlightLastN}
                />
                {trendInsights.length > 0 && (
                  <InsightCarousel insights={trendInsights} style={styles.insightCarouselChart} cycleDurationMs={5000} />
                )}
              </View>
            );
          })()}

          {statSections.map((section, sectionIndex) => {
            const effectivePeriod = timePeriod;
            const sectionTitle =
              section.title === 'Season Averages'
                ? `Average for ${timePeriod === 'season' ? 'Season' : timePeriod === 'last_10' ? 'Last 10 Games' : 'Last 5 Games'}`
                : section.title;
            const showShotChart = section.shotChart === true;

            return (
              <View key={sectionIndex} style={styles.sectionContainer}>
                <ThemedText style={styles.subsectionTitle}>{sectionTitle}</ThemedText>
                {section.title === 'Season Averages' && averageInsights.length > 0 && (
                  <InsightCarousel insights={averageInsights} style={styles.insightCarouselAverages} cycleDurationMs={5000} />
                )}
                {section.title === 'Shooting Statistics' && shootingInsights.length > 0 && (
                  <InsightCarousel insights={shootingInsights} style={styles.insightCarouselShooting} cycleDurationMs={5000} />
                )}
                {showShotChart && (
                  <View style={styles.shotVisContainer}>
                    <ShotChart
                      shots={shots}
                      isLoading={shotsLoading}
                      colorScheme={colorScheme ?? 'light'}
                      ftMade={player.total_free_throws_made}
                      ftAttempts={player.total_free_throws_attempted}
                      ptsBreakdown={(() => {
                        const fgm = Number(player.total_field_goals_made ?? 0);
                        const tpm = Number(player.total_three_point_made ?? 0);
                        const ftm = Number(player.total_free_throws_made ?? 0);
                        const pts2pt = Math.max(0, fgm - tpm) * 2;
                        const pts3pt = tpm * 3;
                        const ptsFt = ftm;
                        return { pts2pt, pts3pt, ptsFt };
                      })()}
                      accuracyFromPlayer={{
                        fgMade: Number(player.total_field_goals_made ?? 0),
                        fgAttempts: Number(player.total_field_goals_attempted ?? 0),
                        threePtMade: Number(player.total_three_point_made ?? 0),
                        threePtAttempts: Number(player.total_three_point_attempted ?? 0),
                        ftMade: Number(player.total_free_throws_made ?? 0),
                        ftAttempts: Number(player.total_free_throws_attempted ?? 0),
                      }}
                    />
                  </View>
                )}
                {(() => {
                  let staggerIndex = 0;
                  return section.rows.map((row, rowIndex) => {
                  const resolvedStats = row.statKeys
                    .map((key) => {
                      const value = resolveStatValue(player as Record<string, unknown>, key, effectivePeriod);
                      if (value == null) return null;
                      const total = STAT_TOTAL_KEYS[key]
                        ? resolveStatTotal(player as Record<string, unknown>, key, effectivePeriod)
                        : null;
                      const label = STAT_LABELS[key] ?? key;
                      return { key, label, value, total };
                    })
                    .filter((s): s is { key: string; label: string; value: string; total: string | null } => s != null);

                  if (resolvedStats.length === 0) return null;

                  return (
                    <View key={rowIndex} style={styles.statsRow}>
                        {resolvedStats.map((stat, statIndex) => {
                          const idx = staggerIndex++;
                          return (
                            <AnimatedStatCard
                          key={stat.key}
                              timePeriod={effectivePeriod}
                              index={idx}
                          style={[
                            styles.statCard,
                            {
                              width: getStatCardWidthPercent(resolveItemsPerRow(row)) as DimensionValue,
                              paddingLeft: statIndex === 0 ? 0 : statIndex === 1 ? 8 : 16,
                            },
                          ]}>
                          <View>
                                <AnimatedStatElement timePeriod={effectivePeriod} index={0}>
                                  <AnimatedStatValue value={stat.value} timePeriod={effectivePeriod} style={styles.statValue} />
                                </AnimatedStatElement>
                                <AnimatedStatElement timePeriod={effectivePeriod} index={1}>
                            <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
                            {stat.total != null && (
                                    <ThemedText style={[styles.statLabel, styles.statTotalUnderLabel]} lightColor="#666" darkColor="#999">
                                      {stat.total} Total
                                    </ThemedText>
                            )}
                                </AnimatedStatElement>
                          </View>
                            </AnimatedStatCard>
                  );
                })}
                      </View>
                    );
                  });
                })()}
              </View>
            );
          })}
          <StatsOverlay opacity={statsOverlayOpacity} />
          </View>
        </View>

        {/* SPLITS */}
        {/* {isEnhanced && ( */}
          {/* <View style={styles.section}> */}
            {/* <ThemedText style={styles.sectionTitle}>Splits</ThemedText> */}

            {/* Home vs Away */}
            {/* {player.home_away_splits && (
              <View style={styles.splitSubsection}>
                <ThemedText style={styles.subsectionTitle}>Home vs Away</ThemedText>
                <View style={styles.insightRow}>
                  <View style={[styles.insightCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                    <ThemedText style={styles.insightLabel}>Home ({player.home_away_splits.home.games} games)</ThemedText>
                    <ThemedText style={styles.insightValue}>{player.home_away_splits.home.ppg} PPG</ThemedText>
                    <ThemedText style={styles.insightSub}>
                      {player.home_away_splits.home.fg_pct}% FG • ±{player.home_away_splits.home.plus_minus}
                    </ThemedText>
                  </View>
                  <View style={[styles.insightCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                    <ThemedText style={styles.insightLabel}>Away ({player.home_away_splits.away.games} games)</ThemedText>
                    <ThemedText style={styles.insightValue}>{player.home_away_splits.away.ppg} PPG</ThemedText>
                    <ThemedText style={styles.insightSub}>
                      {player.home_away_splits.away.fg_pct}% FG • ±{player.home_away_splits.away.plus_minus}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )} */}

            {/* First Half vs Second Half */}
            {/* {player.half_splits && (
              <View style={styles.splitSubsection}>
                <ThemedText style={styles.subsectionTitle}>First Half vs Second Half</ThemedText>
                <View style={styles.insightRow}>
                  <View style={[styles.insightCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                    <ThemedText style={styles.insightLabel}>First Half</ThemedText>
                    <ThemedText style={styles.insightValue}>{player.half_splits.first_half.ppg} PPG</ThemedText>
                    <ThemedText style={styles.insightSub}>
                      {player.half_splits.first_half.fg_pct}% FG • {player.half_splits.first_half.three_pt_pct}% 3PT
                    </ThemedText>
                  </View>
                  <View style={[styles.insightCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                    <ThemedText style={styles.insightLabel}>Second Half</ThemedText>
                    <ThemedText style={styles.insightValue}>{player.half_splits.second_half.ppg} PPG</ThemedText>
                    <ThemedText style={styles.insightSub}>
                      {player.half_splits.second_half.fg_pct}% FG • {player.half_splits.second_half.three_pt_pct}% 3PT
                    </ThemedText>
                  </View>
                </View>
              </View>
            )} */}

            {/* Points by Quarter */}
            {/* {player.quarter_averages && (
              <View style={styles.splitSubsection}>
                <ThemedText style={styles.subsectionTitle}>Points by Quarter</ThemedText>
                <View style={styles.quarterRow}>
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
                    const qData = player.quarter_averages?.[q];
                    if (!qData) return null;
                    return (
                      <View
                        key={q}
                        style={[styles.quarterCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
                        <ThemedText style={styles.quarterLabel}>{q}</ThemedText>
                        <ThemedText style={styles.quarterValue}>{qData.ppg}</ThemedText>
                        <ThemedText style={styles.quarterSub}>PPG</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>
            )} */}

            {/* Clutch Performance */}
            {/* {player.clutch_stats && player.clutch_stats.games > 0 && (
              <View style={styles.splitSubsection}>
                <ThemedText style={styles.subsectionTitle}>Clutch Performance</ThemedText>
                <ThemedText style={styles.clutchSub}>
                  Last 5 min, score within 5 pts • {player.clutch_stats.games} games
                </ThemedText>
                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, width: '48%' }]}>
                    <ThemedText style={styles.statValue}>{player.clutch_stats.ppg}</ThemedText>
                    <ThemedText style={styles.statLabel}>PPG</ThemedText>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, width: '48%' }]}>
                    <ThemedText style={styles.statValue}>{player.clutch_stats.fg_pct}%</ThemedText>
                    <ThemedText style={styles.statLabel}>FG%</ThemedText>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, width: '48%' }]}>
                    <ThemedText style={styles.statValue}>{player.clutch_stats.three_pt_pct}%</ThemedText>
                    <ThemedText style={styles.statLabel}>3PT%</ThemedText>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground, width: '48%' }]}>
                    <ThemedText style={styles.statValue}>{player.clutch_stats.ft_pct}%</ThemedText>
                    <ThemedText style={styles.statLabel}>FT%</ThemedText>
                  </View>
                </View>
              </View>
            )} */}
          {/* </View> */}
        {/* )} */}

        {/* Shot Distribution */}
        {/* {isEnhanced && 'shot_distribution' in player && player.shot_distribution && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Shot Distribution</ThemedText>
            <View style={styles.shotList}>
              {Object.entries(player.shot_distribution).map(([zone, data]) => (
                <View
                  key={zone}
                  style={[
                    styles.shotRow,
                    { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground },
                  ]}>
                  <ThemedText style={styles.shotZone}>{zone}</ThemedText>
                  <View style={styles.shotStats}>
                    <ThemedText style={styles.shotPct}>{data.pct}%</ThemedText>
                    <ThemedText style={styles.shotAttempts}>
                      {data.makes}/{data.attempts}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )} */}

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 100 : 60,
    alignItems: 'center',
  },
  playerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  headerInfo: {
    alignItems: 'center',
  },
  playerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  playerPosition: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  teamLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  statsContentWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  statsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
    marginVertical: 16,
  },
  trendSubsection: {},
  chartCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  chartStatTabs: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  sampleContext: {
    fontSize: 14,
    opacity: 0.7,
  },
  insightCarouselChart: {
    marginTop: 12,
  },
  insightCarouselAverages: {
    marginTop: 4,
    marginBottom: 8,
  },
  insightCarouselShooting: {
    marginTop: 4,
    marginBottom: 12,
  },
  shotVisContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  splitSubsection: {
    marginBottom: 20,
  },
  sectionContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    // justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  statCard: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    // justifyContent: 'space-evenly',
    // justifyContent: 'center',
    // paddingHorizontal: 16,
    // borderWidth: 1,
    // borderColor: 'orange',
    
  },
  pointsIcon: {
    marginRight: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  statTotalUnderLabel: {
    marginTop: -4,
    fontSize: 11,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
    textAlign: 'left',
  },
  insightRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  insightCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  insightSub: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  quarterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quarterCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quarterLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  quarterValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quarterSub: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 2,
  },
  shotList: {
    gap: 8,
  },
  shotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  shotZone: {
    fontSize: 14,
    fontWeight: '600',
  },
  shotStats: {
    alignItems: 'flex-end',
  },
  shotPct: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  shotAttempts: {
    fontSize: 12,
    opacity: 0.7,
  },
  clutchSub: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 12,
  },
});
