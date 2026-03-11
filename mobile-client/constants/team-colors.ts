/**
 * NBA team colors by abbreviation. Primary first, then secondary, tertiary.
 * Used for schedule cards echo effect, comparison bars, etc.
 * Colors from official team branding (teamcolorcodes.com).
 */
export type TeamColorPalette = readonly [string, ...string[]];

export const NBA_TEAM_COLORS: Record<string, TeamColorPalette> = {
  ATL: ['#e03a3e', '#c4d600', '#26282a'],
  BOS: ['#007a33', '#ba9653', '#963821'],
  BKN: ['#ffffff', '#a1a1a4', '#6b7280'],
  CHA: ['#1d1160', '#00788c', '#a1a1a4'],
  CHI: ['#ce1141', '#000000'],
  CLE: ['#860038', '#041e42', '#fdbb30'],
  DAL: ['#00538c', '#002b5e', '#b8c4ca'],
  DEN: ['#fec524', '#0e2240', '#8b2131', '#1d428a'],
  DET: ['#c8102e', '#1d42ba', '#bec0c2'],
  GSW: ['#ffc72c','#1d428a', '#ffffff'],
  HOU: ['#ce1141', '#000000', '#c4ced4'],
  IND: ['#002d62', '#fdbb30', '#bec0c2'],
  LAC: ['#c8102e', '#1d428a', '#bec0c2'],
  LAL: ['#552583', '#fdb927', '#000000'],
  MEM: ['#5d76a9', '#12173f', '#f5b112'],
  MIA: ['#98002e', '#f9a01b', '#000000'],
  MIL: ['#00471b', '#eee1c6', '#0077c0'],
  MIN: ['#0c2340', '#236192', '#9ea2a2', '#78be20'],
  NO: ['#0c2340', '#c8102e', '#85714d'],
  NOP: ['#0c2340', '#c8102e', '#85714d'],
  NY: ['#006bb6', '#f58426', '#bec0c2'],
  NYK: ['#006bb6', '#f58426', '#bec0c2'],
  OKC: ['#007ac1', '#ef3b24', '#002d62', '#fdbb30'],
  ORL: ['#0077c0', '#c4ced4', '#000000'],
  PHI: ['#006bb6', '#ed174c', '#002b5c'],
  PHX: ['#e56020', '#1d1160', '#000000', '#63727a'],
  POR: ['#e03a3e', '#000000'],
  SAC: ['#5a2d81', '#63727a', '#000000'],
  SA: ['#c4ced4', '#000000'],
  SAS: ['#c4ced4', '#000000'],
  TOR: ['#ce1141', '#000000', '#a1a1a4', '#b4975a'],
  UTA: ['#39006b','#ffffff', '#79a3dc'],
  WSH: ['#002b5c', '#e31837', '#c4ced4'],
};

const DEFAULT_COLORS: TeamColorPalette = ['#6b7280'];

/** Get team color palette. Returns array of hex strings (primary first). */
export function getTeamColors(abbrev: string | null | undefined): readonly string[] {
  if (!abbrev) return DEFAULT_COLORS;
  const key = abbrev.toUpperCase().trim();
  const palette = NBA_TEAM_COLORS[key];
  return palette ?? DEFAULT_COLORS;
}

/** Get primary team color (backward compatible). */
export function getTeamColor(abbrev: string | null | undefined): string {
  return getTeamColors(abbrev)[0];
}
