import { useQuery } from '@tanstack/react-query';

const SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

type ESPNScoreboardEvent = {
  id?: string;
  competitions?: Array<{
    id?: string;
    status?: {
      period?: number;
      displayClock?: string;
      type?: {
        state?: string; // "pre" | "in" | "post"
        shortDetail?: string;
        detail?: string;
        description?: string;
      };
    };
    competitors?: Array<{
      homeAway?: string;
      team?: { abbreviation?: string };
    }>;
  }>;
};

export type ScoreboardGameInfo = {
  /** Fresh time for pre-game games, e.g. "8:00 PM EDT". Null for live/final. */
  timeOverride: string | null;
  /** For in-progress games: e.g. "Q3 · 2:45" or "Halftime". Null otherwise. */
  liveLabel: string | null;
  /** ESPN state: "pre" | "in" | "post" */
  state: string | null;
};

/** Map keyed by "AWAY@HOME" → ScoreboardGameInfo */
export type ScoreboardInfoMap = Map<string, ScoreboardGameInfo>;

function buildLiveLabel(period: number | undefined, displayClock: string | undefined, description: string | undefined): string {
  // Halftime / End of period descriptions
  if (description) {
    const lower = description.toLowerCase();
    if (lower.includes('halftime') || lower.includes('half time')) return 'Halftime';
    if (lower.includes('end of')) return description;
  }
  if (!period) return 'In Progress';
  const quarter = period <= 4 ? `Q${period}` : `OT${period - 4}`;
  return displayClock ? `${quarter} · ${displayClock}` : quarter;
}

async function fetchScoreboardInfo(dateStr: string): Promise<ScoreboardInfoMap> {
  const espnDate = dateStr.replace(/-/g, '');
  const res = await fetch(`${SCOREBOARD_URL}?dates=${espnDate}&limit=20`);
  if (!res.ok) throw new Error(`ESPN scoreboard failed: ${res.status}`);
  const json = (await res.json()) as { events?: ESPNScoreboardEvent[] };

  const map: ScoreboardInfoMap = new Map();

  for (const event of json.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const status = comp.status;
    const state = status?.type?.state ?? null;
    const shortDetail = status?.type?.shortDetail ?? status?.type?.detail ?? '';
    const description = status?.type?.description;

    const competitors = comp.competitors ?? [];
    const away = competitors.find((c) => c.homeAway === 'away')?.team?.abbreviation;
    const home = competitors.find((c) => c.homeAway === 'home')?.team?.abbreviation;
    if (!away || !home) continue;

    let timeOverride: string | null = null;
    let liveLabel: string | null = null;

    if (state === 'in') {
      liveLabel = buildLiveLabel(status?.period, status?.displayClock, description);
    } else if (state === 'pre') {
      // shortDetail format: "4/8 - 8:00 PM EDT"
      const parts = shortDetail.split(' - ');
      timeOverride = parts.length > 1 ? parts[1].trim() : null;
    }

    map.set(`${away}@${home}`, { timeOverride, liveLabel, state });
  }

  return map;
}

/**
 * Fetches ESPN scoreboard for a given date and returns per-game status info.
 * Only enabled for today's date.
 */
export function useESPNScoreboardInfo(dateStr: string, isToday: boolean) {
  return useQuery({
    queryKey: ['espn-scoreboard-info', dateStr],
    queryFn: () => fetchScoreboardInfo(dateStr),
    enabled: isToday,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}
