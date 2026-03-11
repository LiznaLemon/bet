import type { GameLogEntry, Player } from '@/lib/types';

const ALPHA = 0.55;

function getPositionGroup(pos: string): string {
  const p = (pos ?? '').toUpperCase();
  if (p === 'PG' || p === 'SG') return 'G';
  if (p === 'SF' || p === 'PF') return 'F';
  if (p === 'C') return 'C';
  return 'F';
}

function getStatVector(p: Player): number[] {
  const gp = Math.max(1, Number(p.games_played ?? 1));
  const ppg = Number(p.ppg ?? 0) || Number(p.total_points ?? 0) / gp;
  const rpg = Number(p.rpg ?? 0) || Number(p.total_rebounds ?? 0) / gp;
  const apg = Number(p.apg ?? 0) || Number(p.total_assists ?? 0) / gp;
  const mpg = Number(p.mpg ?? 0) || Number(p.total_minutes ?? 0) / gp;
  const fgaPg = Number(p.total_field_goals_attempted ?? 0) / gp;
  const tpaPg = Number(p.total_three_point_attempted ?? 0) / gp;
  const ftaPg = Number(p.total_free_throws_attempted ?? 0) / gp;
  return [ppg, rpg, apg, mpg, fgaPg, tpaPg, ftaPg];
}

function getShotProfileVector(p: Player): number[] {
  const total = Number(p.total_points ?? 0) || 1;
  const ptsFt = Number(p.pts_ft ?? 0);
  const pts3pt = Number(p.pts_3pt ?? 0);
  const ptsFg = Number(p.pts_fg ?? 0);
  const pctFt = Math.min(1, Math.max(0, ptsFt / total));
  const pct3pt = Math.min(1, Math.max(0, pts3pt / total));
  const pctFg = Math.min(1, Math.max(0, ptsFg / total));
  if (pctFt + pct3pt + pctFg < 0.01) {
    return [0.33, 0.33, 0.34];
  }
  const sum = pctFt + pct3pt + pctFg;
  return [pctFt / sum, pct3pt / sum, pctFg / sum];
}

function euclidean(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function normalizeVectors(
  players: Player[],
  getVector: (p: Player) => number[]
): { min: number[]; max: number[] } {
  const vectors = players.map(getVector);
  const dims = vectors[0]?.length ?? 0;
  const min = Array(dims).fill(Infinity);
  const max = Array(dims).fill(-Infinity);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) {
      const x = v[i] ?? 0;
      if (x < min[i]) min[i] = x;
      if (x > max[i]) max[i] = x;
    }
  }
  for (let i = 0; i < dims; i++) {
    if (max[i] <= min[i]) max[i] = min[i] + 1;
  }
  return { min, max };
}

function normalizeValue(v: number, min: number, max: number): number {
  return (v - min) / (max - min);
}

export function computeSimilarity(
  a: Player,
  b: Player,
  allPlayers: Player[],
  samePositionOnly = true
): number {
  if (a.athlete_id === b.athlete_id) return 0;
  if (samePositionOnly && getPositionGroup(a.athlete_position_abbreviation) !== getPositionGroup(b.athlete_position_abbreviation)) {
    return Infinity;
  }
  const statVecA = getStatVector(a);
  const statVecB = getStatVector(b);
  const shotVecA = getShotProfileVector(a);
  const shotVecB = getShotProfileVector(b);

  const { min: statMin, max: statMax } = normalizeVectors(allPlayers, getStatVector);
  const statDist = euclidean(
    statVecA.map((v, i) => normalizeValue(v, statMin[i], statMax[i])),
    statVecB.map((v, i) => normalizeValue(v, statMin[i], statMax[i]))
  );
  const shotDist = euclidean(shotVecA, shotVecB);
  return ALPHA * statDist + (1 - ALPHA) * shotDist;
}

export type SimilarPlayerWithGames = {
  player: Player;
  similarityScore: number;
  gamesVsOpponent: GameLogEntry[];
  avgPts: number;
  avgReb: number;
  avgAst: number;
};

export function getSimilarPlayers(
  player: Player,
  allPlayers: Player[],
  opponentAbbrev: string,
  k = 10
): SimilarPlayerWithGames[] {
  const opp = (opponentAbbrev ?? '').toUpperCase().trim();
  if (!opp) return [];

  const withScores = allPlayers
    .filter((p) => p.athlete_id !== player.athlete_id)
    .map((p) => ({
      player: p,
      score: computeSimilarity(player, p, allPlayers),
    }))
    .filter((x) => x.score < Infinity)
    .sort((a, b) => a.score - b.score)
    .slice(0, k * 2);

  const result: SimilarPlayerWithGames[] = [];
  for (const { player: p, score } of withScores) {
    const gameLog = (p.game_log ?? []) as GameLogEntry[];
    const gamesVsOpponent = gameLog.filter(
      (g) => (g.opponent_team_abbreviation ?? '').toUpperCase().trim() === opp
    );
    if (gamesVsOpponent.length === 0) continue;
    const n = gamesVsOpponent.length;
    const avgPts = gamesVsOpponent.reduce((s, g) => s + (g.points ?? 0), 0) / n;
    const avgReb = gamesVsOpponent.reduce((s, g) => s + (g.rebounds ?? 0), 0) / n;
    const avgAst = gamesVsOpponent.reduce((s, g) => s + (g.assists ?? 0), 0) / n;
    result.push({ player: p, similarityScore: score, gamesVsOpponent, avgPts, avgReb, avgAst });
    if (result.length >= k) break;
  }
  return result;
}

export type NoteworthyBadge = 'season_high' | 'top_10_pct' | 'best_vs_team';

export function getNoteworthyBadges(
  game: GameLogEntry,
  fullGameLog: GameLogEntry[],
  opponentAbbrev: string
): { stat: string; badge: NoteworthyBadge }[] {
  const badges: { stat: string; badge: NoteworthyBadge }[] = [];
  if (!fullGameLog.length) return badges;

  const statsToCheck: { key: keyof GameLogEntry; label: string }[] = [
    { key: 'points', label: 'pts' },
    { key: 'rebounds', label: 'reb' },
    { key: 'assists', label: 'ast' },
  ];

  for (const { key, label } of statsToCheck) {
    const val = (game[key] as number) ?? 0;
    const values = fullGameLog.map((g) => (g[key] as number) ?? 0);
    const max = Math.max(...values);
    if (val >= max && max > 0) {
      badges.push({ stat: label, badge: 'season_high' });
    } else {
      const sorted = [...values].sort((a, b) => b - a);
      const idx = sorted.indexOf(val);
      const pct = 1 - idx / Math.max(1, sorted.length);
      if (pct >= 0.9 && val > 0) {
        badges.push({ stat: label, badge: 'top_10_pct' });
      }
    }
  }

  const gamesVsOpp = fullGameLog.filter(
    (g) => (g.opponent_team_abbreviation ?? '').toUpperCase().trim() === (opponentAbbrev ?? '').toUpperCase().trim()
  );
  if (gamesVsOpp.length >= 2) {
    const ptsMax = Math.max(...gamesVsOpp.map((g) => g.points ?? 0));
    if ((game.points ?? 0) >= ptsMax && ptsMax > 0) {
      badges.push({ stat: 'pts', badge: 'best_vs_team' });
    }
  }

  return badges;
}

export function getBestCallout(
  similarPlayers: SimilarPlayerWithGames[],
  opponentAbbrev: string
): string | null {
  if (similarPlayers.length === 0) return null;
  for (const { player, gamesVsOpponent } of similarPlayers) {
    const fullLog = (player.game_log ?? []) as GameLogEntry[];
    for (const game of gamesVsOpponent) {
      const badges = getNoteworthyBadges(game, fullLog, opponentAbbrev);
      const seasonHigh = badges.find((b) => b.badge === 'season_high' && b.stat === 'pts');
      if (seasonHigh) {
        return `${player.athlete_display_name} had ${game.points} pts (season high) vs this team`;
      }
      const top10 = badges.find((b) => b.badge === 'top_10_pct' && b.stat === 'pts');
      if (top10) {
        return `${player.athlete_display_name}: ${game.points}/${game.rebounds ?? 0}/${game.assists ?? 0} vs this team (top 10% performance)`;
      }
    }
  }
  const first = similarPlayers[0];
  const n = first.gamesVsOpponent.length;
  const avg = Math.round(first.avgPts * 10) / 10;
  return `${similarPlayers.length} similar player${similarPlayers.length > 1 ? 's' : ''} vs ${opponentAbbrev}: ${avg} PPG avg (${n} game${n > 1 ? 's' : ''})`;
}
