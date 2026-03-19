import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/lib/types';
import { getAbbrevAliases } from '@/lib/utils/team-abbreviation';

const FETCH_TIMEOUT_MS = 15000;

export async function fetchPlayersForTeams(
  season: number,
  teamAbbrevs: string[]
): Promise<Player[]> {
  const teams = teamAbbrevs
    .filter(Boolean)
    .flatMap((t) => getAbbrevAliases(t.toUpperCase().trim()));
  if (teams.length === 0) return [];

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out. Check your network connection.')), FETCH_TIMEOUT_MS);
  });

  const fetchPromise = (async () => {
    const { data, error } = await supabase.rpc('get_players_enhanced_for_teams', {
      p_season: season,
      p_season_type: 2,
      p_team_abbrevs: teams,
    });

    if (error) {
      console.error('[fetchPlayersForTeams] Supabase RPC error:', error.message, error.details, error.hint);
      throw new Error(error.message || 'Failed to load players');
    }

    return (data ?? []) as Player[];
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

export function usePlayersForTeams(
  awayTeamAbbrev: string | undefined,
  homeTeamAbbrev: string | undefined,
  season = 2026
) {
  const teams = [awayTeamAbbrev, homeTeamAbbrev].filter(Boolean) as string[];
  const enabled = teams.length >= 2;

  return useQuery({
    queryKey: ['players-for-teams', season, ...teams.sort()],
    queryFn: () => fetchPlayersForTeams(season, teams),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
