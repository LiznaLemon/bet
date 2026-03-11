import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type PlayerQuarterStatsRow = {
  game_id: string;
  q1_pts: number;
  q2_pts: number;
  q3_pts: number;
  q4_pts: number;
  second_half_pts: number;
};

export type QuarterOverUnderRates = {
  exceedPct: number;
  underPct: number;
};

export type PlayerQuarterContext = {
  maxSecondHalf: number;
  avgSecondHalf: number;
  gamesWithSecondHalfData: number;
  avgQ1: number;
  avgQ2: number;
  avgQ3: number;
  avgQ4: number;
  /** % of games player exceeded quarter avg (points) */
  q1Rates: QuarterOverUnderRates;
  q2Rates: QuarterOverUnderRates;
  q3Rates: QuarterOverUnderRates;
  q4Rates: QuarterOverUnderRates;
  /** First half = Q1+Q2 */
  firstHalfRates: QuarterOverUnderRates;
  /** Second half = Q3+Q4 */
  secondHalfRates: QuarterOverUnderRates;
};

export async function fetchPlayerQuarterStats(
  athleteId: string,
  season = 2026,
  limit = 50
): Promise<PlayerQuarterStatsRow[]> {
  const { data, error } = await supabase.rpc('get_player_quarter_stats', {
    p_athlete_id: athleteId,
    p_season: season,
    p_season_type: 2,
    p_limit: limit,
  });

  if (error) {
    console.error('[fetchPlayerQuarterStats]', error.message);
    throw error;
  }

  return (data ?? []) as PlayerQuarterStatsRow[];
}

function computeOverUnderRates(
  values: number[],
  avg: number
): QuarterOverUnderRates {
  const n = values.length;
  if (n === 0) return { exceedPct: 0, underPct: 0 };
  let exceed = 0;
  let under = 0;
  for (const v of values) {
    if (v > avg) exceed++;
    else if (v < avg) under++;
  }
  return {
    exceedPct: (exceed / n) * 100,
    underPct: (under / n) * 100,
  };
}

export function computeQuarterContext(rows: PlayerQuarterStatsRow[]): PlayerQuarterContext | null {
  if (rows.length === 0) return null;
  const secondHalfValues = rows.map((r) => r.second_half_pts);
  const maxSecondHalf = Math.max(...secondHalfValues);
  const avgSecondHalf =
    secondHalfValues.reduce((a, b) => a + b, 0) / secondHalfValues.length;
  const avgQ1 = rows.reduce((s, r) => s + r.q1_pts, 0) / rows.length;
  const avgQ2 = rows.reduce((s, r) => s + r.q2_pts, 0) / rows.length;
  const avgQ3 = rows.reduce((s, r) => s + r.q3_pts, 0) / rows.length;
  const avgQ4 = rows.reduce((s, r) => s + r.q4_pts, 0) / rows.length;
  const firstHalfValues = rows.map((r) => r.q1_pts + r.q2_pts);
  const avgFirstHalf = avgQ1 + avgQ2;

  return {
    maxSecondHalf,
    avgSecondHalf,
    gamesWithSecondHalfData: rows.length,
    avgQ1,
    avgQ2,
    avgQ3,
    avgQ4,
    q1Rates: computeOverUnderRates(rows.map((r) => r.q1_pts), avgQ1),
    q2Rates: computeOverUnderRates(rows.map((r) => r.q2_pts), avgQ2),
    q3Rates: computeOverUnderRates(rows.map((r) => r.q3_pts), avgQ3),
    q4Rates: computeOverUnderRates(rows.map((r) => r.q4_pts), avgQ4),
    firstHalfRates: computeOverUnderRates(firstHalfValues, avgFirstHalf),
    secondHalfRates: computeOverUnderRates(secondHalfValues, avgSecondHalf),
  };
}

export function usePlayerQuarterStats(
  athleteId: string | undefined,
  season = 2026
) {
  return useQuery({
    queryKey: ['player-quarter-stats', athleteId, season],
    queryFn: () => fetchPlayerQuarterStats(athleteId!, season),
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
  });
}

// --- Live insight helpers (points only, uses quarter rows) ---

/** % of games where second half pts >= threshold */
export function pctSecondHalfGte(
  rows: PlayerQuarterStatsRow[],
  threshold: number
): { pct: number; count: number; total: number } {
  if (rows.length === 0) return { pct: 0, count: 0, total: 0 };
  const count = rows.filter((r) => r.second_half_pts >= threshold).length;
  return { pct: (count / rows.length) * 100, count, total: rows.length };
}

/** % of games where Q4 pts >= threshold */
export function pctQ4Gte(
  rows: PlayerQuarterStatsRow[],
  threshold: number
): { pct: number; count: number; total: number } {
  if (rows.length === 0) return { pct: 0, count: 0, total: 0 };
  const count = rows.filter((r) => r.q4_pts >= threshold).length;
  return { pct: (count / rows.length) * 100, count, total: rows.length };
}

/** % of games where total game pts >= threshold */
export function pctTotalGte(
  rows: PlayerQuarterStatsRow[],
  threshold: number
): { pct: number; count: number; total: number } {
  if (rows.length === 0) return { pct: 0, count: 0, total: 0 };
  const count = rows.filter(
    (r) => r.q1_pts + r.q2_pts + r.q3_pts + r.q4_pts >= threshold
  ).length;
  return { pct: (count / rows.length) * 100, count, total: rows.length };
}

/** Of games where first half was >= halfPtsMin, what % finished with total >= line */
export function conditionalPaceAtHalf(
  rows: PlayerQuarterStatsRow[],
  halfPtsMin: number,
  line: number
): { hitPct: number; sampleSize: number } | null {
  const firstHalf = rows.map((r) => r.q1_pts + r.q2_pts);
  const total = rows.map((r) => r.q1_pts + r.q2_pts + r.q3_pts + r.q4_pts);
  const matches = rows
    .map((r, i) => ({ first: firstHalf[i], tot: total[i] }))
    .filter((x) => x.first >= halfPtsMin);
  if (matches.length < 5) return null;
  const hitCount = matches.filter((x) => x.tot >= line).length;
  return { hitPct: (hitCount / matches.length) * 100, sampleSize: matches.length };
}

/** Count games where quarter pts >= threshold */
export function ceilingInQuarter(
  rows: PlayerQuarterStatsRow[],
  quarter: 1 | 2 | 3 | 4,
  threshold: number
): { count: number; total: number } {
  const key = `q${quarter}_pts` as keyof PlayerQuarterStatsRow;
  const count = rows.filter((r) => (r[key] as number) >= threshold).length;
  return { count, total: rows.length };
}

/** Std dev and % within 1 of avg for a quarter */
export function varianceInQuarter(
  rows: PlayerQuarterStatsRow[],
  quarter: 1 | 2 | 3 | 4,
  avg: number
): { stdDev: number; pctWithin1: number } {
  const key = `q${quarter}_pts` as keyof PlayerQuarterStatsRow;
  const vals = rows.map((r) => r[key] as number);
  const n = vals.length;
  if (n < 5) return { stdDev: 0, pctWithin1: 0 };
  const variance =
    vals.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const within1 = vals.filter((v) => Math.abs(v - avg) <= 1).length;
  return { stdDev, pctWithin1: (within1 / n) * 100 };
}

/** % of games where quarter exceeded avg by at least delta */
export function pctExceededByGte(
  rows: PlayerQuarterStatsRow[],
  quarter: 1 | 2 | 3 | 4,
  avg: number,
  delta: number
): number {
  const key = `q${quarter}_pts` as keyof PlayerQuarterStatsRow;
  const count = rows.filter((r) => (r[key] as number) >= avg + delta).length;
  return rows.length > 0 ? (count / rows.length) * 100 : 0;
}

/** % of games where quarter was under avg by at least delta */
export function pctUnderByGte(
  rows: PlayerQuarterStatsRow[],
  quarter: 1 | 2 | 3 | 4,
  avg: number,
  delta: number
): number {
  const key = `q${quarter}_pts` as keyof PlayerQuarterStatsRow;
  const count = rows.filter((r) => (r[key] as number) <= avg - delta).length;
  return rows.length > 0 ? (count / rows.length) * 100 : 0;
}

/** Weakest and strongest quarter by avg (1-indexed) */
export function quarterPacingPattern(ctx: PlayerQuarterContext): {
  weakest: number;
  strongest: number;
  weakestAvg: number;
  strongestAvg: number;
} {
  const avgs = [ctx.avgQ1, ctx.avgQ2, ctx.avgQ3, ctx.avgQ4];
  let minI = 0;
  let maxI = 0;
  for (let i = 1; i < 4; i++) {
    if (avgs[i] < avgs[minI]) minI = i;
    if (avgs[i] > avgs[maxI]) maxI = i;
  }
  return {
    weakest: minI + 1,
    strongest: maxI + 1,
    weakestAvg: avgs[minI],
    strongestAvg: avgs[maxI],
  };
}
