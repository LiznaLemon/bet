import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const EXCLUDED_GAME_IDS = ['401809839', '401838140', '401838141', '401838142', '401838143'];

export type PlayByPlayRecord = {
  id: number;
  sequence_number: string | null;
  type_text: string;
  period_number: number;
  clock_display_value: string | null;
  start_quarter_seconds_remaining: number | null;
  start_game_seconds_remaining: number | null;
  game_play_number: number | null;
  scoring_play: boolean;
  score_value: number;
  athlete_id_1: number | null;
  athlete_id_2: number | null;
  athlete_id_3: number | null;
  shooting_play: boolean;
  points_attempted: number | null;
};

function mapRowToPlay(row: Record<string, unknown>): PlayByPlayRecord {
  return {
    id: Number(row.id ?? 0),
    sequence_number: row.sequence_number != null ? String(row.sequence_number) : null,
    type_text: String(row.type_text ?? ''),
    period_number: Number(row.period_number ?? row.period ?? row.qtr ?? 1),
    clock_display_value: row.clock_display_value != null ? String(row.clock_display_value) : null,
    start_quarter_seconds_remaining:
      row.start_quarter_seconds_remaining != null
        ? Number(row.start_quarter_seconds_remaining)
        : null,
    start_game_seconds_remaining:
      row.start_game_seconds_remaining != null ? Number(row.start_game_seconds_remaining) : null,
    game_play_number: row.game_play_number != null ? Number(row.game_play_number) : null,
    scoring_play: Boolean(row.scoring_play),
    score_value: Number(row.score_value ?? 0),
    athlete_id_1: row.athlete_id_1 != null ? Number(row.athlete_id_1) : null,
    athlete_id_2: row.athlete_id_2 != null ? Number(row.athlete_id_2) : null,
    athlete_id_3: row.athlete_id_3 != null ? Number(row.athlete_id_3) : null,
    shooting_play: Boolean(row.shooting_play),
    points_attempted: row.points_attempted != null ? Number(row.points_attempted) : null,
  };
}

/**
 * Fetches play-by-play for a game, ordered chronologically (start of Q1 → end of Q4).
 * Uses period_number, start_quarter_seconds_remaining (720 = start of period), game_play_number.
 */
export async function fetchPlayByPlay(
  gameId: string,
  season = 2026
): Promise<PlayByPlayRecord[]> {
  if (EXCLUDED_GAME_IDS.includes(gameId)) return [];

  const { data, error } = await supabase
    .from('play_by_play_raw')
    .select(
      'id, sequence_number, type_text, period_number, period, qtr, clock_display_value, start_quarter_seconds_remaining, start_game_seconds_remaining, game_play_number, scoring_play, score_value, athlete_id_1, athlete_id_2, athlete_id_3, shooting_play, points_attempted'
    )
    .eq('game_id', gameId)
    .eq('season', season)
    .eq('season_type', 2)
    .order('game_play_number', { ascending: true });

  if (error) {
    console.error('[fetchPlayByPlay] RPC error:', error.message);
    throw error;
  }

  return (data ?? []).map((row) => mapRowToPlay(row as Record<string, unknown>));
}

export function usePlayByPlay(gameId: string | undefined, season = 2026) {
  return useQuery({
    queryKey: ['play-by-play', gameId, season],
    queryFn: () => fetchPlayByPlay(gameId!, season),
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}
