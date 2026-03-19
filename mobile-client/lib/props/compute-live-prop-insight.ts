import type {
  PlayerQuarterContext,
  PlayerQuarterStatsRow,
} from '@/lib/queries/player-quarter-stats';
import {
  conditionalPaceAtHalf,
  maxStatWithQuartersLeft,
  pctQ4Gte,
  pctSecondHalfGte,
  pctTotalGte,
  pctExceededByGte,
  pctUnderByGte,
  varianceInQuarter,
} from '@/lib/queries/player-quarter-stats';
import type { GameLogEntry } from '@/lib/types';
import type { AccumulatedStats } from '@/lib/utils/live-stats';
import type { PropStatKey, SingleProp } from '@/lib/types/props';
import { isSingleProp } from '@/lib/types/props';
import {
  computeHitRate,
  getSeasonAvgFromGameLog,
  getSeasonMaxFromGameLog,
} from './compute-prop-stats';

export function getCurrentStatValue(stats: AccumulatedStats, stat: PropStatKey): number {
  switch (stat) {
    case 'points':
      return stats.points;
    case 'rebounds':
      return stats.rebounds;
    case 'assists':
      return stats.assists;
    case 'steals':
      return stats.steals;
    case 'blocks':
      return stats.blocks;
    case 'minutes':
      return stats.minutes_estimate;
    case 'turnovers':
      return stats.turnovers;
    case 'fouls':
      return stats.fouls;
    case 'two_pt_made':
      return Math.max(0, stats.field_goals_made - stats.three_point_made);
    case 'three_pt_made':
      return stats.three_point_made;
    case 'free_throws_made':
      return stats.free_throws_made;
    default:
      return 0;
  }
}

export type LivePropInsight = {
  currentValue: number;
  line: number;
  direction: 'over' | 'under';
  projectedValue: number | null;
  averageProjectedValue?: number | null;
  paceLikelihood: number | null;
  insightStrings: string[];
  seasonAvg?: number;
};

export type PlayerHistoryContext = {
  gameLog: GameLogEntry[];
};

export type LeagueQuarterContext = {
  secondHalfP50: number;
  secondHalfP90: number;
  secondHalfP99: number;
};

export type StatsAtQuarterEnds = {
  q1: Map<string, AccumulatedStats> | null;
  q2: Map<string, AccumulatedStats> | null;
  q3: Map<string, AccumulatedStats> | null;
  q4: Map<string, AccumulatedStats> | null;
};

const TOTAL_GAME_MINUTES = 48;

const PROP_STAT_LABELS: Partial<Record<PropStatKey, string>> = {
  points: 'pts',
  rebounds: 'reb',
  assists: 'ast',
  steals: 'stl',
  blocks: 'blk',
  turnovers: 'tov',
  fouls: 'pf',
  two_pt_made: '2PT',
  three_pt_made: '3PT',
  free_throws_made: 'ft',
};

/**
 * Computes live prop insight from current accumulated stats.
 * Uses pace-based projection: projected = current * (48 / minutesPlayed).
 * Optionally incorporates player history (Phase 1), quarter stats (Phase 2), and league baseline (Phase 3).
 */
export function computeLivePropInsight(
  stats: AccumulatedStats | null,
  prop: SingleProp,
  _allProps?: unknown[],
  playerHistory?: PlayerHistoryContext | null,
  quarterContext?: PlayerQuarterContext | null,
  quarterRows?: PlayerQuarterStatsRow[] | null,
  leagueContext?: LeagueQuarterContext | null,
  statsAtQuarterEnds?: StatsAtQuarterEnds | null,
  currentPeriod?: number,
  athleteId?: string
): LivePropInsight | null {
  if (!stats || !isSingleProp(prop)) return null;

  const currentValue = getCurrentStatValue(stats, prop.stat);
  const { line, direction } = prop;
  const minutesPlayed = stats.minutes_estimate;
  const isHit =
    direction === 'over'
      ? currentValue >= Math.ceil(line)
      : currentValue <= Math.floor(line);

  const insightStrings: string[] = [];
  let projectedValue: number | null = null;
  let paceLikelihood: number | null = null;
  let seasonAvg: number | undefined;

  // For minutes prop, pace projection doesn't apply the same way
  if (prop.stat === 'minutes') {
    insightStrings.push(`Current: ${currentValue.toFixed(1)} min. Line: ${direction} ${line}.`);
    return {
      currentValue,
      line,
      direction,
      projectedValue: currentValue,
      paceLikelihood: null,
      insightStrings,
    };
  }

  if (minutesPlayed > 0) {
    const pace = currentValue / minutesPlayed;
    projectedValue = pace * TOTAL_GAME_MINUTES;
    const minutesRemaining = TOTAL_GAME_MINUTES - minutesPlayed;

    if (direction === 'over') {
      const needs = Math.ceil(line) - currentValue;
      if (needs <= 0) {
        paceLikelihood = 1;
      } else {
        const projectedRemaining = pace * minutesRemaining;
        paceLikelihood = Math.min(1, Math.max(0, projectedRemaining / needs));
        const projRounded = Math.round(projectedValue);
        let paceLine = `On pace for ${projRounded} — needs ${needs} more (~${(paceLikelihood * 100).toFixed(0)}% pace likelihood)`;
        insightStrings.push(paceLine + '.');
      }
    } else {
      const maxAllowed = Math.floor(line) - currentValue;
      if (maxAllowed < 0) {
        paceLikelihood = 0;
      } else {
        const projectedRemaining = pace * minutesRemaining;
        const likelihoodToStayUnder = Math.max(0, 1 - projectedRemaining / (maxAllowed + 1));
        paceLikelihood = likelihoodToStayUnder;
        insightStrings.push(
          `On pace for ${projectedValue.toFixed(1)}. Can add ${maxAllowed} more to stay under. ~${(likelihoodToStayUnder * 100).toFixed(0)}% likelihood.`
        );
      }
    }
  } else {
    insightStrings.push(`No game time elapsed yet. Current: ${currentValue.toFixed(1)}.`);
  }

  // Pace vs season average
  if (playerHistory?.gameLog?.length && minutesPlayed > 0) {
    const gameLog = playerHistory.gameLog as GameLogEntry[];
    seasonAvg = getSeasonAvgFromGameLog(gameLog, prop.stat);
    const seasonPacePerMin = seasonAvg / TOTAL_GAME_MINUTES;
    const currentPace = currentValue / minutesPlayed;
    if (seasonPacePerMin > 0) {
      const pctVsAvg = ((currentPace / seasonPacePerMin) - 1) * 100;
      if (pctVsAvg >= 5) {
        insightStrings.push(`${pctVsAvg.toFixed(0)}% above his season pace.`);
      } else if (pctVsAvg <= -5) {
        insightStrings.push(`${Math.abs(pctVsAvg).toFixed(0)}% below his season pace.`);
      } else {
        insightStrings.push(`On pace with his season avg.`);
      }
    }
  }

  // Season context: avg, high, hit rate (consolidated)
  if (playerHistory?.gameLog?.length) {
    const gameLog = playerHistory.gameLog as GameLogEntry[];
    seasonAvg = getSeasonAvgFromGameLog(gameLog, prop.stat);
    const seasonHigh = getSeasonMaxFromGameLog(gameLog, prop.stat);
    const hitRate = computeHitRate(gameLog, prop);
    if (isHit && direction === 'over' && hitRate.totalGames > 0) {
      insightStrings.push(`Hit line in ${(hitRate.hitRate * 100).toFixed(0)}% of games this season.`);
    } else if (direction === 'over' && seasonHigh < line) {
      insightStrings.push(`Never hit line this season (high: ${seasonHigh.toFixed(0)}). Season avg: ${seasonAvg.toFixed(1)}.`);
    } else if (!isHit) {
      const parts: string[] = [`Season: ${seasonAvg.toFixed(1)} avg, ${seasonHigh.toFixed(0)} high`];
      if (hitRate.totalGames > 0) {
        parts.push(`Hit line in ${(hitRate.hitRate * 100).toFixed(0)}% of games`);
      }
      insightStrings.push(parts.join('. ') + '.');
    }
  }

  // Projected total vs historical distribution (points) — skip when already hit
  if (
    projectedValue != null &&
    projectedValue > 0 &&
    direction === 'over' &&
    !isHit
  ) {
    const projRounded = Math.round(projectedValue);
    if (quarterRows && quarterRows.length >= 10 && prop.stat === 'points') {
      const { pct, count, total } = pctTotalGte(quarterRows, projRounded);
      insightStrings.push(
        `Hit ${projRounded}+ in ${count}/${total} games (${Math.round(pct)}%).`
      );
    } else if (playerHistory?.gameLog?.length && prop.stat === 'points') {
      const gameLog = playerHistory.gameLog as GameLogEntry[];
      const count = gameLog.filter((g) => (g.points ?? 0) >= projRounded).length;
      const total = gameLog.length;
      if (total >= 5) {
        insightStrings.push(
          `Hit ${projRounded}+ in ${count}/${total} games (${Math.round((count / total) * 100)}%).`
        );
      }
    }
  }

  // Need-based: "He needs X in Q4 / 2nd half — he's done that in Y% of games" — skip when already hit
  if (
    prop.stat === 'points' &&
    quarterRows &&
    quarterRows.length >= 10 &&
    direction === 'over' &&
    !isHit
  ) {
    const needs = Math.ceil(line) - currentValue;
    if (needs > 0 && currentPeriod != null) {
      if (currentPeriod === 3) {
        const { pct, count, total } = pctSecondHalfGte(quarterRows, needs);
        insightStrings.push(
          `Needs ${needs} in 2nd half — he's done that in ${count}/${total} games (${Math.round(pct)}%).`
        );
      } else if (currentPeriod === 4) {
        const { pct, count, total } = pctQ4Gte(quarterRows, needs);
        insightStrings.push(
          `Needs ${needs} in Q4 — he's done that in ${count}/${total} games (${Math.round(pct)}%).`
        );
      }
    }
  }

  // Phase 3: League baseline ("X in a half is ~Yth percentile")
  if (leagueContext && prop.stat === 'points' && direction === 'over') {
    const needs = Math.ceil(line) - currentValue;
    if (needs > 0) {
      const { secondHalfP50, secondHalfP90, secondHalfP99 } = leagueContext;
      let percentile = 'rare';
      if (needs <= secondHalfP50) percentile = '~50th';
      else if (needs <= secondHalfP90) percentile = '~90th';
      else if (needs <= secondHalfP99) percentile = '~99th';
      insightStrings.push(`${needs} in a half is ${percentile} percentile for league.`);
    }
  }

  // Conditional pace at half: "In games where he had X+ at half, he finished with Y+ in Z%" — skip when already hit
  if (
    prop.stat === 'points' &&
    quarterRows &&
    quarterRows.length >= 10 &&
    statsAtQuarterEnds?.q2 &&
    athleteId &&
    currentPeriod != null &&
    currentPeriod >= 3 &&
    direction === 'over' &&
    !isHit
  ) {
    const q2Stats = statsAtQuarterEnds.q2.get(athleteId);
    const firstHalfPts = q2Stats ? getCurrentStatValue(q2Stats, 'points') : 0;
    const cond = conditionalPaceAtHalf(quarterRows, Math.max(0, firstHalfPts - 1), line);
    if (cond && cond.sampleSize >= 5) {
      insightStrings.push(
        `When he had ${firstHalfPts}+ at half, he finished with ${line}+ in ${Math.round(cond.hitPct)}% of games (n=${cond.sampleSize}).`
      );
    }
  }

  // Historical quarter/half exceed vs underperform rates
  if (
    prop.stat === 'points' &&
    quarterContext &&
    quarterContext.gamesWithSecondHalfData >= 10 &&
    currentPeriod != null &&
    currentPeriod >= 1 &&
    currentPeriod <= 4
  ) {
    const quarterRates = [
      quarterContext.q1Rates,
      quarterContext.q2Rates,
      quarterContext.q3Rates,
      quarterContext.q4Rates,
    ][currentPeriod - 1];
    const fmt = (p: number) => Math.round(p).toString();
    insightStrings.push(
      `Exceeds Q${currentPeriod} avg in ${fmt(quarterRates.exceedPct)}% of games. Underperforms in ${fmt(quarterRates.underPct)}%.`
    );
    if (currentPeriod >= 3) {
      const { exceedPct, underPct } = quarterContext.secondHalfRates;
      insightStrings.push(
        `Exceeds 2nd half avg in ${fmt(exceedPct)}% of games. Underperforms in ${fmt(underPct)}%.`
      );
    } else {
      const { exceedPct, underPct } = quarterContext.firstHalfRates;
      insightStrings.push(
        `Exceeds 1st half avg in ${fmt(exceedPct)}% of games. Underperforms in ${fmt(underPct)}%.`
      );
    }
  }

  // Current vs typical quarter: "He's X above his Q2 avg — exceeded by 2+ in only Y% of games"
  if (
    prop.stat === 'points' &&
    quarterRows &&
    quarterContext &&
    stats &&
    quarterRows.length >= 10 &&
    statsAtQuarterEnds &&
    athleteId &&
    currentPeriod != null &&
    currentPeriod >= 1 &&
    currentPeriod <= 4
  ) {
    const quarterKeys = ['q1', 'q2', 'q3', 'q4'] as const;
    const avg = [quarterContext.avgQ1, quarterContext.avgQ2, quarterContext.avgQ3, quarterContext.avgQ4][
      currentPeriod - 1
    ];
    let currentQuarterVal = 0;
    const currMap = statsAtQuarterEnds[quarterKeys[currentPeriod - 1]];
    const prevKey = currentPeriod > 1 ? quarterKeys[currentPeriod - 2] : null;
    const prevMap = prevKey ? statsAtQuarterEnds[prevKey] : null;
    const currStats = currMap?.get(athleteId);
    const prevStats = prevMap?.get(athleteId);
    const currCum = currStats ? getCurrentStatValue(currStats, 'points') : null;
    const prevCum = prevStats ? getCurrentStatValue(prevStats, 'points') : 0;
    if (currCum != null) {
      currentQuarterVal = currCum - prevCum;
    } else {
      currentQuarterVal = getCurrentStatValue(stats, 'points') - prevCum;
    }
    const delta = currentQuarterVal - avg;
    if (Math.abs(delta) >= 1.5) {
      const q = currentPeriod as 1 | 2 | 3 | 4;
      if (delta > 0) {
        const pct = pctExceededByGte(quarterRows, q, avg, Math.round(delta));
        insightStrings.push(
          `He's ${delta.toFixed(1)} above his Q${currentPeriod} avg — exceeded by ${Math.round(delta)}+ in only ${Math.round(pct)}% of games.`
        );
      } else {
        const pct = pctUnderByGte(quarterRows, q, avg, Math.round(-delta));
        insightStrings.push(
          `He's ${(-delta).toFixed(1)} below his Q${currentPeriod} avg — underperformed by ${Math.round(-delta)}+ in ${Math.round(pct)}% of games.`
        );
      }
    }
  }

  // Variance: "His Q4 is highly variable" or "Within 1 of his Q4 avg in X% of games"
  if (
    prop.stat === 'points' &&
    quarterRows &&
    quarterContext &&
    quarterRows.length >= 15 &&
    currentPeriod != null &&
    currentPeriod >= 1 &&
    currentPeriod <= 4
  ) {
    const q = currentPeriod as 1 | 2 | 3 | 4;
    const avg = [quarterContext.avgQ1, quarterContext.avgQ2, quarterContext.avgQ3, quarterContext.avgQ4][
      currentPeriod - 1
    ];
    const { stdDev, pctWithin1 } = varianceInQuarter(quarterRows, q, avg);
    if (stdDev >= 2.5) {
      insightStrings.push(
        `Q${currentPeriod} is highly variable (${stdDev.toFixed(1)} std dev).`
      );
    } else if (pctWithin1 >= 55) {
      insightStrings.push(
        `Within 1 of his Q${currentPeriod} avg in ${Math.round(pctWithin1)}% of games.`
      );
    }
  }

  // Max stat with quarters left: "The most they've scored with 2 quarters left is 24 PTS"
  const SUPPORTED_QUARTER_STATS: PropStatKey[] = [
    'points',
    'rebounds',
    'assists',
    'steals',
    'blocks',
    'turnovers',
    'fouls',
  ];
  if (
    quarterRows &&
    quarterRows.length >= 10 &&
    currentPeriod != null &&
    (currentPeriod === 3 || currentPeriod === 4) &&
    SUPPORTED_QUARTER_STATS.includes(prop.stat)
  ) {
    const quartersLeft = 5 - currentPeriod;
    const max = maxStatWithQuartersLeft(
      quarterRows,
      prop.stat as 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'turnovers' | 'fouls',
      quartersLeft
    );
    if (max != null) {
      const label = (PROP_STAT_LABELS[prop.stat] ?? prop.stat).toUpperCase();
      const verb = prop.stat === 'points' ? 'scored' : 'gotten';
      const quartersText = quartersLeft === 1 ? '1 quarter left' : '2 quarters left';
      insightStrings.push(
        `The most they've ${verb} with ${quartersText} is ${max} ${label}.`
      );
    }
  }

  // Quarterly averages and over/under after each quarter completes
  if (quarterContext && statsAtQuarterEnds && currentPeriod != null && athleteId) {
    const label = PROP_STAT_LABELS[prop.stat] ?? prop.stat;
    const getVal = (s: AccumulatedStats) => getCurrentStatValue(s, prop.stat);

    // For points: use actual quarter averages from RPC; for other stats: use seasonAvg/4
    const seasonAvg = playerHistory?.gameLog?.length
      ? getSeasonAvgFromGameLog(playerHistory.gameLog as GameLogEntry[], prop.stat)
      : 0;
    const avgPerQuarter = prop.stat === 'points' ? null : seasonAvg / 4;

    const quarterAvgs =
      prop.stat === 'points'
        ? [
            quarterContext.avgQ1,
            quarterContext.avgQ2,
            quarterContext.avgQ3,
            quarterContext.avgQ4,
          ]
        : [avgPerQuarter, avgPerQuarter, avgPerQuarter, avgPerQuarter];

    // Show quarter averages (points: from RPC; others: season/4)
    if (prop.stat === 'points' && quarterContext.gamesWithSecondHalfData > 0) {
      insightStrings.push(
        `Quarter avgs: Q1 ${quarterContext.avgQ1.toFixed(1)} · Q2 ${quarterContext.avgQ2.toFixed(1)} · Q3 ${quarterContext.avgQ3.toFixed(1)} · Q4 ${quarterContext.avgQ4.toFixed(1)}`
      );
    } else if (prop.stat !== 'points' && seasonAvg > 0) {
      insightStrings.push(
        `Quarter avg (season/4): ${avgPerQuarter!.toFixed(1)} ${label}`
      );
    }

    const quarters: { key: 'q1' | 'q2' | 'q3' | 'q4'; period: number }[] = [
      { key: 'q1', period: 1 },
      { key: 'q2', period: 2 },
      { key: 'q3', period: 3 },
      { key: 'q4', period: 4 },
    ];

    const completed: string[] = [];
    let prevCumulative = 0;
    for (const { key, period } of quarters) {
      if (currentPeriod < period) break;
      const map = statsAtQuarterEnds[key];
      const qStats = map?.get(athleteId);
      const avg = quarterAvgs[period - 1];
      if (qStats != null && avg != null) {
        const cumulative = getVal(qStats);
        const val = cumulative - prevCumulative;
        prevCumulative = cumulative;
        const diff = val - avg;
        const sign = diff >= 0 ? '+' : '';
        completed.push(`Q${period}: ${val.toFixed(1)} vs ${avg.toFixed(1)} avg (${sign}${diff.toFixed(1)})`);
      }
    }

    if (completed.length > 0) {
      insightStrings.push(`By quarter: ${completed.join(' · ')}`);
    }
  }

  const period = currentPeriod ?? 4;
  const remainingQuarters = Math.max(0, 5 - period); // In Q1: 4 left, Q2: 3, Q3: 2, Q4: 1

  let averageProjectedValue: number | null = null;
  if (remainingQuarters === 0) {
    averageProjectedValue = currentValue; // Game over (e.g. period > 4)
  } else if (
    prop.stat === 'points' &&
    quarterContext &&
    quarterContext.gamesWithSecondHalfData > 0
  ) {
    const quarterAvgs = [
      quarterContext.avgQ1,
      quarterContext.avgQ2,
      quarterContext.avgQ3,
      quarterContext.avgQ4,
    ];
    const remainingAvgSum = quarterAvgs
      .slice(period - 1, 4)
      .reduce((sum, avg) => sum + avg, 0);
    averageProjectedValue = currentValue + remainingAvgSum;
  } else if (seasonAvg != null && seasonAvg > 0) {
    averageProjectedValue =
      currentValue + (seasonAvg / 4) * remainingQuarters;
  }

  return {
    currentValue,
    line,
    direction,
    projectedValue,
    averageProjectedValue,
    paceLikelihood,
    insightStrings,
    seasonAvg,
  };
}
