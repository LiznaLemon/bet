import type { ESPNInjuryEntry } from '@/lib/queries/espn-live-game';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Stable hash of an injury list for dedup — only captures fields that matter for status. */
function hashInjuries(injuries: ESPNInjuryEntry[]): string {
  const sorted = [...injuries].sort((a, b) =>
    `${a.teamAbbrev}${a.playerName}`.localeCompare(`${b.teamAbbrev}${b.playerName}`)
  );
  const str = JSON.stringify(
    sorted.map((i) => ({ t: i.teamAbbrev, p: i.playerName, s: i.status }))
  );
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash & 0xffffffff;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Saves a snapshot of the injury report for a game if it has changed since the last snapshot.
 * Polling stops automatically when isFinal, so the last snapshot captured is the game-time state.
 */
export async function saveInjurySnapshotIfChanged(
  gameId: string,
  season: number,
  injuries: ESPNInjuryEntry[]
): Promise<void> {
  if (!injuries.length) return;

  const newHash = hashInjuries(injuries);

  // Check the most recent snapshot hash for this game
  const { data: latest } = await supabase
    .from('game_injury_snapshots')
    .select('injuries_hash')
    .eq('game_id', gameId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.injuries_hash === newHash) return; // nothing changed

  const { error } = await supabase.from('game_injury_snapshots').insert({
    game_id: gameId,
    season,
    captured_at: new Date().toISOString(),
    injuries: injuries,
    injuries_hash: newHash,
  });

  if (error) {
    console.warn('[saveInjurySnapshotIfChanged]', error.message);
  }
}

export type StoredInjuryResult = {
  injuries: ESPNInjuryEntry[];
  /** ISO timestamp of the most recent snapshot, or null if none exists. */
  capturedAt: string | null;
};

/** Returns injuries and snapshot timestamp from the most recent snapshot for a game. */
async function fetchLatestInjurySnapshot(gameId: string): Promise<StoredInjuryResult> {
  const { data, error } = await supabase
    .from('game_injury_snapshots')
    .select('injuries, captured_at')
    .eq('game_id', gameId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[fetchLatestInjurySnapshot]', error.message);
    return { injuries: [], capturedAt: null };
  }

  return {
    injuries: (data?.injuries as ESPNInjuryEntry[]) ?? [],
    capturedAt: (data?.captured_at as string) ?? null,
  };
}

export function useStoredInjuries(gameId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['injury-snapshot', gameId],
    queryFn: () => fetchLatestInjurySnapshot(gameId!),
    enabled: !!gameId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
