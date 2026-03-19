/**
 * ESPN NBA API client
 * Fetches scoreboard (schedule) and game summary (PBP + boxscores) from ESPN's public API
 */

const SCOREBOARD_URL = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const SUMMARY_URL = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';

/**
 * Fetch scoreboard for a given date
 * @param {string|Date} date - Date as YYYYMMDD string or Date object
 * @returns {Promise<Array>} Array of completed game objects { game_id, date, ... }
 */
export async function fetchScoreboard(date) {
  const dateStr = typeof date === 'string' ? date : formatDateYYYYMMDD(date);
  const url = `${SCOREBOARD_URL}?limit=1000&dates=${dateStr}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN scoreboard failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const events = data.events || [];

  return events
    .filter((e) => {
      const status = e.status?.type;
      return status?.name === 'STATUS_FINAL' || status?.completed === true;
    })
    .map((e) => ({
      game_id: parseInt(e.id, 10),
      date: dateStr,
      ...e,
    }));
}

/**
 * Fetch full game summary (PBP + team box + player box)
 * @param {number} gameId - ESPN game ID
 * @returns {Promise<Object>} Raw JSON from ESPN summary endpoint
 */
export async function fetchGameSummary(gameId) {
  const url = `${SUMMARY_URL}?event=${gameId}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN summary failed for game ${gameId}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Format Date to YYYYMMDD string
 * @param {Date} d
 * @returns {string}
 */
function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
