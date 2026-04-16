/**
 * Schedule helpers - filter schedule data from useSchedule().
 * Re-exports ScheduleGame type from lib/types for backward compatibility.
 */

import type { ScheduleGame } from '@/lib/types';

export type { ScheduleGame } from '@/lib/types';

/** Parse YYYY-MM-DD as local date (avoids UTC midnight shifting to previous day in US timezones) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Get upcoming games from schedule data (current week: next 7 days) */
export function getUpcomingGames(games: ScheduleGame[]): ScheduleGame[] {
  if (games.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  return games.filter((g) => {
    if (!g.gameDate) return true;
    const d = parseLocalDate(g.gameDate);
    return d >= today && d <= weekEnd;
  });
}

/** Get all upcoming games (no week filter) - use when week view is empty */
export function getUpcomingGamesFallback(games: ScheduleGame[]): ScheduleGame[] {
  return games;
}

/** Get games for a specific date (YYYY-MM-DD) */
export function getGamesForDate(games: ScheduleGame[], dateStr: string): ScheduleGame[] {
  if (!dateStr) return [];
  return games.filter((g) => g.gameDate === dateStr);
}

/**
 * Given a flat list of schedule games and a pivot date (YYYY-MM-DD), returns the nearest date
 * that has at least one game:
 *   1. Nearest future date with games (including pivot itself)
 *   2. If none, the most recent past date with games (end-of-season fallback)
 *   3. If none, returns null (off-season / empty dataset)
 */
export function findNearestGameDate(games: ScheduleGame[], pivotDate: string): string | null {
  const dates = [...new Set(games.map((g) => g.gameDate).filter((d): d is string => !!d))].sort();
  const future = dates.filter((d) => d >= pivotDate);
  if (future.length > 0) return future[0];
  const past = dates.filter((d) => d < pivotDate);
  if (past.length > 0) return past[past.length - 1];
  return null;
}

