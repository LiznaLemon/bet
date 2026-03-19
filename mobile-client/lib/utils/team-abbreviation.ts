import { supabase } from '@/lib/supabase';

/**
 * Canonical team abbreviation map. Loaded from the DB `team_abbreviations` table
 * on first use, with a hardcoded fallback for immediate display.
 */
const ABBREV_TO_CANONICAL: Record<string, string> = {
  NY: 'NYK', NYK: 'NYK',
  GS: 'GSW', GSW: 'GSW',
  SA: 'SAS', SAS: 'SAS',
  NO: 'NOP', NOP: 'NOP',
  UTAH: 'UTA', UTA: 'UTA',
  BRK: 'BKN', BKN: 'BKN',
  ATL: 'ATL', BOS: 'BOS', CHI: 'CHI', CHA: 'CHA',
  CLE: 'CLE', DAL: 'DAL', DEN: 'DEN', DET: 'DET',
  HOU: 'HOU', IND: 'IND', LAC: 'LAC', LAL: 'LAL',
  MEM: 'MEM', MIA: 'MIA', MIL: 'MIL', MIN: 'MIN',
  OKC: 'OKC', ORL: 'ORL', PHI: 'PHI', PHX: 'PHX',
  POR: 'POR', SAC: 'SAC', TOR: 'TOR', WSH: 'WSH',
};

let dbMapLoaded = false;

/** Hydrate the local map from the DB's canonical table (best-effort, non-blocking). */
export async function loadTeamAbbreviations(): Promise<void> {
  if (dbMapLoaded) return;
  try {
    const { data } = await supabase
      .from('team_abbreviations')
      .select('variant, canonical');
    if (data) {
      for (const row of data) {
        ABBREV_TO_CANONICAL[row.variant.toUpperCase()] = row.canonical;
      }
    }
    dbMapLoaded = true;
  } catch {
    // Fallback to hardcoded map
  }
}

/** Normalize team abbreviation to standard 3-letter format. */
export function toThreeLetterAbbrev(abbrev: string | null | undefined): string {
  if (!abbrev) return '';
  const key = abbrev.toUpperCase().trim();
  return ABBREV_TO_CANONICAL[key] ?? key;
}

const CANONICAL_TO_ALIASES: Record<string, string[]> = {
  NYK: ['NYK', 'NY'],
  GSW: ['GSW', 'GS'],
  SAS: ['SAS', 'SA'],
  NOP: ['NOP', 'NO'],
  UTA: ['UTA', 'UTAH'],
  BKN: ['BKN', 'BRK'],
};

/** Get all possible backend values for a 3-letter abbrev (for flexible querying). */
export function getAbbrevAliases(threeLetter: string): string[] {
  const key = threeLetter.toUpperCase().trim();
  const canonical = ABBREV_TO_CANONICAL[key] ?? key;
  return CANONICAL_TO_ALIASES[canonical] ?? [key];
}
