/**
 * League-wide rank (1 = best) among `teams` for a stat, after sorting by value.
 * Tie-break: secondary sort on `team_abbreviation` so ranks are unique.
 */
export function getLeagueRank<T extends { team_abbreviation: string }>(
  teams: T[],
  getValue: (t: T) => number,
  lowerIsBetter: boolean,
  abbrevAliases: string[]
): number | null {
  if (!teams.length) return null;
  const aliasSet = new Set(abbrevAliases.map((a) => a.toUpperCase().trim()));
  const sorted = [...teams].sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    if (va !== vb) return lowerIsBetter ? va - vb : vb - va;
    return (a.team_abbreviation ?? '').localeCompare(b.team_abbreviation ?? '');
  });
  const idx = sorted.findIndex((t) =>
    aliasSet.has((t.team_abbreviation ?? '').toUpperCase().trim())
  );
  return idx >= 0 ? idx + 1 : null;
}
