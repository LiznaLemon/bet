import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: null })),
    })),
  },
}));

import {
  computePlayerMatchupInsights,
  getMatchupEligiblePlayers,
} from '@/lib/utils/matchup-insights';
import type { Player } from '@/lib/types';

function stubPlayer(
  overrides: Pick<Player, 'athlete_id' | 'team_abbreviation' | 'ppg' | 'apg'> &
    Partial<Player>
): Player {
  return {
    athlete_display_name: 'Player',
    athlete_short_name: 'P',
    athlete_headshot_href: '',
    athlete_position_name: 'G',
    athlete_position_abbreviation: 'G',
    team_display_name: 'Team',
    team_logo: '',
    team_color: '#000',
    games_played: 20,
    rpg: '0',
    spg: '0',
    bpg: '0',
    tpg: '0',
    fpg: '0',
    mpg: '0',
    fg_pct: '0',
    three_pt_pct: '0',
    ft_pct: '0',
    total_points: 0,
    total_rebounds: 0,
    total_assists: 0,
    total_steals: 0,
    total_blocks: 0,
    total_turnovers: 0,
    total_fouls: 0,
    total_minutes: 0,
    total_field_goals_made: 0,
    total_field_goals_attempted: 0,
    total_three_point_made: 0,
    total_three_point_attempted: 0,
    total_free_throws_made: 0,
    total_free_throws_attempted: 0,
    total_offensive_rebounds: 0,
    total_defensive_rebounds: 0,
    total_plus_minus: 0,
    game_log: [],
    ...overrides,
  };
}

describe('getMatchupEligiblePlayers', () => {
  it('uses full away roster when activeAwayIds is empty', () => {
    const brunson = stubPlayer({
      athlete_id: '1',
      team_abbreviation: 'NYK',
      ppg: '25.9',
      apg: '6',
    });
    const miller = stubPlayer({
      athlete_id: '2',
      team_abbreviation: 'CHA',
      ppg: '20.3',
      apg: '4',
    });
    const eligible = getMatchupEligiblePlayers(
      [brunson, miller],
      'NYK',
      'CHA',
      new Set(),
      new Set(['2'])
    );
    expect(eligible.map((p) => p.athlete_id).sort()).toEqual(['1', '2']);
  });
});

describe('computePlayerMatchupInsights', () => {
  it('names away top scorer when activeAwayIds is empty and away has higher PPG', () => {
    const awayStar = stubPlayer({
      athlete_id: '1',
      athlete_display_name: 'Jalen Brunson',
      team_abbreviation: 'NYK',
      ppg: '25.9',
      apg: '6',
    });
    const homeStar = stubPlayer({
      athlete_id: '2',
      athlete_display_name: 'Brandon Miller',
      team_abbreviation: 'CHA',
      ppg: '20.3',
      apg: '4',
    });
    const insights = computePlayerMatchupInsights(
      { awayTeamAbbrev: 'NYK', homeTeamAbbrev: 'CHA' },
      [awayStar, homeStar],
      new Set(),
      new Set(['1', '2'])
    );
    const scoring = insights.find((s) => s.includes('scoring'));
    expect(scoring).toBeDefined();
    expect(scoring).toContain('Jalen Brunson');
    expect(scoring).toContain('25.9');
  });
});
