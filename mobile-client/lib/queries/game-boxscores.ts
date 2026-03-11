import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const EXCLUDED_GAME_IDS = ['401809839', '401838140', '401838141', '401838142', '401838143'];

export type GameBoxScore = {
  athlete_id: string;
  athlete_display_name: string;
  athlete_headshot_href: string;
  athlete_position_abbreviation: string;
  team_abbreviation: string;
  team_color: string | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  minutes: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_point_made: number;
  three_point_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  turnovers: number;
  fouls: number;
  plus_minus: number;
};

function mapRowToBoxScore(row: Record<string, unknown>): GameBoxScore {
  return {
    athlete_id: String(row.athlete_id ?? ''),
    athlete_display_name: (row.athlete_display_name as string) ?? '',
    athlete_headshot_href: (row.athlete_headshot_href as string) ?? '',
    athlete_position_abbreviation: (row.athlete_position_abbreviation as string) ?? '',
    team_abbreviation: (row.team_abbreviation as string) ?? '',
    team_color: row.team_color != null ? String(row.team_color).replace(/^#/, '') : null,
    points: Number(row.points ?? 0),
    rebounds: Number(row.rebounds ?? 0),
    assists: Number(row.assists ?? 0),
    steals: Number(row.steals ?? 0),
    blocks: Number(row.blocks ?? 0),
    minutes: Number(row.minutes ?? 0),
    field_goals_made: Number(row.field_goals_made ?? 0),
    field_goals_attempted: Number(row.field_goals_attempted ?? 0),
    three_point_made: Number(row.three_point_field_goals_made ?? 0),
    three_point_attempted: Number(row.three_point_field_goals_attempted ?? 0),
    free_throws_made: Number(row.free_throws_made ?? 0),
    free_throws_attempted: Number(row.free_throws_attempted ?? 0),
    turnovers: Number(row.turnovers ?? 0),
    fouls: Number(row.fouls ?? 0),
    plus_minus: Number(row.plus_minus ?? 0),
  };
}

export async function fetchGameBoxScores(
  gameId: string,
  season = 2026
): Promise<GameBoxScore[]> {
  if (EXCLUDED_GAME_IDS.includes(gameId)) return [];

  const { data, error } = await supabase
    .from('player_boxscores_raw')
    .select(
      'athlete_id, athlete_display_name, athlete_headshot_href, athlete_position_abbreviation, team_abbreviation, team_color, points, rebounds, assists, steals, blocks, minutes, field_goals_made, field_goals_attempted, three_point_field_goals_made, three_point_field_goals_attempted, free_throws_made, free_throws_attempted, turnovers, fouls, plus_minus'
    )
    .eq('game_id', gameId)
    .eq('season', season)
    .eq('season_type', 2)
    .order('points', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapRowToBoxScore(row as Record<string, unknown>));
}

export function useGameBoxScores(gameId: string | undefined, season = 2026) {
  return useQuery({
    queryKey: ['game-boxscores', gameId, season],
    queryFn: () => fetchGameBoxScores(gameId!, season),
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}
