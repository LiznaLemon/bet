import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Player } from '@/lib/types';

const FETCH_TIMEOUT_MS = 15000;

export async function fetchPlayers(season: number): Promise<Player[]> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out. Check your network connection.')), FETCH_TIMEOUT_MS);
  });

  const fetchPromise = (async () => {
    const { data, error } = await supabase.rpc('get_players_enhanced', {
      p_season: season,
      p_season_type: 2,
    });

    if (error) {
      console.error('[usePlayers] Supabase RPC error:', error.message, error.details, error.hint);
      throw new Error(error.message || 'Failed to load players');
    }

    return (data ?? []) as Player[];
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

export function usePlayers(season = 2026) {
  return useQuery({
    queryKey: ['players', season],
    queryFn: () => fetchPlayers(season),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export type PlayerStatRanks = {
  athlete_id: string;
  ppg_rank: number;
  rpg_rank: number;
  apg_rank: number;
  spg_rank: number;
  bpg_rank: number;
};

export async function fetchPlayerStatRanks(
  season: number,
  athleteIds: string[]
): Promise<Record<string, PlayerStatRanks>> {
  if (athleteIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_player_stat_ranks', {
    p_season: season,
    p_season_type: 2,
    p_athlete_ids: athleteIds,
  });
  if (error) {
    console.error('[fetchPlayerStatRanks] RPC error:', error.message);
    throw error;
  }
  const rows = (data ?? []) as PlayerStatRanks[];
  return Object.fromEntries(rows.map((r) => [r.athlete_id, r]));
}

export function usePlayerStatRanks(season: number, athleteIds: string[]) {
  const ids = [...new Set(athleteIds)].filter(Boolean).sort();
  return useQuery({
    queryKey: ['player-stat-ranks', season, ids],
    queryFn: () => fetchPlayerStatRanks(season, ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
