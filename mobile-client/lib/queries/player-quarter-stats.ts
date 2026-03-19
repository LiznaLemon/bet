import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type PlayerQuarterStatsRow = {
  game_id: string;
  q1_pts: number;
  q2_pts: number;
  q3_pts: number;
  q4_pts: number;
  second_half_pts: number;
  q1_reb: number;
  q2_reb: number;
  q3_reb: number;
  q4_reb: number;
  q1_ast: number;
  q2_ast: number;
  q3_ast: number;
  q4_ast: number;
  q1_tov: number;
  q2_tov: number;
  q3_tov: number;
  q4_tov: number;
  q1_stl: number;
  q2_stl: number;
  q3_stl: number;
  q4_stl: number;
  q1_blk: number;
  q2_blk: number;
  q3_blk: number;
  q4_blk: number;
  q1_pf: number;
  q2_pf: number;
  q3_pf: number;
  q4_pf: number;
  q1_3pt?: number;
  q2_3pt?: number;
  q3_3pt?: number;
  q4_3pt?: number;
  q1_2pt?: number;
  q2_2pt?: number;
  q3_2pt?: number;
  q4_2pt?: number;
  q1_ft?: number;
  q2_ft?: number;
  q3_ft?: number;
  q4_ft?: number;
};

export type QuarterOverUnderRates = {
  exceedPct: number;
  underPct: number;
};

/** Per-quarter averages for a stat (e.g. points, rebounds) */
export type QuarterAvgs = {
  avgQ1: number;
  avgQ2: number;
  avgQ3: number;
  avgQ4: number;
};

/** Stats that have per-quarter averages from play-by-play */
export type QuarterAvgsStatKey =
  | 'points'
  | 'rebounds'
  | 'assists'
  | 'turnovers'
  | 'steals'
  | 'blocks'
  | 'fouls'
  | 'three_pt_made'
  | 'two_pt_made'
  | 'free_throws_made';

export type PlayerQuarterContext = {
  maxSecondHalf: number;
  avgSecondHalf: number;
  gamesWithSecondHalfData: number;
  avgQ1: number;
  avgQ2: number;
  avgQ3: number;
  avgQ4: number;
  /** Per-stat quarter averages (points, rebounds, assists, etc.) */
  quarterAvgsByStat: {
    points: QuarterAvgs;
    rebounds: QuarterAvgs;
    assists: QuarterAvgs;
    turnovers: QuarterAvgs;
    steals: QuarterAvgs;
    blocks: QuarterAvgs;
    fouls: QuarterAvgs;
    three_pt_made: QuarterAvgs;
    two_pt_made: QuarterAvgs;
    free_throws_made: QuarterAvgs;
  };
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
  limit = 50,
  asOfDate?: string | null
): Promise<PlayerQuarterStatsRow[]> {
  const { data, error } = await supabase.rpc('get_player_quarter_stats', {
    p_athlete_id: athleteId,
    p_season: season,
    p_season_type: 2,
    p_limit: limit,
    p_as_of_date: asOfDate ?? null,
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

function avgFromRows(rows: PlayerQuarterStatsRow[], q1: keyof PlayerQuarterStatsRow, q2: keyof PlayerQuarterStatsRow, q3: keyof PlayerQuarterStatsRow, q4: keyof PlayerQuarterStatsRow): QuarterAvgs {
  const n = rows.length;
  if (n === 0) return { avgQ1: 0, avgQ2: 0, avgQ3: 0, avgQ4: 0 };
  return {
    avgQ1: rows.reduce((s, r) => s + ((r[q1] as number) ?? 0), 0) / n,
    avgQ2: rows.reduce((s, r) => s + ((r[q2] as number) ?? 0), 0) / n,
    avgQ3: rows.reduce((s, r) => s + ((r[q3] as number) ?? 0), 0) / n,
    avgQ4: rows.reduce((s, r) => s + ((r[q4] as number) ?? 0), 0) / n,
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

  const quarterAvgsByStat = {
    points: avgFromRows(rows, 'q1_pts', 'q2_pts', 'q3_pts', 'q4_pts'),
    rebounds: avgFromRows(rows, 'q1_reb', 'q2_reb', 'q3_reb', 'q4_reb'),
    assists: avgFromRows(rows, 'q1_ast', 'q2_ast', 'q3_ast', 'q4_ast'),
    turnovers: avgFromRows(rows, 'q1_tov', 'q2_tov', 'q3_tov', 'q4_tov'),
    steals: avgFromRows(rows, 'q1_stl', 'q2_stl', 'q3_stl', 'q4_stl'),
    blocks: avgFromRows(rows, 'q1_blk', 'q2_blk', 'q3_blk', 'q4_blk'),
    fouls: avgFromRows(rows, 'q1_pf', 'q2_pf', 'q3_pf', 'q4_pf'),
    three_pt_made: avgFromRows(
      rows,
      'q1_3pt' as keyof PlayerQuarterStatsRow,
      'q2_3pt' as keyof PlayerQuarterStatsRow,
      'q3_3pt' as keyof PlayerQuarterStatsRow,
      'q4_3pt' as keyof PlayerQuarterStatsRow
    ),
    two_pt_made: avgFromRows(
      rows,
      'q1_2pt' as keyof PlayerQuarterStatsRow,
      'q2_2pt' as keyof PlayerQuarterStatsRow,
      'q3_2pt' as keyof PlayerQuarterStatsRow,
      'q4_2pt' as keyof PlayerQuarterStatsRow
    ),
    free_throws_made: avgFromRows(
      rows,
      'q1_ft' as keyof PlayerQuarterStatsRow,
      'q2_ft' as keyof PlayerQuarterStatsRow,
      'q3_ft' as keyof PlayerQuarterStatsRow,
      'q4_ft' as keyof PlayerQuarterStatsRow
    ),
  };

  return {
    maxSecondHalf,
    avgSecondHalf,
    gamesWithSecondHalfData: rows.length,
    avgQ1,
    avgQ2,
    avgQ3,
    avgQ4,
    quarterAvgsByStat,
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
  season = 2026,
  asOfDate?: string | null
) {
  return useQuery({
    queryKey: ['player-quarter-stats', athleteId, season, asOfDate ?? ''],
    queryFn: () => fetchPlayerQuarterStats(athleteId!, season, 50, asOfDate ?? undefined),
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

/** Max stat produced in remaining quarters across all games. quartersLeft: 1=Q4 only, 2=Q3+Q4, 3=Q2+Q3+Q4, 4=full game */
export function maxStatWithQuartersLeft(
  rows: PlayerQuarterStatsRow[],
  stat: 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'turnovers' | 'fouls',
  quartersLeft: number
): number | null {
  if (rows.length === 0 || quartersLeft < 1 || quartersLeft > 4) return null;

  const suffix =
    stat === 'points'
      ? 'pts'
      : stat === 'rebounds'
        ? 'reb'
        : stat === 'assists'
          ? 'ast'
          : stat === 'steals'
            ? 'stl'
            : stat === 'blocks'
              ? 'blk'
              : stat === 'turnovers'
                ? 'tov'
                : 'pf';

  const getVal = (r: PlayerQuarterStatsRow, q: 1 | 2 | 3 | 4) =>
    (r[`q${q}_${suffix}` as keyof PlayerQuarterStatsRow] as number) ?? 0;

  const sums = rows.map((r) => {
    if (quartersLeft === 1) return getVal(r, 4);
    if (quartersLeft === 2) return stat === 'points' ? r.second_half_pts : getVal(r, 3) + getVal(r, 4);
    if (quartersLeft === 3) return getVal(r, 2) + getVal(r, 3) + getVal(r, 4);
    return getVal(r, 1) + getVal(r, 2) + getVal(r, 3) + getVal(r, 4);
  });

  return Math.max(...sums);
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
