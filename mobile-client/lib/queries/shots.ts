import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ShotAttempt } from '@/lib/types';

const EXCLUDED_GAME_IDS = ['401809839', '401838140', '401838141', '401838142', '401838143'];

async function fetchShots(athleteId: string, season: number): Promise<ShotAttempt[]> {
  const athleteIdNum = parseInt(athleteId, 10);
  if (Number.isNaN(athleteIdNum)) return [];

  const { data, error } = await supabase
    .from('play_by_play_raw')
    .select('coordinate_x_raw, coordinate_y_raw, scoring_play, points_attempted, game_id, type_text')
    .eq('athlete_id_1', athleteIdNum)
    .eq('season', season)
    .eq('shooting_play', true)
    .lte('coordinate_y_raw', 42.25)
    .not('game_id', 'in', `(${EXCLUDED_GAME_IDS.join(',')})`);

  if (error) throw error;

  const filtered = (data ?? []).filter(
    (row) => !String(row.type_text ?? '').startsWith('Free Throw')
  );

  return filtered.map((row) => ({
    x: parseFloat(String(row.coordinate_x_raw ?? 0)),
    y: parseFloat(String(row.coordinate_y_raw ?? 0)),
    made: Boolean(row.scoring_play),
    pts: Number(row.points_attempted ?? 0),
  }));
}

export function useShots(athleteId: string | undefined, season = 2026) {
  return useQuery({
    queryKey: ['shots', athleteId, season],
    queryFn: () => fetchShots(athleteId!, season),
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
  });
}
