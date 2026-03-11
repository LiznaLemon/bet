import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TeamRecentResult, TeamRecentResults } from '@/lib/queries/schedule';

export type TeamMatchupContext = {
  awayRecentResults: TeamRecentResults;
  homeRecentResults: TeamRecentResults;
  activeAwayIds: Set<string>;
  activeHomeIds: Set<string>;
};

function parseRecentResults(json: unknown): TeamRecentResults {
  if (!json || typeof json !== 'object') return { wins: 0, losses: 0, results: [] };
  const o = json as Record<string, unknown>;
  const wins = Number(o.wins ?? 0);
  const losses = Number(o.losses ?? 0);
  const results = Array.isArray(o.results)
    ? (o.results as string[]).filter((r) => r === 'W' || r === 'L') as TeamRecentResult[]
    : [];
  return { wins, losses, results };
}

export async function fetchTeamMatchupContext(
  awayAbbrev: string,
  homeAbbrev: string,
  season = 2026,
  limit = 5
): Promise<TeamMatchupContext> {
  const away = (awayAbbrev ?? '').trim();
  const home = (homeAbbrev ?? '').trim();
  if (!away || !home) {
    return {
      awayRecentResults: { wins: 0, losses: 0, results: [] },
      homeRecentResults: { wins: 0, losses: 0, results: [] },
      activeAwayIds: new Set(),
      activeHomeIds: new Set(),
    };
  }

  const { data, error } = await supabase.rpc('get_team_matchup_context', {
    p_away_abbrev: away,
    p_home_abbrev: home,
    p_season: season,
    p_limit: limit,
  });

  if (error) {
    console.error('[fetchTeamMatchupContext] RPC error:', error.message);
    throw error;
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) {
    return {
      awayRecentResults: { wins: 0, losses: 0, results: [] },
      homeRecentResults: { wins: 0, losses: 0, results: [] },
      activeAwayIds: new Set(),
      activeHomeIds: new Set(),
    };
  }

  return {
    awayRecentResults: parseRecentResults(row.away_recent_results),
    homeRecentResults: parseRecentResults(row.home_recent_results),
    activeAwayIds: new Set((row.active_away_ids ?? []) as string[]),
    activeHomeIds: new Set((row.active_home_ids ?? []) as string[]),
  };
}

export function useTeamMatchupContext(
  awayAbbrev: string | undefined,
  homeAbbrev: string | undefined,
  season = 2026,
  limit = 5
) {
  const enabled = !!(awayAbbrev?.trim() && homeAbbrev?.trim());

  return useQuery({
    queryKey: ['team-matchup-context', awayAbbrev, homeAbbrev, season, limit],
    queryFn: () => fetchTeamMatchupContext(awayAbbrev!, homeAbbrev!, season, limit),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
