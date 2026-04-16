/**
 * ESPN NBA API client
 * Fetches scoreboard (schedule) and game summary (PBP + boxscores) from ESPN's public API
 */

const SCOREBOARD_URL = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const SUMMARY_URL = 'http://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_BACKOFF_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

async function fetchJsonWithRetry(url, { retries = DEFAULT_RETRY_COUNT, label = 'request' } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = new Error(`${label} failed: ${res.status} ${res.statusText}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    } catch (error) {
      lastError = error;
      const canRetry = attempt <= retries && (error?.status == null || isRetryableStatus(error.status));
      if (!canRetry) break;
      const delay = DEFAULT_RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Fetch scoreboard for a given date
 * @param {string|Date} date - Date as YYYYMMDD string or Date object
 * @returns {Promise<Array>} Array of completed game objects { game_id, date, ... }
 */
export async function fetchScoreboard(date) {
  const dateStr = typeof date === 'string' ? normalizeScoreboardDate(date) : formatDateYYYYMMDD(date);
  const url = `${SCOREBOARD_URL}?limit=1000&dates=${dateStr}`;

  const data = await fetchJsonWithRetry(url, { label: 'ESPN scoreboard' });
  const events = data.events || [];

  return events
    .filter((e) => {
      const status = e.status?.type;
      return status?.name === 'STATUS_FINAL' || status?.completed === true;
    })
    .map((e) => mapScoreboardEvent(e, dateStr));
}

/**
 * All games on the scoreboard for a date (final, in progress, scheduled).
 * Use this when you also need schedule/status updates before the game is final.
 *
 * @param {string|Date} date - YYYYMMDD or Date
 * @returns {Promise<Array>} Scoreboard events with game_id and date
 */
export async function fetchScoreboardAllEvents(date) {
  const dateStr = typeof date === 'string' ? normalizeScoreboardDate(date) : formatDateYYYYMMDD(date);
  const url = `${SCOREBOARD_URL}?limit=1000&dates=${dateStr}`;

  const data = await fetchJsonWithRetry(url, { label: 'ESPN scoreboard' });
  const events = data.events || [];

  return events.map((e) => mapScoreboardEvent(e, dateStr));
}

function mapScoreboardEvent(e, dateStr) {
  return {
    ...e,
    game_id: parseInt(e.id, 10),
    date: dateStr,
  };
}

/** Accept YYYYMMDD or YYYY-MM-DD */
function normalizeScoreboardDate(s) {
  if (/^\d{8}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '');
  return s;
}

/**
 * Fetch full game summary (PBP + team box + player box)
 * @param {number} gameId - ESPN game ID
 * @returns {Promise<Object>} Raw JSON from ESPN summary endpoint
 */
export async function fetchGameSummary(gameId) {
  const url = `${SUMMARY_URL}?event=${gameId}`;
  return fetchJsonWithRetry(url, { label: `ESPN summary for game ${gameId}` });
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
