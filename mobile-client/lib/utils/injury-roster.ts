import type { ESPNInjuryEntry } from '@/lib/queries/espn-live-game';
import type { Player } from '@/lib/types';
import { getAbbrevAliases, toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';

/** Align with matchup injury status coloring: any status containing "out". */
export function injuryStatusMeansDefinitelyOut(status: string | undefined): boolean {
  if (!status) return false;
  return status.toLowerCase().includes('out');
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatchInjuryToPlayer(injuryName: string, p: Player): boolean {
  const inj = normalizeName(injuryName);
  if (inj.length < 2) return false;
  const display = normalizeName(p.athlete_display_name);
  const shortN = normalizeName(p.athlete_short_name ?? '');
  if (inj === display || inj === shortN) return true;
  if (display.includes(inj) || inj.includes(display)) return true;
  if (shortN && (shortN.includes(inj) || inj.includes(shortN))) return true;
  const injParts = inj.split(' ').filter(Boolean);
  const dispParts = display.split(' ').filter(Boolean);
  if (injParts.length >= 2 && injParts.every((part) => dispParts.some((d) => d.startsWith(part) || part.startsWith(d)))) {
    return true;
  }
  return false;
}

function injuryBelongsToGameTeam(inj: ESPNInjuryEntry, gameAwayAbbrev: string, gameHomeAbbrev: string): boolean {
  const raw = (inj.teamAbbrev ?? '').toUpperCase().trim();
  const awayCanon = toThreeLetterAbbrev(gameAwayAbbrev);
  const homeCanon = toThreeLetterAbbrev(gameHomeAbbrev);
  const awaySet = new Set(getAbbrevAliases(awayCanon).map((a) => a.toUpperCase()));
  const homeSet = new Set(getAbbrevAliases(homeCanon).map((a) => a.toUpperCase()));
  return awaySet.has(raw) || homeSet.has(raw);
}

/** Roster athlete IDs for players listed as out on the injury report for this matchup. */
export function athleteIdsOutFromInjuries(
  players: Player[],
  injuries: ESPNInjuryEntry[],
  gameAwayAbbrev: string,
  gameHomeAbbrev: string
): Set<string> {
  const ids = new Set<string>();
  if (!injuries.length) return ids;

  for (const inj of injuries) {
    if (!injuryStatusMeansDefinitelyOut(inj.status)) continue;
    if (!injuryBelongsToGameTeam(inj, gameAwayAbbrev, gameHomeAbbrev)) continue;
    for (const p of players) {
      if (namesMatchInjuryToPlayer(inj.playerName, p)) {
        ids.add(p.athlete_id);
        break;
      }
    }
  }
  return ids;
}
