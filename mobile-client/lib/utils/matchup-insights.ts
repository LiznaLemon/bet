import type { GameLogEntry, Player, ScheduleGame } from '@/lib/types';
import type { TeamRecentResults } from '@/lib/queries/schedule';
import type { TeamDefensiveStats } from '@/lib/queries/team-defensive-stats';
import type { TeamOffensiveStats } from '@/lib/queries/team-offensive-stats';
import { getAbbrevAliases } from '@/lib/utils/team-abbreviation';

function teamMatches(teamAbbrev: string, gameAbbrev: string): boolean {
  const aliases = getAbbrevAliases(gameAbbrev.toUpperCase().trim());
  return aliases.includes((teamAbbrev ?? '').toUpperCase().trim());
}

type GameInfo = {
  awayTeamAbbrev: string;
  homeTeamAbbrev: string;
  gameDate?: string | null;
};

function getBackToBackInsights(game: GameInfo): string[] {
  const insights: string[] = [];
  if ((game as ScheduleGame).awayBackToBack) {
    insights.push(`${game.awayTeamAbbrev} is playing back-to-back.`);
  }
  if ((game as ScheduleGame).homeBackToBack) {
    insights.push(`${game.homeTeamAbbrev} is playing back-to-back.`);
  }
  return insights;
}

function getStreakInsight(
  teamAbbrev: string,
  results: TeamRecentResults
): string | null {
  if (results.results.length === 0) return null;
  const { wins, losses, results: arr } = results;
  let streak = 0;
  const first = arr[0];
  for (const r of arr) {
    if (r !== first) break;
    streak++;
  }
  if (streak === 0) return null;
  const kind = first === 'W' ? 'winning' : 'losing';
  const count = first === 'W' ? wins : losses;
  if (streak < 5) {
    return `${teamAbbrev} is on a ${streak}-game ${kind} streak, ${kind} ${count} of their last 5 games.`;
  }
  return `${teamAbbrev} is on a 5-game ${kind} streak.`;
}

const TOP_5_RANK = 5;
const BOTTOM_5_RANK = 26; // ranks 26-30 (bottom 5 in 30-team league)

/** Offensive stat config: sort key, label, format, higherIsBetter */
const OFFENSIVE_STAT_CONFIG: Array<{
  key: keyof TeamOffensiveStats;
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
}> = [
  { key: 'pts_avg', label: 'points', format: (v) => `${v.toFixed(1)} PPG`, higherIsBetter: true },
  { key: 'ast_avg', label: 'assists', format: (v) => `${v.toFixed(1)} APG`, higherIsBetter: true },
  { key: 'reb_avg', label: 'rebounds', format: (v) => `${v.toFixed(1)} RPG`, higherIsBetter: true },
  { key: 'stl_avg', label: 'steals', format: (v) => `${v.toFixed(1)} SPG`, higherIsBetter: true },
  { key: 'blk_avg', label: 'blocks', format: (v) => `${v.toFixed(1)} BPG`, higherIsBetter: true },
  { key: 'tov_avg', label: 'turnovers', format: (v) => `${v.toFixed(1)} TPG`, higherIsBetter: false },
  { key: 'fg_pct', label: 'field goal %', format: (v) => `${(v <= 1 ? v * 100 : v).toFixed(1)}%`, higherIsBetter: true },
  { key: 'three_pt_pct', label: '3PT%', format: (v) => `${(v <= 1 ? v * 100 : v).toFixed(1)}%`, higherIsBetter: true },
  { key: 'ft_pct', label: 'free throw %', format: (v) => `${(v <= 1 ? v * 100 : v).toFixed(1)}%`, higherIsBetter: true },
];

function getTopBottom5OffensiveInsights(
  awayAbbrev: string,
  homeAbbrev: string,
  teamOffensiveSeason: TeamOffensiveStats[]
): string[] {
  const insights: string[] = [];
  const numTeams = teamOffensiveSeason.length;
  for (const { key, label, format, higherIsBetter } of OFFENSIVE_STAT_CONFIG) {
    const sorted = [...teamOffensiveSeason].sort((a, b) => {
      const va = (a[key] as number) ?? (key.includes('pct') ? 0 : 0);
      const vb = (b[key] as number) ?? (key.includes('pct') ? 0 : 0);
      return higherIsBetter ? vb - va : va - vb;
    });
    for (const abbrev of [awayAbbrev, homeAbbrev]) {
      const idx = sorted.findIndex((t) => teamMatches(t.team_abbreviation ?? '', abbrev));
      if (idx < 0) continue;
      const rank = idx + 1;
      const isTop5 = rank <= TOP_5_RANK;
      const isBottom5 = rank >= Math.max(1, numTeams - 4); // ranks 26-30 for 30 teams
      if (!isTop5 && !isBottom5) continue;
      const team = teamOffensiveSeason.find((t) => teamMatches(t.team_abbreviation ?? '', abbrev));
      const val = team ? ((team[key] as number) ?? (key.includes('pct') ? 0 : 0)) : 0;
      if (key.includes('pct') && val <= 0) continue;
      const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
      insights.push(`${abbrev} ranks ${rank}${suffix} in ${label} (${format(val)}).`);
    }
  }
  return insights;
}

/** Defensive stat config: rank key, label, format. Lower rank = better defense. */
const DEFENSIVE_STAT_CONFIG: Array<{
  rankKey: keyof TeamDefensiveStats;
  valueKey: keyof TeamDefensiveStats;
  label: string;
  format: (v: number) => string;
}> = [
  { rankKey: 'pts_allowed_rank', valueKey: 'pts_allowed_avg', label: 'points allowed', format: (v) => `${v.toFixed(1)} PPG` },
  { rankKey: 'reb_allowed_rank', valueKey: 'reb_allowed_avg', label: 'rebounds allowed', format: (v) => `${v.toFixed(1)} RPG` },
  { rankKey: 'ast_allowed_rank', valueKey: 'ast_allowed_avg', label: 'assists allowed', format: (v) => `${v.toFixed(1)} APG` },
];

function getTopBottom5DefensiveInsights(
  awayAbbrev: string,
  homeAbbrev: string,
  teamDefense: TeamDefensiveStats[]
): string[] {
  const insights: string[] = [];
  const awayDef = teamDefense.find((t) => teamMatches(t.team_abbreviation ?? '', awayAbbrev));
  const homeDef = teamDefense.find((t) => teamMatches(t.team_abbreviation ?? '', homeAbbrev));
  for (const { rankKey, valueKey, label, format } of DEFENSIVE_STAT_CONFIG) {
    for (const def of [awayDef, homeDef]) {
      if (!def) continue;
      const rank = (def[rankKey] as number) ?? 99;
      const isTop5 = rank <= TOP_5_RANK;
      const isBottom5 = rank >= BOTTOM_5_RANK;
      if (!isTop5 && !isBottom5) continue;
      const val = (def[valueKey] as number) ?? 0;
      const abbrev = def.team_abbreviation ?? '';
      const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
      insights.push(`${abbrev} ranks ${rank}${suffix} in ${label} (${format(val)}).`);
    }
  }
  return insights;
}

function getTeamStrengthInsights(
  awayAbbrev: string,
  homeAbbrev: string,
  teamDefense: TeamDefensiveStats[],
  teamOffensiveSeason: TeamOffensiveStats[]
): string[] {
  const insights: string[] = [];
  insights.push(...getTopBottom5OffensiveInsights(awayAbbrev, homeAbbrev, teamOffensiveSeason));
  insights.push(...getTopBottom5DefensiveInsights(awayAbbrev, homeAbbrev, teamDefense));
  return insights;
}

function getPlayerTrendInsights(
  players: Player[],
  awayAbbrev: string,
  homeAbbrev: string,
  activeAwayIds: Set<string>,
  activeHomeIds: Set<string>
): string[] {
  const insights: string[] = [];
  const minGames = 15;
  const minDiff = 3;

  for (const p of players) {
    const abbrev = p.team_abbreviation ?? '';
    const isAway = teamMatches(abbrev, awayAbbrev);
    const isHome = teamMatches(abbrev, homeAbbrev);
    if (!isAway && !isHome) continue;
    const isActive = isAway ? activeAwayIds.has(p.athlete_id) : activeHomeIds.has(p.athlete_id);
    if (!isActive) continue;

    const log = (p.game_log ?? []) as GameLogEntry[];
    if (log.length < minGames) continue;

    const sorted = [...log].sort((a, b) => (b.game_date ?? '').localeCompare(a.game_date ?? ''));
    const last5 = sorted.slice(0, 5);
    const seasonPpg = Number(p.ppg) || 0;
    const last5Ppg =
      last5.length > 0
        ? last5.reduce((s, g) => s + (g.points ?? 0), 0) / last5.length
        : 0;
    const diff = last5Ppg - seasonPpg;
    if (Math.abs(diff) >= minDiff) {
      const dir = diff > 0 ? 'up' : 'down';
      const name = p.athlete_display_name ?? 'Player';
      insights.push(
        `${name} (${p.team_abbreviation}) is ${dir} ${Math.abs(diff).toFixed(1)} PPG over his last 5 vs season.`
      );
    }
  }

  return insights.slice(0, 4);
}

function getOffensiveSlumpInsight(
  awayAbbrev: string,
  homeAbbrev: string,
  teamOffensiveSeason: TeamOffensiveStats[],
  teamOffensiveLast5: TeamOffensiveStats[]
): string[] {
  const insights: string[] = [];
  for (const abbrev of [awayAbbrev, homeAbbrev]) {
    const season = teamOffensiveSeason.find((t) => teamMatches(t.team_abbreviation ?? '', abbrev));
    const last5 = teamOffensiveLast5.find((t) => teamMatches(t.team_abbreviation ?? '', abbrev));
    if (!season || !last5) continue;
    const diff = last5.pts_avg - season.pts_avg;
    if (diff <= -10) {
      insights.push(
        `${abbrev} is in an offensive slump (${last5.pts_avg.toFixed(1)} PPG last 5 vs ${season.pts_avg.toFixed(1)} season).`
      );
    }
  }
  return insights;
}

function getTopPlayerInsights(
  players: Player[],
  awayAbbrev: string,
  homeAbbrev: string,
  activeAwayIds: Set<string>,
  activeHomeIds: Set<string>
): string[] {
  const insights: string[] = [];
  const matchupPlayers = players.filter((p) => {
    const abbrev = p.team_abbreviation ?? '';
    const isAway = teamMatches(abbrev, awayAbbrev);
    const isHome = teamMatches(abbrev, homeAbbrev);
    if (!isAway && !isHome) return false;
    return isAway ? activeAwayIds.has(p.athlete_id) : activeHomeIds.has(p.athlete_id);
  });

  const byPpg = [...matchupPlayers].sort(
    (a, b) => (Number(b.ppg) || 0) - (Number(a.ppg) || 0)
  );
  if (byPpg.length >= 1) {
    const top = byPpg[0];
    insights.push(
      `${top.athlete_display_name} leads both teams in scoring (${top.ppg} PPG).`
    );
  }

  const byApg = [...matchupPlayers].sort(
    (a, b) => (Number(b.apg) || 0) - (Number(a.apg) || 0)
  );
  if (byApg.length >= 1 && byApg[0].athlete_id !== byPpg[0]?.athlete_id) {
    const top = byApg[0];
    insights.push(
      `${top.athlete_display_name} leads both teams in assists (${top.apg} APG).`
    );
  }

  return insights;
}

/** Team-related insights: streaks, back-to-back, strengths, weaknesses, rankings, offensive slump. */
export function computeTeamMatchupInsights(
  game: GameInfo,
  teamOffensiveSeason: TeamOffensiveStats[],
  teamOffensiveLast5: TeamOffensiveStats[],
  teamDefense: TeamDefensiveStats[],
  awayRecentResults: TeamRecentResults,
  homeRecentResults: TeamRecentResults
): string[] {
  const awayAbbrev = game.awayTeamAbbrev ?? '';
  const homeAbbrev = game.homeTeamAbbrev ?? '';
  if (!awayAbbrev || !homeAbbrev) return [];

  const insights: string[] = [];

  const awayStreak = getStreakInsight(awayAbbrev, awayRecentResults);
  if (awayStreak) insights.push(awayStreak);
  const homeStreak = getStreakInsight(homeAbbrev, homeRecentResults);
  if (homeStreak) insights.push(homeStreak);

  insights.push(...getBackToBackInsights(game));

  insights.push(...getTeamStrengthInsights(awayAbbrev, homeAbbrev, teamDefense, teamOffensiveSeason));
  insights.push(...getOffensiveSlumpInsight(awayAbbrev, homeAbbrev, teamOffensiveSeason, teamOffensiveLast5));

  return insights.filter(Boolean).slice(0, 24);
}

/** Player-related insights: top scorers, assists leaders, player trends. */
export function computePlayerMatchupInsights(
  game: GameInfo,
  players: Player[],
  activeAwayIds: Set<string>,
  activeHomeIds: Set<string>
): string[] {
  const awayAbbrev = game.awayTeamAbbrev ?? '';
  const homeAbbrev = game.homeTeamAbbrev ?? '';
  if (!awayAbbrev || !homeAbbrev) return [];

  const insights: string[] = [];

  insights.push(...getTopPlayerInsights(players, awayAbbrev, homeAbbrev, activeAwayIds, activeHomeIds));
  insights.push(...getPlayerTrendInsights(players, awayAbbrev, homeAbbrev, activeAwayIds, activeHomeIds));

  return insights.filter(Boolean).slice(0, 12);
}
