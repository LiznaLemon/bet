import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ScheduleGame } from '@/lib/types';
import { getAbbrevAliases, toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';

const EXCLUDED_GAME_IDS = ['401809839', '401838140', '401838141', '401838142', '401838143'];

function extractGameTime(shortDetail: string | null): string | null {
  if (!shortDetail) return null;
  const parts = String(shortDetail).split(' - ');
  return parts.length > 1 ? parts[1].trim() : shortDetail;
}

function mapRowToScheduleGame(row: Record<string, unknown>): ScheduleGame {
  const shortDetail = (row.status_type_short_detail as string) ?? null;
  return {
    id: String(row.game_id ?? ''),
    gameId: String(row.game_id ?? ''),
    gameDate: row.game_date ? new Date(row.game_date as string).toISOString().slice(0, 10) : null,
    gameDateTime: row.game_date_time ? new Date(row.game_date_time as string).toISOString() : null,
    gameTime: extractGameTime(shortDetail),
    homeTeam: (row.home_display_name as string) ?? '',
    awayTeam: (row.away_display_name as string) ?? '',
    homeTeamAbbrev: toThreeLetterAbbrev((row.home_abbreviation as string) ?? '') || ((row.home_abbreviation as string) ?? ''),
    awayTeamAbbrev: toThreeLetterAbbrev((row.away_abbreviation as string) ?? '') || ((row.away_abbreviation as string) ?? ''),
    venue: (row.venue_full_name as string) ?? null,
    timeDisplay: shortDetail,
    homeScore: row.home_score != null ? Number(row.home_score) : null,
    awayScore: row.away_score != null ? Number(row.away_score) : null,
    completed: Boolean(row.status_type_completed),
  };
}

async function fetchSchedule(season: number): Promise<ScheduleGame[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select(
      'game_id, game_date, game_date_time, home_abbreviation, away_abbreviation, home_display_name, away_display_name, venue_full_name, status_type_short_detail, status_type_completed, home_score, away_score'
    )
    .eq('season', season)
    .eq('season_type', 2)
    .not('home_abbreviation', 'is', null)
    .neq('home_abbreviation', 'TBD')
    .order('game_date', { ascending: true })
    .order('game_date_time', { ascending: true });

  if (error) throw error;

  // Filter out excluded game IDs (Supabase doesn't support NOT IN with array easily)
  const filtered = (data ?? []).filter(
    (row) => !EXCLUDED_GAME_IDS.includes(String(row.game_id))
  );

  return filtered.map(mapRowToScheduleGame);
}

export function useSchedule(season = 2026) {
  return useQuery({
    queryKey: ['schedule', season],
    queryFn: () => fetchSchedule(season),
    staleTime: 5 * 60 * 1000,
  });
}

export async function fetchGameById(gameId: string, season = 2026): Promise<ScheduleGame | null> {
  const { data, error } = await supabase
    .from('schedules')
    .select(
      'game_id, game_date, game_date_time, home_abbreviation, away_abbreviation, home_display_name, away_display_name, venue_full_name, status_type_short_detail, status_type_completed, home_score, away_score'
    )
    .eq('game_id', gameId)
    .eq('season', season)
    .eq('season_type', 2)
    .maybeSingle();

  if (error) throw error;
  if (!data || EXCLUDED_GAME_IDS.includes(String(data.game_id))) return null;

  return mapRowToScheduleGame(data as Record<string, unknown>);
}

export function useGame(gameId: string | undefined, season = 2026) {
  return useQuery({
    queryKey: ['game', gameId, season],
    queryFn: () => fetchGameById(gameId!, season),
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches completed games this season between the two teams (either home/away order). Excludes excludeGameId. */
export async function fetchPreviousMatchups(
  homeAbbrev: string,
  awayAbbrev: string,
  season = 2026,
  excludeGameId?: string
): Promise<ScheduleGame[]> {
  const home = (homeAbbrev ?? '').trim();
  const away = (awayAbbrev ?? '').trim();
  if (!home || !away) return [];

  const { data, error } = await supabase
    .from('schedules')
    .select(
      'game_id, game_date, game_date_time, home_abbreviation, away_abbreviation, home_display_name, away_display_name, venue_full_name, status_type_short_detail, status_type_completed, home_score, away_score'
    )
    .eq('season', season)
    .eq('season_type', 2)
    .eq('status_type_completed', true)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('game_date', { ascending: false });

  if (error) throw error;

  const homeAliases = getAbbrevAliases(home);
  const awayAliases = getAbbrevAliases(away);
  const exclude = excludeGameId ? String(excludeGameId) : null;

  const filtered = (data ?? []).filter((row) => {
    if (EXCLUDED_GAME_IDS.includes(String(row.game_id))) return false;
    if (exclude && String(row.game_id) === exclude) return false;
    const h = String(row.home_abbreviation ?? '').toUpperCase();
    const a = String(row.away_abbreviation ?? '').toUpperCase();
    const homeMatch = homeAliases.includes(h);
    const awayMatch = awayAliases.includes(a);
    const swappedHomeMatch = awayAliases.includes(h);
    const swappedAwayMatch = homeAliases.includes(a);
    return (homeMatch && awayMatch) || (swappedHomeMatch && swappedAwayMatch);
  });

  return filtered.map((row) => mapRowToScheduleGame(row as Record<string, unknown>));
}

export function usePreviousMatchups(
  homeAbbrev: string | undefined,
  awayAbbrev: string | undefined,
  season = 2026,
  excludeGameId?: string
) {
  return useQuery({
    queryKey: ['previous-matchups', homeAbbrev, awayAbbrev, season, excludeGameId],
    queryFn: () => fetchPreviousMatchups(homeAbbrev!, awayAbbrev!, season, excludeGameId),
    enabled: !!(homeAbbrev && awayAbbrev),
    staleTime: 5 * 60 * 1000,
  });
}

export type TeamRecentResult = 'W' | 'L';

export type TeamRecentResults = {
  wins: number;
  losses: number;
  results: TeamRecentResult[];
};

/** Fetches team's last N completed games with W/L results. */
export async function fetchTeamRecentResults(
  teamAbbrev: string,
  season = 2026,
  limit = 5
): Promise<TeamRecentResults> {
  const team = (teamAbbrev ?? '').trim();
  if (!team) return { wins: 0, losses: 0, results: [] };
  const aliases = getAbbrevAliases(team);
  const orClause = aliases
    .flatMap((a) => [`home_abbreviation.eq.${a}`, `away_abbreviation.eq.${a}`])
    .join(',');

  const { data, error } = await supabase
    .from('schedules')
    .select('game_id, game_date, home_abbreviation, away_abbreviation, home_score, away_score')
    .eq('season', season)
    .eq('season_type', 2)
    .eq('status_type_completed', true)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .or(orClause)
    .order('game_date', { ascending: false })
    .order('game_id', { ascending: false })
    .limit(limit + 10);

  if (error) throw error;

  const results: TeamRecentResult[] = [];
  const seen = new Set<string>();

  const sorted = (data ?? []).slice().sort((a, b) => {
    const dateA = String(a.game_date ?? '');
    const dateB = String(b.game_date ?? '');
    const cmp = dateB.localeCompare(dateA);
    if (cmp !== 0) return cmp;
    return String(b.game_id ?? '').localeCompare(String(a.game_id ?? ''));
  });

  for (const row of sorted) {
    if (EXCLUDED_GAME_IDS.includes(String(row.game_id))) continue;
    if (seen.has(String(row.game_id))) continue;
    seen.add(String(row.game_id));
    const h = String(row.home_abbreviation ?? '').toUpperCase();
    const a = String(row.away_abbreviation ?? '').toUpperCase();
    const homeScore = Number(row.home_score ?? 0);
    const awayScore = Number(row.away_score ?? 0);
    const isHome = aliases.includes(h);
    const won = isHome ? homeScore > awayScore : awayScore > homeScore;
    results.push(won ? 'W' : 'L');
    if (results.length >= limit) break;
  }

  const wins = results.filter((r) => r === 'W').length;
  const losses = results.filter((r) => r === 'L').length;
  return { wins, losses, results };
}

export function useTeamRecentResults(teamAbbrev: string | undefined, season = 2026, limit = 5) {
  return useQuery({
    queryKey: ['team-recent-results', teamAbbrev, season, limit],
    queryFn: () => fetchTeamRecentResults(teamAbbrev!, season, limit),
    enabled: !!teamAbbrev,
    staleTime: 5 * 60 * 1000,
  });
}
