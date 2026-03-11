/**
 * Maps backend/ESPN team abbreviations to standard 3-letter NBA abbreviations.
 * Backend may return 2-letter variants (e.g. NY, GS, SA, NO).
 */
const ABBREV_TO_THREE_LETTER: Record<string, string> = {
  NY: 'NYK',
  GS: 'GSW',
  SA: 'SAS',
  NO: 'NOP',
  BRK: 'BKN',
  BKN: 'BKN',
  PHX: 'PHX',
  UTA: 'UTA',
  UTAH: 'UTA',
  WSH: 'WSH',
  CHA: 'CHA',
  // Standard 3-letter (pass-through)
  ATL: 'ATL',
  BOS: 'BOS',
  CHI: 'CHI',
  CLE: 'CLE',
  DAL: 'DAL',
  DEN: 'DEN',
  DET: 'DET',
  GSW: 'GSW',
  HOU: 'HOU',
  IND: 'IND',
  LAC: 'LAC',
  LAL: 'LAL',
  MEM: 'MEM',
  MIA: 'MIA',
  MIL: 'MIL',
  MIN: 'MIN',
  NOP: 'NOP',
  NYK: 'NYK',
  OKC: 'OKC',
  ORL: 'ORL',
  PHI: 'PHI',
  POR: 'POR',
  SAC: 'SAC',
  SAS: 'SAS',
  TOR: 'TOR',
};

/** Normalize team abbreviation to standard 3-letter format. */
export function toThreeLetterAbbrev(abbrev: string | null | undefined): string {
  if (!abbrev) return '';
  const key = abbrev.toUpperCase().trim();
  return ABBREV_TO_THREE_LETTER[key] ?? key;
}

/** All possible backend values that map to a 3-letter abbrev (for DB query matching). */
const THREE_LETTER_ALIASES: Record<string, string[]> = {
  NYK: ['NYK', 'NY'],
  GSW: ['GSW', 'GS'],
  SAS: ['SAS', 'SA'],
  NOP: ['NOP', 'NO'],
  UTA: ['UTA', 'UTAH'],
};

/** Get all possible backend values for a 3-letter abbrev (for flexible querying). */
export function getAbbrevAliases(threeLetter: string): string[] {
  const key = threeLetter.toUpperCase().trim();
  return THREE_LETTER_ALIASES[key] ?? [key];
}
