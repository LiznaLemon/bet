import { AddPropForm } from '@/components/add-prop-form';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedProps } from '@/hooks/use-persisted-props';
import { useGameBoxScores } from '@/lib/queries/game-boxscores';
import { useGame } from '@/lib/queries/schedule';
import { usePlayersForTeams } from '@/lib/queries/players-for-teams';
import type { Player } from '@/lib/types';
import type { PlayerProp } from '@/lib/types/props';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

const SEASON = 2026;

export default function SelectPropsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const { data: game, isLoading: gameLoading } = useGame(id, SEASON);
  const { data: playersForTeams = [] } = usePlayersForTeams(
    game?.awayTeamAbbrev,
    game?.homeTeamAbbrev,
    SEASON
  );
  const { data: boxScores = [] } = useGameBoxScores(id, SEASON);

  const [props, setProps] = usePersistedProps(id ?? undefined);

  const playersForForm: Player[] = useMemo(() => {
    const boxScorePlayers: Player[] = boxScores.map((b) => ({
      athlete_id: b.athlete_id,
      athlete_display_name: b.athlete_display_name,
      athlete_short_name: b.athlete_display_name?.split(' ').pop() ?? '',
      athlete_headshot_href: b.athlete_headshot_href,
      athlete_position_name: '',
      athlete_position_abbreviation: b.athlete_position_abbreviation,
      team_display_name: '',
      team_abbreviation: b.team_abbreviation,
      team_logo: '',
      team_color: b.team_color ?? '',
      games_played: 1,
      ppg: String(b.points),
      rpg: String(b.rebounds),
      apg: String(b.assists),
      spg: String(b.steals),
      bpg: String(b.blocks),
      tpg: '0',
      fpg: '0',
      mpg: String(b.minutes),
      fg_pct: '0',
      three_pt_pct: '0',
      ft_pct: '0',
      total_points: b.points,
      total_rebounds: b.rebounds,
      total_assists: b.assists,
      total_steals: b.steals,
      total_blocks: b.blocks,
      total_turnovers: 0,
      total_fouls: 0,
      total_minutes: b.minutes,
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
    }));

    if (playersForTeams.length === 0) return boxScorePlayers;

    const supabaseIds = new Set(playersForTeams.map((p) => p.athlete_id));
    const missing = boxScorePlayers.filter((p) => !supabaseIds.has(p.athlete_id));
    return missing.length > 0 ? [...playersForTeams, ...missing] : playersForTeams;
  }, [boxScores, playersForTeams]);

  const handleAddProp = useCallback(
    (prop: PlayerProp) => {
      setProps((prev) => [...prev, prop]);
    },
    [setProps]
  );

  if (!id) {
    return null;
  }

  if (gameLoading && !game) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <AddPropForm
        players={playersForForm}
        isLoading={!game}
        onAddProp={handleAddProp}
        onSubmitSelected={() => router.back()}
        minGamesRequired={0}
        onCourtPlayerIds={undefined}
        hideTitle
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
