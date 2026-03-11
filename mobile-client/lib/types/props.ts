export type PropStatKey =
  | 'points'
  | 'rebounds'
  | 'assists'
  | 'steals'
  | 'blocks'
  | 'minutes'
  | 'turnovers'
  | 'fouls'
  | 'two_pt_made'
  | 'three_pt_made'
  | 'free_throws_made';

export type PropType = 'over_under' | 'double_double' | 'triple_double';

export type SingleProp = {
  id: string;
  type: 'over_under';
  playerId: string;
  stat: PropStatKey;
  line: number;
  direction: 'over' | 'under';
};

export type CombinedProp = {
  id: string;
  type: 'double_double' | 'triple_double';
  playerId: string;
  stats: PropStatKey[];
};

export type PlayerProp = SingleProp | CombinedProp;

export function isSingleProp(prop: PlayerProp): prop is SingleProp {
  return prop.type === 'over_under';
}

export function isCombinedProp(prop: PlayerProp): prop is CombinedProp {
  return prop.type === 'double_double' || prop.type === 'triple_double';
}
