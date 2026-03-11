/**
 * Scalable stat configuration for player detail screens.
 *
 * Structure:
 * - Sections have a title and rows
 * - Each row has stat keys and a layout hint
 * - Stat keys map to labels via STAT_LABELS
 * - Values are resolved from the player object in the component
 *
 * To add/change stats: edit getStatSections() and STAT_LABELS.
 * To change row groupings: rearrange statKeys within rows.
 */

export type StatRowLayout = 'equal' | 'highlight' | 'auto';
/** @deprecated Prefer itemsPerRow. equal: 2 per row | highlight: 1 per row | auto: 2 per row */

/** Number of stat cards per row. Controls width: 1=100%, 2=48%, 3=31% (accounts for gap). */
export type ItemsPerRow = 1 | 2 | 3;

export type StatSectionConfig = {
  title: string;
  /** When true, render shot chart instead of stat cards. Section header still shows. */
  shotChart?: boolean;
  rows: {
    statKeys: string[];
    /** Explicit items per row (1, 2, or 3). Takes precedence over rowLayout. */
    itemsPerRow?: ItemsPerRow;
    /** @deprecated Use itemsPerRow instead */
    rowLayout?: StatRowLayout;
  }[];
};

/** Label for each stat key. Add new keys here when extending. */
export const STAT_LABELS: Record<string, string> = {
  games_played: 'Games Played',
  mpg: 'Minutes (MPG)',
  ppg: 'Points (PPG)',
  rpg: 'Rebounds (RPG)',
  apg: 'Assists (APG)',
  spg: 'Steals (SPG)',
  bpg: 'Blocks (BPG)',
  tpg: 'Turnovers (TPG)',
  fpg: 'Fouls (FPG)',
  plus_minus: 'Plus/Minus',
  fg_pct: 'Field Goal %',
  three_pt_pct: '3-Point %',
  ft_pct: 'Free Throw %',
  ts_pct: 'True Shooting %',
  fg_made_attempted: 'FG Made/Attempted',
  three_pt_made_attempted: '3PT Made/Attempted',
  ft_made_attempted: 'FT Made/Attempted',
  off_reb_per_game: 'Offensive Rebounds',
  def_reb_per_game: 'Defensive Rebounds',
  total_points: 'Total Points',
  total_rebounds: 'Total Rebounds',
  total_assists: 'Total Assists',
};

export type TimePeriod = 'season' | 'last_10' | 'last_5';

/** Maps per-game stat keys to their total field on the player object. */
export const STAT_TOTAL_KEYS: Record<string, string> = {
  ppg: 'total_points',
  mpg: 'total_minutes',
  rpg: 'total_rebounds',
  apg: 'total_assists',
  spg: 'total_steals',
  bpg: 'total_blocks',
  tpg: 'total_turnovers',
  fpg: 'total_fouls',
  plus_minus: 'total_plus_minus',
};

/** Maps per-game stat keys to game_log field names for period totals. */
const GAME_LOG_STAT_KEYS: Record<string, string> = {
  ppg: 'points',
  mpg: 'minutes',
  rpg: 'rebounds',
  apg: 'assists',
  spg: 'steals',
  bpg: 'blocks',
  tpg: 'turnovers',
  fpg: 'fouls',
  plus_minus: 'plus_minus',
};

type GameLogEntry = {
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  minutes?: number;
  turnovers?: number;
  fouls?: number;
  plus_minus?: number;
  field_goals_made?: number;
  field_goals_attempted?: number;
  three_point_made?: number;
  three_point_attempted?: number;
  free_throws_made?: number;
  free_throws_attempted?: number;
};

/** Compute period average from game_log when last_5/last_10 not in JSON. */
function avgFromGameLog(
  log: GameLogEntry[],
  n: number,
  field: keyof GameLogEntry
): string | null {
  const slice = log.slice(0, n).filter((g) => g[field] != null);
  if (slice.length === 0) return null;
  const sum = slice.reduce((s, g) => s + (Number(g[field]) || 0), 0);
  return (sum / slice.length).toFixed(1);
}

/** Compute shooting % from game_log for last N games. */
function pctFromGameLog(
  log: GameLogEntry[],
  n: number,
  madeKey: keyof GameLogEntry,
  attemptedKey: keyof GameLogEntry
): string | null {
  const slice = log.slice(0, n);
  const made = slice.reduce((s, g) => s + (Number(g[madeKey]) || 0), 0);
  const attempted = slice.reduce((s, g) => s + (Number(g[attemptedKey]) || 0), 0);
  if (attempted === 0) return null;
  return ((made / attempted) * 100).toFixed(1);
}

/**
 * Resolves the total for a per-game stat. Returns null if no total is available.
 */
export function resolveStatTotal(
  player: Record<string, unknown>,
  key: string,
  period: TimePeriod = 'season'
): string | null {
  const totalKey = STAT_TOTAL_KEYS[key];
  if (!totalKey) return null;

  const p = player as {
    game_log?: Record<string, unknown>[];
    total_points?: number;
    total_minutes?: number;
    total_rebounds?: number;
    total_assists?: number;
    total_steals?: number;
    total_blocks?: number;
    total_turnovers?: number;
    total_fouls?: number;
    total_plus_minus?: number;
  };

  if (period === 'last_5' || period === 'last_10') {
    const n = period === 'last_5' ? 5 : 10;
    const logField = GAME_LOG_STAT_KEYS[key];
    if (!logField) return null;
    const log = (p.game_log ?? []) as Record<string, unknown>[];
    const slice = log.slice(0, n);
    const sum = slice.reduce((s, g) => s + (Number(g[logField]) || 0), 0);
    return sum > 0 || sum === 0 ? String(Math.round(sum)) : null;
  }

  const val = (p as Record<string, unknown>)[totalKey];
  return val != null ? String(val) : null;
}

/**
 * Resolves a stat value from a player object. Returns null to hide the stat.
 * When period is 'last_10' or 'last_5', pulls from player.last_10 or player.last_5 when available.
 * Totals and some stats (off_reb_per_game, etc.) always use season data.
 */
export function resolveStatValue(
  player: Record<string, unknown>,
  key: string,
  period: TimePeriod = 'season'
): string | null {
  const p = player as {
    games_played?: number;
    total_minutes?: number;
    mpg?: string;
    ppg?: string;
    rpg?: string;
    apg?: string;
    spg?: string;
    bpg?: string;
    tpg?: string;
    fpg?: string;
    plus_minus_avg?: string;
    plus_minus?: string;
    fg_pct?: string;
    three_pt_pct?: string;
    ft_pct?: string;
    ts_pct?: string;
    total_field_goals_made?: number;
    total_field_goals_attempted?: number;
    total_three_point_made?: number;
    total_three_point_attempted?: number;
    total_free_throws_made?: number;
    total_free_throws_attempted?: number;
    total_offensive_rebounds?: number;
    total_defensive_rebounds?: number;
    total_points?: number;
    total_rebounds?: number;
    total_assists?: number;
    game_log?: { minutes?: number; fouls?: number }[];
    last_5?: { games?: number; ppg?: string; rpg?: string; apg?: string; spg?: string; bpg?: string; tpg?: string; fg_pct?: string; three_pt_pct?: string; ft_pct?: string; plus_minus?: string };
    last_10?: { games?: number; ppg?: string; rpg?: string; apg?: string; spg?: string; bpg?: string; tpg?: string; fg_pct?: string; three_pt_pct?: string; ft_pct?: string; plus_minus?: string };
  };

  // Use period-specific data for filterable stats (last_5/last_10)
  const usePeriodData =
    period === 'last_5' ? p.last_5 : period === 'last_10' ? p.last_10 : undefined;
  const src = usePeriodData ?? p;

  // Totals and per-game computed stats always use season
  const useSeason = ['total_points', 'total_rebounds', 'total_assists', 'off_reb_per_game', 'def_reb_per_game', 'fg_made_attempted', 'three_pt_made_attempted', 'ft_made_attempted'].includes(key);
  const dataSrc = useSeason ? p : (src as typeof p);

  const n = period === 'last_5' ? 5 : period === 'last_10' ? 10 : 0;
  const log = (p.game_log ?? []) as GameLogEntry[];

  switch (key) {
    case 'games_played':
      if (usePeriodData?.games != null) return String(usePeriodData.games);
      if (period === 'last_5' || period === 'last_10') {
        return String(Math.min(n, log.length));
      }
      return p.games_played != null ? String(p.games_played) : null;
    case 'mpg': {
      if (period === 'last_5' || period === 'last_10') {
        const slice = log.slice(0, n).filter((g) => g.minutes != null);
        if (slice.length === 0) return null;
        const total = slice.reduce((sum, g) => sum + (g.minutes ?? 0), 0);
        return (total / slice.length).toFixed(1);
      }
      return (dataSrc.mpg ?? (dataSrc.total_minutes != null && dataSrc.games_played ? (dataSrc.total_minutes / dataSrc.games_played).toFixed(1) : null)) ?? null;
    }
    case 'ppg':
    case 'rpg':
    case 'apg':
    case 'spg':
    case 'bpg':
    case 'tpg': {
      if (period === 'last_5' || period === 'last_10') {
        const logField = GAME_LOG_STAT_KEYS[key] as keyof GameLogEntry;
        const val = avgFromGameLog(log, n, logField);
        if (val != null) return val;
      }
      return (dataSrc[key] as string) ?? null;
    }
    case 'fpg': {
      if (period === 'last_5' || period === 'last_10') {
        const val = avgFromGameLog(log, n, 'fouls');
        if (val != null) return val;
      }
      return (dataSrc.fpg as string) ?? null;
    }
    case 'plus_minus': {
      if (period === 'last_5' || period === 'last_10') {
        const val = avgFromGameLog(log, n, 'plus_minus');
        if (val != null) return val;
      }
      if (usePeriodData?.plus_minus != null) return usePeriodData.plus_minus;
      return p.plus_minus_avg ?? p.plus_minus ?? null;
    }
    case 'fg_pct':
    case 'three_pt_pct':
    case 'ft_pct': {
      if (period === 'last_5' || period === 'last_10') {
        const [madeKey, attemptedKey] =
          key === 'fg_pct'
            ? (['field_goals_made', 'field_goals_attempted'] as const)
            : key === 'three_pt_pct'
              ? (['three_point_made', 'three_point_attempted'] as const)
              : (['free_throws_made', 'free_throws_attempted'] as const);
        const val = pctFromGameLog(log, n, madeKey, attemptedKey);
        if (val != null) return `${val}%`;
      }
      return (dataSrc[key] as string) != null ? `${dataSrc[key]}%` : null;
    }
    case 'ts_pct':
      return dataSrc.ts_pct != null ? `${dataSrc.ts_pct}%` : null;
    case 'fg_made_attempted':
      if (dataSrc.total_field_goals_made == null || !dataSrc.games_played) return null;
      return `${(dataSrc.total_field_goals_made / dataSrc.games_played).toFixed(1)}/${((dataSrc.total_field_goals_attempted ?? 0) / dataSrc.games_played).toFixed(1)}`;
    case 'three_pt_made_attempted':
      if (dataSrc.total_three_point_made == null || !dataSrc.games_played) return null;
      return `${(dataSrc.total_three_point_made / dataSrc.games_played).toFixed(1)}/${((dataSrc.total_three_point_attempted ?? 0) / dataSrc.games_played).toFixed(1)}`;
    case 'ft_made_attempted':
      if (dataSrc.total_free_throws_made == null || !dataSrc.games_played) return null;
      return `${(dataSrc.total_free_throws_made / dataSrc.games_played).toFixed(1)}/${((dataSrc.total_free_throws_attempted ?? 0) / dataSrc.games_played).toFixed(1)}`;
    case 'off_reb_per_game':
      return dataSrc.total_offensive_rebounds != null && dataSrc.games_played
        ? (dataSrc.total_offensive_rebounds / dataSrc.games_played).toFixed(1)
        : null;
    case 'def_reb_per_game':
      return dataSrc.total_defensive_rebounds != null && dataSrc.games_played
        ? (dataSrc.total_defensive_rebounds / dataSrc.games_played).toFixed(1)
        : null;
    case 'total_points':
    case 'total_rebounds':
    case 'total_assists':
      const val = dataSrc[key as keyof typeof dataSrc];
      return val != null ? String(val) : null;
    default:
      return null;
  }
}

/**
 * Returns width percentage for N items per row. Accounts for gap (12px) between items.
 * 1 → 100%, 2 → 48%, 3 → 31%
 */
export function getStatCardWidthPercent(itemsPerRow: ItemsPerRow | undefined): string {
  if (itemsPerRow === 1) return '100%';
  if (itemsPerRow === 3) return '31%';
  return '48%'; // 2 per row (default)
}

/**
 * Stat section definitions. Group stats by row; set itemsPerRow (1, 2, or 3) per row.
 */
export function getStatSections(): StatSectionConfig[] {
  return [
    {
      title: 'Season Averages',
      rows: [
        { statKeys: ['ppg', 'mpg', 'plus_minus'], itemsPerRow: 3 },
        { statKeys: ['rpg', 'bpg', 'spg'], itemsPerRow: 3 },
        { statKeys: ['apg', 'tpg', 'fpg'], itemsPerRow: 3 },
      ],
    },
    {
      title: 'Shooting Statistics',
      shotChart: true,
      rows: [],
    },
  ];
}
