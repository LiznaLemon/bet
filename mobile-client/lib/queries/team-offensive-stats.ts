import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type TeamOffensiveStats = {
  team_abbreviation: string;
  games_played: number;
  pts_avg: number;
  reb_avg: number;
  ast_avg: number;
  stl_avg: number;
  blk_avg: number;
  tov_avg: number;
  fg_pct: number | null;
  three_pt_pct: number | null;
  ft_pct: number | null;
};

function mapRpcRow(row: Record<string, unknown>): TeamOffensiveStats {
  return {
    team_abbreviation: String(row.team_abbreviation ?? ''),
    games_played: Number(row.games_played ?? 0),
    pts_avg: Number(row.pts_avg ?? 0),
    reb_avg: Number(row.reb_avg ?? 0),
    ast_avg: Number(row.ast_avg ?? 0),
    stl_avg: Number(row.stl_avg ?? 0),
    blk_avg: Number(row.blk_avg ?? 0),
    tov_avg: Number(row.tov_avg ?? 0),
    fg_pct: row.fg_pct != null ? Number(row.fg_pct) : null,
    three_pt_pct: row.three_pt_pct != null ? Number(row.three_pt_pct) : null,
    ft_pct: row.ft_pct != null ? Number(row.ft_pct) : null,
  };
}

export async function fetchTeamOffensiveStats(
  season = 2026,
  lastNGames?: number
): Promise<TeamOffensiveStats[]> {
  const rpc = lastNGames != null ? 'get_team_offensive_stats_last_n' : 'get_team_offensive_stats';
  const params =
    lastNGames != null
      ? { p_season: season, p_season_type: 2, p_limit: lastNGames }
      : { p_season: season, p_season_type: 2 };

  const { data, error } = await supabase.rpc(rpc, params);

  if (error) {
    console.error('[fetchTeamOffensiveStats] RPC error:', error.message);
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => mapRpcRow(row));
}

export function useTeamOffensiveStats(season = 2026, lastNGames?: number) {
  return useQuery({
    queryKey: ['team-offensive-stats', season, lastNGames ?? 'all'],
    queryFn: () => fetchTeamOffensiveStats(season, lastNGames),
    staleTime: 5 * 60 * 1000,
  });
}

export type TeamOffensiveStatsAllModes = {
  season: TeamOffensiveStats[];
  last10: TeamOffensiveStats[];
  last5: TeamOffensiveStats[];
};

export async function fetchTeamOffensiveStatsAllModes(
  season = 2026
): Promise<TeamOffensiveStatsAllModes> {
  const { data, error } = await supabase.rpc('get_team_offensive_stats_all_modes', {
    p_season: season,
    p_season_type: 2,
  });

  if (error) {
    console.error('[fetchTeamOffensiveStatsAllModes] RPC error:', error.message);
    throw error;
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { mode: string }>;
  const seasonRows: TeamOffensiveStats[] = [];
  const last10Rows: TeamOffensiveStats[] = [];
  const last5Rows: TeamOffensiveStats[] = [];

  for (const row of rows) {
    const mapped = mapRpcRow(row);
    if (row.mode === 'season') seasonRows.push(mapped);
    else if (row.mode === 'last_10') last10Rows.push(mapped);
    else if (row.mode === 'last_5') last5Rows.push(mapped);
  }

  return { season: seasonRows, last10: last10Rows, last5: last5Rows };
}

export function useTeamOffensiveStatsAllModes(season = 2026) {
  return useQuery({
    queryKey: ['team-offensive-stats-all-modes', season],
    queryFn: () => fetchTeamOffensiveStatsAllModes(season),
    staleTime: 5 * 60 * 1000,
  });
}

/** League-wide std dev per stat (across 30 teams). Used for significance thresholds. */
export type LeagueStatVariance = {
  pts_std: number;
  reb_std: number;
  ast_std: number;
  stl_std: number;
  blk_std: number;
  tov_std: number;
  fg_pct_std: number;
  three_pt_pct_std: number;
  ft_pct_std: number;
  pts_allowed_std: number;
  reb_allowed_std: number;
  ast_allowed_std: number;
  fg_pct_allowed_std: number;
  three_pt_pct_allowed_std: number;
  ft_pct_allowed_std: number;
};

export async function fetchLeagueStatVariance(
  season = 2026
): Promise<LeagueStatVariance | null> {
  const { data, error } = await supabase.rpc('get_league_stat_variance', {
    p_season: season,
    p_season_type: 2,
  });

  if (error) {
    console.error('[fetchLeagueStatVariance] RPC error:', error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  return {
    pts_std: Number(r.pts_std ?? 0),
    reb_std: Number(r.reb_std ?? 0),
    ast_std: Number(r.ast_std ?? 0),
    stl_std: Number(r.stl_std ?? 0),
    blk_std: Number(r.blk_std ?? 0),
    tov_std: Number(r.tov_std ?? 0),
    fg_pct_std: Number(r.fg_pct_std ?? 0),
    three_pt_pct_std: Number(r.three_pt_pct_std ?? 0),
    ft_pct_std: Number(r.ft_pct_std ?? 0),
    pts_allowed_std: Number(r.pts_allowed_std ?? 0),
    reb_allowed_std: Number(r.reb_allowed_std ?? 0),
    ast_allowed_std: Number(r.ast_allowed_std ?? 0),
    fg_pct_allowed_std: Number(r.fg_pct_allowed_std ?? 0),
    three_pt_pct_allowed_std: Number(r.three_pt_pct_allowed_std ?? 0),
    ft_pct_allowed_std: Number(r.ft_pct_allowed_std ?? 0),
  };
}

export function useLeagueStatVariance(season = 2026) {
  return useQuery({
    queryKey: ['league-stat-variance', season],
    queryFn: () => fetchLeagueStatVariance(season),
    staleTime: 5 * 60 * 1000,
  });
}
