import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getAbbrevAliases } from '@/lib/utils/team-abbreviation';

const EXCLUDED_GAME_IDS = ['401809839', '401838140', '401838141', '401838142', '401838143'];

/** Fetches athlete_ids who played in the team's last N games. */
export async function fetchTeamActivePlayerIds(
  teamAbbrev: string,
  season = 2026,
  lastNGames = 5
): Promise<Set<string>> {
  const team = (teamAbbrev ?? '').trim();
  if (!team) return new Set();

  const aliases = getAbbrevAliases(team);

  const { data: rows, error } = await supabase
    .from('player_boxscores_raw')
    .select('game_id, game_date, athlete_id')
    .in('team_abbreviation', aliases)
    .eq('season', season)
    .eq('season_type', 2)
    .or('did_not_play.is.null,did_not_play.eq.false')
    .order('game_date', { ascending: false })
    .limit(200);

  if (error) throw error;

  const gameDates: { gameId: string; date: string }[] = [];
  const seenGames = new Set<string>();

  for (const row of rows ?? []) {
    const gid = String(row.game_id ?? '');
    if (EXCLUDED_GAME_IDS.includes(gid)) continue;
    if (!seenGames.has(gid)) {
      seenGames.add(gid);
      gameDates.push({ gameId: gid, date: String(row.game_date ?? '') });
    }
  }

  gameDates.sort((a, b) => (a.date > b.date ? -1 : 1));
  const lastNGameIds = new Set(gameDates.slice(0, lastNGames).map((g) => g.gameId));

  const activeIds = new Set<string>();
  for (const row of rows ?? []) {
    const gid = String(row.game_id ?? '');
    if (lastNGameIds.has(gid)) {
      activeIds.add(String(row.athlete_id ?? ''));
    }
  }

  return activeIds;
}

export function useTeamActivePlayerIds(
  teamAbbrev: string | undefined,
  season = 2026,
  lastNGames = 5
) {
  return useQuery({
    queryKey: ['team-active-player-ids', teamAbbrev, season, lastNGames],
    queryFn: () => fetchTeamActivePlayerIds(teamAbbrev!, season, lastNGames),
    enabled: !!teamAbbrev,
    staleTime: 5 * 60 * 1000,
  });
}
