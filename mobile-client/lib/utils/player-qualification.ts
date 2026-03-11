import type { Player } from '@/lib/types';
import type { ScheduleGame } from '@/lib/types';

/** Category-specific minimums per NBA leaderboard rules */
const MIN_FIELD_GOALS_MADE = 300;
const MIN_FREE_THROWS_MADE = 125;
const MIN_THREE_POINT_MADE = 82;
const TEAM_GAMES_PCT = 0.7;

/** Compute games played per team from schedule */
export function getTeamGamesByAbbrev(schedule: ScheduleGame[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of schedule) {
    const home = (g.homeTeamAbbrev ?? '').toUpperCase().trim();
    const away = (g.awayTeamAbbrev ?? '').toUpperCase().trim();
    if (home) counts[home] = (counts[home] ?? 0) + 1;
    if (away) counts[away] = (counts[away] ?? 0) + 1;
  }
  return counts;
}

/** Check if player qualifies for the given sort category */
export function qualifiesForCategory(
  player: Player,
  sortBy: string,
  teamGamesByAbbrev: Record<string, number>
): boolean {
  const teamAbbrev = (player.team_abbreviation ?? '').toUpperCase().trim();
  const teamGames = teamGamesByAbbrev[teamAbbrev] ?? 82; // fallback to full season
  const minTeamGames = Math.ceil(teamGames * TEAM_GAMES_PCT);
  const gp = player.games_played ?? 0;

  switch (sortBy) {
    case 'ppg':
      return (player.total_field_goals_made ?? 0) >= MIN_FIELD_GOALS_MADE;
    case 'rpg':
      return gp >= minTeamGames;
    case 'apg':
      return gp >= minTeamGames;
    case '3pm':
      return (player.total_three_point_made ?? 0) >= MIN_THREE_POINT_MADE;
    case 'spg':
      return gp >= minTeamGames;
    case 'bpg':
      return gp >= minTeamGames;
    default:
      return true;
  }
}
