import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type LeagueQuarterContext = {
  secondHalfP50: number;
  secondHalfP90: number;
  secondHalfP99: number;
};

export async function fetchLeagueQuarterStats(
  season = 2026
): Promise<LeagueQuarterContext> {
  const { data, error } = await supabase.rpc('get_league_second_half_percentiles', {
    p_season: season,
    p_season_type: 2,
  });

  if (error) {
    console.error('[fetchLeagueQuarterStats]', error.message);
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    secondHalfP50: Number(row?.p50 ?? 0),
    secondHalfP90: Number(row?.p90 ?? 0),
    secondHalfP99: Number(row?.p99 ?? 0),
  };
}

export function useLeagueQuarterStats(season = 2026) {
  return useQuery({
    queryKey: ['league-quarter-stats', season],
    queryFn: () => fetchLeagueQuarterStats(season),
    staleTime: 30 * 60 * 1000,
  });
}
