import type { GameBoxScore } from '@/lib/queries/game-boxscores';
import type { AccumulatedStats } from '@/lib/utils/live-stats';
import { toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';

export type GameTeamStats = {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tpg: number;
  fgPct: number;
  threePtPct: number;
  ftPct: number;
};

/** Aggregate box scores by team into game totals. Returns { away, home } keyed by current game's team order. */
export function aggregateBoxScoresByTeam(
  boxScores: GameBoxScore[],
  awayAbbrev: string,
  homeAbbrev: string
): { away: GameTeamStats; home: GameTeamStats } | null {
  const awayUpper = toThreeLetterAbbrev((awayAbbrev ?? '').toUpperCase().trim()) || (awayAbbrev ?? '').toUpperCase().trim();
  const homeUpper = toThreeLetterAbbrev((homeAbbrev ?? '').toUpperCase().trim()) || (homeAbbrev ?? '').toUpperCase().trim();
  const byTeam = boxScores.reduce(
    (acc, b) => {
      const raw = (b.team_abbreviation ?? '').toUpperCase().trim();
      const t = toThreeLetterAbbrev(raw) || raw;
      if (!acc[t]) {
        acc[t] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, f3pm: 0, f3pa: 0, ftm: 0, fta: 0 };
      }
      acc[t].pts += b.points;
      acc[t].reb += b.rebounds;
      acc[t].ast += b.assists;
      acc[t].stl += b.steals;
      acc[t].blk += b.blocks;
      acc[t].tov += b.turnovers;
      acc[t].fgm += b.field_goals_made;
      acc[t].fga += b.field_goals_attempted;
      acc[t].f3pm += b.three_point_made;
      acc[t].f3pa += b.three_point_attempted;
      acc[t].ftm += b.free_throws_made;
      acc[t].fta += b.free_throws_attempted;
      return acc;
    },
    {} as Record<string, { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fgm: number; fga: number; f3pm: number; f3pa: number; ftm: number; fta: number }>
  );
  const awayData = byTeam[awayUpper];
  const homeData = byTeam[homeUpper];
  if (!awayData || !homeData) return null;
  return {
    away: {
      ppg: awayData.pts,
      rpg: awayData.reb,
      apg: awayData.ast,
      spg: awayData.stl,
      bpg: awayData.blk,
      tpg: awayData.tov,
      fgPct: awayData.fga > 0 ? (100 * awayData.fgm) / awayData.fga : 0,
      threePtPct: awayData.f3pa > 0 ? (100 * awayData.f3pm) / awayData.f3pa : 0,
      ftPct: awayData.fta > 0 ? (100 * awayData.ftm) / awayData.fta : 0,
    },
    home: {
      ppg: homeData.pts,
      rpg: homeData.reb,
      apg: homeData.ast,
      spg: homeData.stl,
      bpg: homeData.blk,
      tpg: homeData.tov,
      fgPct: homeData.fga > 0 ? (100 * homeData.fgm) / homeData.fga : 0,
      threePtPct: homeData.f3pa > 0 ? (100 * homeData.f3pm) / homeData.f3pa : 0,
      ftPct: homeData.fta > 0 ? (100 * homeData.ftm) / homeData.fta : 0,
    },
  };
}

/** Aggregate live stats (from play-by-play) by team. Returns { away, home }; missing teams get zeros. */
export function aggregateLiveStatsByTeam(
  liveStatsMap: Map<string, AccumulatedStats>,
  athleteToTeam: Map<string, string>,
  awayAbbrev: string,
  homeAbbrev: string
): { away: GameTeamStats; home: GameTeamStats } {
  const awayNorm = toThreeLetterAbbrev(awayAbbrev) || (awayAbbrev ?? '').toUpperCase().trim();
  const homeNorm = toThreeLetterAbbrev(homeAbbrev) || (homeAbbrev ?? '').toUpperCase().trim();

  const byTeam: Record<string, { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fgm: number; fga: number; f3pm: number; f3pa: number; ftm: number; fta: number }> = {};

  for (const [, stats] of liveStatsMap) {
    const teamRaw = athleteToTeam.get(stats.athlete_id) ?? athleteToTeam.get(String(Number(stats.athlete_id)));
    if (!teamRaw) continue;
    const t = toThreeLetterAbbrev(teamRaw) || (teamRaw ?? '').toUpperCase().trim();
    if (!byTeam[t]) {
      byTeam[t] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, f3pm: 0, f3pa: 0, ftm: 0, fta: 0 };
    }
    byTeam[t].pts += stats.points;
    byTeam[t].reb += stats.rebounds;
    byTeam[t].ast += stats.assists;
    byTeam[t].stl += stats.steals;
    byTeam[t].blk += stats.blocks;
    byTeam[t].tov += stats.turnovers;
    byTeam[t].fgm += stats.field_goals_made;
    byTeam[t].fga += stats.field_goals_attempted;
    byTeam[t].f3pm += stats.three_point_made;
    byTeam[t].f3pa += stats.three_point_attempted;
    byTeam[t].ftm += stats.free_throws_made;
    byTeam[t].fta += stats.free_throws_attempted;
  }

  const awayData = byTeam[awayNorm] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, f3pm: 0, f3pa: 0, ftm: 0, fta: 0 };
  const homeData = byTeam[homeNorm] ?? { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, f3pm: 0, f3pa: 0, ftm: 0, fta: 0 };

  return {
    away: {
      ppg: awayData.pts,
      rpg: awayData.reb,
      apg: awayData.ast,
      spg: awayData.stl,
      bpg: awayData.blk,
      tpg: awayData.tov,
      fgPct: awayData.fga > 0 ? (100 * awayData.fgm) / awayData.fga : 0,
      threePtPct: awayData.f3pa > 0 ? (100 * awayData.f3pm) / awayData.f3pa : 0,
      ftPct: awayData.fta > 0 ? (100 * awayData.ftm) / awayData.fta : 0,
    },
    home: {
      ppg: homeData.pts,
      rpg: homeData.reb,
      apg: homeData.ast,
      spg: homeData.stl,
      bpg: homeData.blk,
      tpg: homeData.tov,
      fgPct: homeData.fga > 0 ? (100 * homeData.fgm) / homeData.fga : 0,
      threePtPct: homeData.f3pa > 0 ? (100 * homeData.f3pm) / homeData.f3pa : 0,
      ftPct: homeData.fta > 0 ? (100 * homeData.ftm) / homeData.fta : 0,
    },
  };
}
