import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type TeamDefensiveStats = {
  team_abbreviation: string;
  games_played: number;
  pts_allowed_avg: number;
  reb_allowed_avg: number;
  ast_allowed_avg: number;
  fg_pct_allowed: number | null;
  three_pt_pct_allowed: number | null;
  ft_pct_allowed: number | null;
  pts_allowed_rank: number;
  reb_allowed_rank: number;
  ast_allowed_rank: number;
};

export async function fetchTeamDefensiveStats(
  season = 2026
): Promise<TeamDefensiveStats[]> {
  const { data, error } = await supabase.rpc('get_team_defensive_stats', {
    p_season: season,
    p_season_type: 2,
  });

  if (error) {
    console.error('[fetchTeamDefensiveStats] RPC error:', error.message);
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    team_abbreviation: String(row.team_abbreviation ?? ''),
    games_played: Number(row.games_played ?? 0),
    pts_allowed_avg: Number(row.pts_allowed_avg ?? 0),
    reb_allowed_avg: Number(row.reb_allowed_avg ?? 0),
    ast_allowed_avg: Number(row.ast_allowed_avg ?? 0),
    fg_pct_allowed: row.fg_pct_allowed != null ? Number(row.fg_pct_allowed) : null,
    three_pt_pct_allowed:
      row.three_pt_pct_allowed != null ? Number(row.three_pt_pct_allowed) : null,
    ft_pct_allowed: row.ft_pct_allowed != null ? Number(row.ft_pct_allowed) : null,
    pts_allowed_rank: Number(row.pts_allowed_rank ?? 0),
    reb_allowed_rank: Number(row.reb_allowed_rank ?? 0),
    ast_allowed_rank: Number(row.ast_allowed_rank ?? 0),
  }));
}

export function useTeamDefensiveStats(season = 2026) {
  return useQuery({
    queryKey: ['team-defensive-stats', season],
    queryFn: () => fetchTeamDefensiveStats(season),
    staleTime: 5 * 60 * 1000,
  });
}

export type TeamDefensiveStatsAllModes = {
  season: TeamDefensiveStats[];
  last10: TeamDefensiveStats[];
  last5: TeamDefensiveStats[];
};

function mapDefensiveRow(row: Record<string, unknown>): TeamDefensiveStats {
  return {
    team_abbreviation: String(row.team_abbreviation ?? ''),
    games_played: Number(row.games_played ?? 0),
    pts_allowed_avg: Number(row.pts_allowed_avg ?? 0),
    reb_allowed_avg: Number(row.reb_allowed_avg ?? 0),
    ast_allowed_avg: Number(row.ast_allowed_avg ?? 0),
    fg_pct_allowed: row.fg_pct_allowed != null ? Number(row.fg_pct_allowed) : null,
    three_pt_pct_allowed:
      row.three_pt_pct_allowed != null ? Number(row.three_pt_pct_allowed) : null,
    ft_pct_allowed: row.ft_pct_allowed != null ? Number(row.ft_pct_allowed) : null,
    pts_allowed_rank: Number(row.pts_allowed_rank ?? 0),
    reb_allowed_rank: Number(row.reb_allowed_rank ?? 0),
    ast_allowed_rank: Number(row.ast_allowed_rank ?? 0),
  };
}

export async function fetchTeamDefensiveStatsAllModes(
  season = 2026
): Promise<TeamDefensiveStatsAllModes> {
  const { data, error } = await supabase.rpc('get_team_defensive_stats_all_modes', {
    p_season: season,
    p_season_type: 2,
  });

  if (error) {
    console.error('[fetchTeamDefensiveStatsAllModes] RPC error:', error.message);
    throw error;
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { mode: string }>;
  const seasonRows: TeamDefensiveStats[] = [];
  const last10Rows: TeamDefensiveStats[] = [];
  const last5Rows: TeamDefensiveStats[] = [];

  for (const row of rows) {
    const mapped = mapDefensiveRow(row);
    if (row.mode === 'season') seasonRows.push(mapped);
    else if (row.mode === 'last_10') last10Rows.push(mapped);
    else if (row.mode === 'last_5') last5Rows.push(mapped);
  }

  return { season: seasonRows, last10: last10Rows, last5: last5Rows };
}

export function useTeamDefensiveStatsAllModes(season = 2026) {
  return useQuery({
    queryKey: ['team-defensive-stats-all-modes', season],
    queryFn: () => fetchTeamDefensiveStatsAllModes(season),
    staleTime: 5 * 60 * 1000,
  });
}
