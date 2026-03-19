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

// --- Bundled matchup data (single RPC) ---

import type { TeamDefensiveStats, TeamDefensiveStatsAllModes } from '@/lib/queries/team-defensive-stats';

function mapDefensiveRow(row: Record<string, unknown>): TeamDefensiveStats {
  return {
    team_abbreviation: String(row.team_abbreviation ?? ''),
    games_played: Number(row.games_played ?? 0),
    pts_allowed_avg: Number(row.pts_allowed_avg ?? 0),
    reb_allowed_avg: Number(row.reb_allowed_avg ?? 0),
    ast_allowed_avg: Number(row.ast_allowed_avg ?? 0),
    fg_pct_allowed: row.fg_pct_allowed != null ? Number(row.fg_pct_allowed) : null,
    three_pt_pct_allowed: row.three_pt_pct_allowed != null ? Number(row.three_pt_pct_allowed) : null,
    ft_pct_allowed: row.ft_pct_allowed != null ? Number(row.ft_pct_allowed) : null,
    pts_allowed_rank: Number(row.pts_allowed_rank ?? 0),
    reb_allowed_rank: Number(row.reb_allowed_rank ?? 0),
    ast_allowed_rank: Number(row.ast_allowed_rank ?? 0),
  };
}

export type GameMatchupBundle = {
  teamOffensiveAllModes: TeamOffensiveStatsAllModes;
  teamDefensiveAllModes: TeamDefensiveStatsAllModes;
  leagueVariance: LeagueStatVariance | null;
};

export async function fetchGameMatchupBundle(season = 2026): Promise<GameMatchupBundle> {
  const { data, error } = await supabase.rpc('get_game_matchup_bundle', {
    p_season: season,
    p_season_type: 2,
  });

  if (error) throw error;

  const bundle = Array.isArray(data) ? data[0]?.bundle : (data as { bundle: Record<string, unknown> })?.bundle;
  if (!bundle) throw new Error('Empty matchup bundle');

  const offRows = (bundle.team_offensive_all_modes ?? []) as Array<Record<string, unknown> & { mode: string }>;
  const offSeason: TeamOffensiveStats[] = [];
  const offLast10: TeamOffensiveStats[] = [];
  const offLast5: TeamOffensiveStats[] = [];
  for (const row of offRows) {
    const mapped = mapRpcRow(row);
    if (row.mode === 'season') offSeason.push(mapped);
    else if (row.mode === 'last_10') offLast10.push(mapped);
    else if (row.mode === 'last_5') offLast5.push(mapped);
  }

  const defRows = (bundle.team_defensive_all_modes ?? []) as Array<Record<string, unknown> & { mode: string }>;
  const defSeason: TeamDefensiveStats[] = [];
  const defLast10: TeamDefensiveStats[] = [];
  const defLast5: TeamDefensiveStats[] = [];
  for (const row of defRows) {
    const mapped = mapDefensiveRow(row);
    if (row.mode === 'season') defSeason.push(mapped);
    else if (row.mode === 'last_10') defLast10.push(mapped);
    else if (row.mode === 'last_5') defLast5.push(mapped);
  }

  const lv = bundle.league_variance as Record<string, unknown> | null;
  const leagueVariance = lv
    ? {
        pts_std: Number(lv.pts_std ?? 0),
        reb_std: Number(lv.reb_std ?? 0),
        ast_std: Number(lv.ast_std ?? 0),
        stl_std: Number(lv.stl_std ?? 0),
        blk_std: Number(lv.blk_std ?? 0),
        tov_std: Number(lv.tov_std ?? 0),
        fg_pct_std: Number(lv.fg_pct_std ?? 0),
        three_pt_pct_std: Number(lv.three_pt_pct_std ?? 0),
        ft_pct_std: Number(lv.ft_pct_std ?? 0),
        pts_allowed_std: Number(lv.pts_allowed_std ?? 0),
        reb_allowed_std: Number(lv.reb_allowed_std ?? 0),
        ast_allowed_std: Number(lv.ast_allowed_std ?? 0),
        fg_pct_allowed_std: Number(lv.fg_pct_allowed_std ?? 0),
        three_pt_pct_allowed_std: Number(lv.three_pt_pct_allowed_std ?? 0),
        ft_pct_allowed_std: Number(lv.ft_pct_allowed_std ?? 0),
      }
    : null;

  return {
    teamOffensiveAllModes: { season: offSeason, last10: offLast10, last5: offLast5 },
    teamDefensiveAllModes: { season: defSeason, last10: defLast10, last5: defLast5 },
    leagueVariance,
  };
}

export function useGameMatchupBundle(season = 2026) {
  return useQuery({
    queryKey: ['game-matchup-bundle', season],
    queryFn: () => fetchGameMatchupBundle(season),
    staleTime: 5 * 60 * 1000,
  });
}
