import type { GameLogEntry, ScheduleGame } from '@/lib/types';
import type { PlayerProp, PropStatKey, SingleProp, CombinedProp } from '@/lib/types/props';
import { isSingleProp } from '@/lib/types/props';
import { daysBetween, formatShortDate, getLocalDateStr, getPrevDayDateStr, getTonightOpponent } from '@/lib/utils/date';

export function getStatFromGameLog(g: GameLogEntry, stat: PropStatKey): number {
  if (stat === 'two_pt_made') {
    const fgm = g.field_goals_made ?? 0;
    const tpm = g.three_point_made ?? 0;
    return Math.max(0, fgm - tpm);
  }
  if (stat === 'three_pt_made') return g.three_point_made ?? 0;
  if (stat === 'free_throws_made') return g.free_throws_made ?? 0;
  const key = stat as keyof GameLogEntry;
  return (g[key] as number) ?? 0;
}

export type HitRateResult = {
  hitCount: number;
  totalGames: number;
  hitRate: number;
};

export type HitRateWindows = {
  season: HitRateResult;
  l10: HitRateResult | null;
  l5: HitRateResult | null;
};

function checkSinglePropHit(g: GameLogEntry, prop: SingleProp): boolean {
  const val = getStatFromGameLog(g, prop.stat);
  if (prop.direction === 'over') {
    return val >= Math.ceil(prop.line);
  }
  return val <= Math.floor(prop.line);
}

function checkCombinedPropHit(g: GameLogEntry, prop: CombinedProp): boolean {
  const threshold = 10;
  return prop.stats.every((stat) => getStatFromGameLog(g, stat) >= threshold);
}

function checkPropHit(g: GameLogEntry, prop: PlayerProp): boolean {
  return isSingleProp(prop) ? checkSinglePropHit(g, prop) : checkCombinedPropHit(g, prop);
}

export function computeHitRate(gameLog: GameLogEntry[], prop: PlayerProp): HitRateResult {
  if (gameLog.length === 0) {
    return { hitCount: 0, totalGames: 0, hitRate: 0 };
  }
  let hitCount = 0;
  for (const g of gameLog) {
    if (checkPropHit(g, prop)) hitCount++;
  }
  const totalGames = gameLog.length;
  return {
    hitCount,
    totalGames,
    hitRate: totalGames > 0 ? hitCount / totalGames : 0,
  };
}

export function sortGameLogNewestFirst(gameLog: GameLogEntry[]): GameLogEntry[] {
  return [...gameLog].sort((a, b) => {
    const dateCmp = String(b.game_date ?? '').localeCompare(String(a.game_date ?? ''));
    if (dateCmp !== 0) return dateCmp;
    return String(b.game_id ?? '').localeCompare(String(a.game_id ?? ''));
  });
}

export function computeHitRatesByWindow(gameLog: GameLogEntry[], prop: PlayerProp): HitRateWindows {
  const sorted = sortGameLogNewestFirst(gameLog);
  const season = computeHitRate(sorted, prop);
  const l10 = sorted.length >= 10 ? computeHitRate(sorted.slice(0, 10), prop) : null;
  const l5 = sorted.length >= 5 ? computeHitRate(sorted.slice(0, 5), prop) : null;
  return { season, l10, l5 };
}

/** Count games where ALL given props hit in the same game. */
export function computeMultiPropHitRate(
  gameLog: GameLogEntry[],
  props: PlayerProp[]
): HitRateResult {
  if (gameLog.length === 0 || props.length === 0) {
    return { hitCount: 0, totalGames: 0, hitRate: 0 };
  }
  let hitCount = 0;
  for (const g of gameLog) {
    if (props.every((prop) => checkPropHit(g, prop))) hitCount++;
  }
  return {
    hitCount,
    totalGames: gameLog.length,
    hitRate: gameLog.length > 0 ? hitCount / gameLog.length : 0,
  };
}

function getSeasonAvg(gameLog: GameLogEntry[], stat: PropStatKey): number {
  if (gameLog.length === 0) return 0;
  const sum = gameLog.reduce((s, g) => s + getStatFromGameLog(g, stat), 0);
  return sum / gameLog.length;
}

/** Season average from game log (exported for live insights). */
export function getSeasonAvgFromGameLog(gameLog: GameLogEntry[], stat: PropStatKey): number {
  return getSeasonAvg(gameLog, stat);
}

/** Season high (max single-game value) from game log. */
export function getSeasonMaxFromGameLog(gameLog: GameLogEntry[], stat: PropStatKey): number {
  if (gameLog.length === 0) return 0;
  return Math.max(...gameLog.map((g) => getStatFromGameLog(g, stat)));
}

function getPlayerSeasonAvg(
  player: { games_played?: number; [key: string]: unknown },
  stat: PropStatKey
): number {
  const gp = Math.max(1, Number(player.games_played ?? 1));
  if (stat === 'points') return Number(player.total_points ?? 0) / gp;
  if (stat === 'rebounds') return Number(player.total_rebounds ?? 0) / gp;
  if (stat === 'assists') return Number(player.total_assists ?? 0) / gp;
  if (stat === 'steals') return Number(player.total_steals ?? 0) / gp;
  if (stat === 'blocks') return Number(player.total_blocks ?? 0) / gp;
  if (stat === 'minutes') return Number(player.total_minutes ?? 0) / gp;
  if (stat === 'turnovers') return Number(player.total_turnovers ?? 0) / gp;
  if (stat === 'fouls') return Number(player.total_fouls ?? 0) / gp;
  if (stat === 'two_pt_made') {
    const fgm = Number(player.total_field_goals_made ?? 0);
    const tpm = Number(player.total_three_point_made ?? 0);
    return Math.max(0, fgm - tpm) / gp;
  }
  if (stat === 'three_pt_made') return Number(player.total_three_point_made ?? 0) / gp;
  if (stat === 'free_throws_made') return Number(player.total_free_throws_made ?? 0) / gp;
  return 0;
}

const PROP_STAT_LABELS: Record<PropStatKey, string> = {
  points: 'PTS',
  rebounds: 'REB',
  assists: 'AST',
  steals: 'STL',
  blocks: 'BLK',
  minutes: 'MIN',
  turnovers: 'TOV',
  fouls: 'PF',
  two_pt_made: '2PT',
  three_pt_made: '3PT',
  free_throws_made: 'FT',
};

export function formatPropDescription(prop: PlayerProp): string {
  if (isSingleProp(prop)) {
    const dir = prop.direction === 'over' ? 'Over' : 'Under';
    const label = PROP_STAT_LABELS[prop.stat];
    return `${dir} ${prop.line} ${label}`;
  }
  if (prop.type === 'double_double') {
    const labels = prop.stats.map((s) => PROP_STAT_LABELS[s]).join(' + ');
    return `${labels} Double-Double`;
  }
  const labels = prop.stats.map((s) => PROP_STAT_LABELS[s]).join(' + ');
  return `${labels} Triple-Double`;
}

export function computePropInsights(
  player: {
    athlete_id?: string;
    athlete_display_name?: string;
    team_abbreviation?: string;
    games_played?: number;
    game_log?: unknown[];
    [key: string]: unknown;
  },
  prop: PlayerProp,
  hitRate: HitRateResult,
  scheduleGames: ScheduleGame[] = [],
  otherPropsForSamePlayer: PlayerProp[] = []
): string[] {
  const insights: string[] = [];
  const gameLog = sortGameLogNewestFirst((player.game_log ?? []) as GameLogEntry[]);
  if (gameLog.length === 0) return insights;

  insights.push(
    `Hit in ${hitRate.hitCount} of ${hitRate.totalGames} games (${(hitRate.hitRate * 100).toFixed(0)}%).`
  );

  if (otherPropsForSamePlayer.length > 0) {
    const allPropsForPlayer = [prop, ...otherPropsForSamePlayer];
    const multiRate = computeMultiPropHitRate(gameLog, allPropsForPlayer);
    if (multiRate.totalGames > 0) {
      const count = allPropsForPlayer.length;
      const bothStr = count === 2 ? 'both' : `all ${count}`;
      let line = `Hit ${bothStr} in same game: ${multiRate.hitCount}/${multiRate.totalGames} (${(multiRate.hitRate * 100).toFixed(0)}%)`;
      if (gameLog.length >= 10) {
        const last10 = gameLog.slice(0, 10);
        const r10 = computeMultiPropHitRate(last10, allPropsForPlayer);
        line += `. L10: ${r10.hitCount}/10 (${(r10.hitRate * 100).toFixed(0)}%)`;
      }
      if (gameLog.length >= 5) {
        const last5 = gameLog.slice(0, 5);
        const r5 = computeMultiPropHitRate(last5, allPropsForPlayer);
        line += `. L5: ${r5.hitCount}/5 (${(r5.hitRate * 100).toFixed(0)}%)`;
      }
      insights.push(line + '.');
    }
  }

  if (isSingleProp(prop)) {
    const seasonAvg = getSeasonAvg(gameLog, prop.stat);
    const label = PROP_STAT_LABELS[prop.stat];
    insights.push(`Season avg: ${seasonAvg.toFixed(1)} vs line ${prop.line} ${label}.`);
    if (prop.direction === 'over' && seasonAvg >= prop.line) {
      insights.push(`Season average above line.`);
    } else if (prop.direction === 'under' && seasonAvg <= prop.line) {
      insights.push(`Season average below line.`);
    }

    if (gameLog.length >= 10) {
      const last10 = gameLog.slice(0, 10);
      const last10Avg =
        last10.reduce((s, g) => s + getStatFromGameLog(g, prop.stat), 0) / last10.length;
      const last10Hit = last10.filter((g) => checkSinglePropHit(g, prop)).length;
      insights.push(`Last 10 avg: ${last10Avg.toFixed(1)}. Hit ${last10Hit}/10.`);
    }
    if (gameLog.length >= 5) {
      const last5 = gameLog.slice(0, 5);
      const last5Hit = last5.filter((g) => checkSinglePropHit(g, prop)).length;
      insights.push(`Last 5: ${last5Hit} of 5 hit.`);
    }
  } else {
    if (gameLog.length >= 10) {
      const last10 = gameLog.slice(0, 10);
      const last10Hit = last10.filter((g) => checkCombinedPropHit(g, prop)).length;
      insights.push(`Last 10: ${last10Hit}/10 hit.`);
    }
    if (gameLog.length >= 5) {
      const last5 = gameLog.slice(0, 5);
      const last5Hit = last5.filter((g) => checkCombinedPropHit(g, prop)).length;
      insights.push(`Last 5: ${last5Hit}/5 hit.`);
    }
  }

  if (gameLog.length >= 1) {
    const lastGame = gameLog[0];
    const lastDate = String(lastGame.game_date ?? '');
    const lastOpponent = (lastGame.opponent_team_abbreviation ?? '').trim() || null;
    const againstStr = lastOpponent ? ` against ${lastOpponent}` : '';
    const todayStr = getLocalDateStr();
    const daysSince = daysBetween(todayStr, lastDate);
    const daysOfRest = Math.max(0, daysSince - 1);
    const lastGameFmt = formatShortDate(lastDate);
    const teamAbbrev = player.team_abbreviation;
    if (daysSince <= 4) {
      if (daysSince === 1 && daysOfRest === 0) {
        const opponent = teamAbbrev ? getTonightOpponent(teamAbbrev, scheduleGames) : null;
        const gameDates = new Set(gameLog.map((g) => String(g.game_date ?? '')));
        const backToBackGames = gameLog.filter((g) => {
          const d = String(g.game_date ?? '');
          return d && gameDates.has(getPrevDayDateStr(d));
        });
        let b2bSuffix = '';
        if (backToBackGames.length > 0) {
          const b2bHit = backToBackGames.filter((g) =>
            isSingleProp(prop) ? checkSinglePropHit(g, prop) : checkCombinedPropHit(g, prop)
          ).length;
          b2bSuffix = ` In back-to-back games: ${b2bHit}/${backToBackGames.length} hit (${((b2bHit / backToBackGames.length) * 100).toFixed(0)}%).`;
        }
        if (opponent) {
          insights.push(`Playing a back-to-back tonight against ${opponent}.${b2bSuffix}`);
        } else {
          insights.push(`1 day of rest since last game on ${lastGameFmt}${againstStr}.${b2bSuffix}`);
        }
      } else if (daysOfRest === 0) {
        insights.push(`0 days of rest since last game on ${lastGameFmt}${againstStr}.`);
      } else if (daysOfRest === 1) {
        insights.push(`1 day of rest since last game on ${lastGameFmt}${againstStr}.`);
      } else {
        insights.push(`${daysOfRest} days of rest since last game on ${lastGameFmt}${againstStr}.`);
      }
    }
  }

  return insights;
}
