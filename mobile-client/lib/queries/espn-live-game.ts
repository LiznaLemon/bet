import {
  fetchESPNGameSummary,
  mapESPNBoxscoreToGameBoxScore,
  mapESPNPlaysToPlayByPlayRecord,
  type ESPNGameSummary,
} from '@/lib/api/espn-live';
import type { GameBoxScore } from '@/lib/queries/game-boxscores';
import type { PlayByPlayRecord } from '@/lib/queries/play-by-play';
import { toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';
import { useQuery } from '@tanstack/react-query';

const STATUS_FINAL = 'STATUS_FINAL';
const DEFAULT_POLL_MS = 12_000;

export type ESPNInjuryEntry = {
  teamAbbrev: string;
  playerName: string;
  headshotUrl: string | null;
  position: string;
  status: string;
  injuryType: string;
  injuryDetail: string;
};

export type ESPNLiveGameResult = {
  plays: PlayByPlayRecord[];
  boxScores: GameBoxScore[];
  header: ESPNGameSummary['header'];
  status: string | null;
  statusName: string | null;
  isFinal: boolean;
  awayScore: string | null;
  homeScore: string | null;
  awayTeam: string | null;
  homeTeam: string | null;
  injuries: ESPNInjuryEntry[];
};

export function useESPNLiveGame(
  gameId: string | undefined,
  options?: { enabled?: boolean; pollIntervalMs?: number }
) {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_MS } = options ?? {};

  const query = useQuery({
    queryKey: ['espn-live-game', gameId],
    queryFn: async (): Promise<ESPNLiveGameResult> => {
      const summary = await fetchESPNGameSummary(gameId!);
      const plays = summary.plays ?? [];
      const mappedPlays = mapESPNPlaysToPlayByPlayRecord(plays);
      const boxScores = mapESPNBoxscoreToGameBoxScore(summary);

      const comp = summary.header?.competitions?.[0];
      const competitors = comp?.competitors ?? [];
      const away = competitors.find((c) => c.homeAway === 'away');
      const home = competitors.find((c) => c.homeAway === 'home');
      const statusType = comp?.status?.type;
      const statusName = statusType?.name ?? null;

      const injuries: ESPNInjuryEntry[] = [];
      for (const teamBlock of summary.injuries ?? []) {
        const raw = teamBlock.team?.abbreviation ?? '';
        const teamAbbrev = toThreeLetterAbbrev(raw) || raw;
        for (const inj of teamBlock.injuries ?? []) {
          injuries.push({
            teamAbbrev,
            playerName: inj.athlete?.shortName ?? inj.athlete?.displayName ?? '',
            headshotUrl: inj.athlete?.headshot?.href ?? null,
            position: inj.athlete?.position?.abbreviation ?? '',
            status: inj.status ?? '',
            injuryType: inj.details?.type ?? '',
            injuryDetail: inj.details?.detail ?? '',
          });
        }
      }

      return {
        plays: mappedPlays,
        boxScores,
        header: summary.header,
        status: statusType?.state ?? null,
        statusName,
        isFinal: statusName === STATUS_FINAL,
        awayScore: away?.score ?? null,
        homeScore: home?.score ?? null,
        awayTeam: away?.team?.abbreviation ?? null,
        homeTeam: home?.team?.abbreviation ?? null,
        injuries,
      };
    },
    enabled: !!gameId && enabled,
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data as ESPNLiveGameResult | undefined;
      if (data?.isFinal) return false;
      return pollIntervalMs;
    },
  });

  return query;
}
