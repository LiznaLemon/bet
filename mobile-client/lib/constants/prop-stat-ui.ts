import type { PropStatKey } from '@/lib/types/props';

/** Filter pill options for Over/Under props and Season Leaders — same order/labels everywhere. */
export const PROP_STAT_OPTIONS: { key: PropStatKey; label: string }[] = [
  { key: 'points', label: 'PTS' },
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'minutes', label: 'MIN' },
  { key: 'turnovers', label: 'TOV' },
  { key: 'fouls', label: 'PF' },
  { key: 'two_pt_made', label: '2PT' },
  { key: 'three_pt_made', label: '3PT' },
  { key: 'free_throws_made', label: 'FT' },
];

/** Per-game labels next to averages (PPG, MPG, 2PM, …). */
export const PROP_STAT_PLAYER_ROW_LABEL: Record<PropStatKey, string> = {
  points: 'PPG',
  rebounds: 'RPG',
  assists: 'APG',
  steals: 'SPG',
  blocks: 'BPG',
  minutes: 'MPG',
  turnovers: 'TPG',
  fouls: 'FPG',
  two_pt_made: '2PM',
  three_pt_made: '3PM',
  free_throws_made: 'FTM',
};
