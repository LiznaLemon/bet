import type { ScheduleGame } from '@/lib/types';
import { getAbbrevAliases } from '@/lib/utils/team-abbreviation';

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

export function daysBetween(dateStrA: string, dateStrB: string): number {
  if (!dateStrA || !dateStrB) return 0;
  const a = new Date(dateStrA + 'T12:00:00').getTime();
  const b = new Date(dateStrB + 'T12:00:00').getTime();
  return Math.round(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

export function getLocalDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns YYYY-MM-DD for a date offset from today (e.g. -7 = 7 days ago, 5 = 5 days from now). */
export function getDateStrForOffset(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the previous calendar day as YYYY-MM-DD. */
export function getPrevDayDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns true if the team played a game on the day before gameDate (i.e. they're on a back-to-back). */
export function isTeamOnBackToBack(
  teamAbbrev: string,
  gameDate: string | null,
  scheduleGames: ScheduleGame[]
): boolean {
  if (!gameDate || !scheduleGames.length) return false;
  const prevDay = getPrevDayDateStr(gameDate);
  const aliases = getAbbrevAliases(teamAbbrev).map((a) => a.toUpperCase().trim());
  return scheduleGames.some((g) => {
    if (g.gameDate !== prevDay) return false;
    const homeAbbrev = (g.homeTeamAbbrev ?? '').toUpperCase().trim();
    const awayAbbrev = (g.awayTeamAbbrev ?? '').toUpperCase().trim();
    return aliases.includes(homeAbbrev) || aliases.includes(awayAbbrev);
  });
}

/** Returns today's opponent if the team has a game today; null otherwise. */
export function getTonightOpponent(teamAbbrev: string, scheduleGames: ScheduleGame[]): string | null {
  const todayStr = getLocalDateStr();
  const teamUpper = (teamAbbrev ?? '').toUpperCase().trim();
  const isTeamInGame = (g: ScheduleGame) =>
    (g.homeTeamAbbrev ?? '').toUpperCase().trim() === teamUpper ||
    (g.awayTeamAbbrev ?? '').toUpperCase().trim() === teamUpper;
  const todaysGame = scheduleGames.find((g) => g.gameDate === todayStr && isTeamInGame(g));
  if (!todaysGame) return null;
  return (todaysGame.homeTeamAbbrev ?? '').toUpperCase().trim() === teamUpper
    ? (todaysGame.awayTeamAbbrev ?? '')
    : (todaysGame.homeTeamAbbrev ?? '');
}
