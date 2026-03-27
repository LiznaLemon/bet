import type { ESPNInjuryEntry } from '@/lib/queries/espn-live-game';
import { supabase } from '@/lib/supabase';

/** Best-effort persistence when ESPN summary returns injuries (non-blocking for UI). */
export async function upsertGameInjuryReportsFromEspn(
  gameId: string,
  season: number,
  injuries: ESPNInjuryEntry[]
): Promise<void> {
  if (!injuries.length) return;

  const rows = injuries.map((i) => ({
    game_id: gameId,
    season,
    team_abbreviation: i.teamAbbrev,
    player_name: i.playerName,
    status: i.status,
    position: i.position || null,
    injury_type: i.injuryType || null,
    injury_detail: i.injuryDetail || null,
    headshot_url: i.headshotUrl,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('game_injury_reports').upsert(rows, {
    onConflict: 'game_id,team_abbreviation,player_name',
  });
  if (error) {
    console.warn('[upsertGameInjuryReportsFromEspn]', error.message);
  }
}
