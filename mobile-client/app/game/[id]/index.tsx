import { GameLiveView } from '@/components/game-live-view';
import { GameMatchupView } from '@/components/game-matchup-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedProps } from '@/hooks/use-persisted-props';
import { useESPNLiveGame } from '@/lib/queries/espn-live-game';
import { useGameBoxScores } from '@/lib/queries/game-boxscores';
import { usePlayByPlay } from '@/lib/queries/play-by-play';
import { usePlayersForTeams } from '@/lib/queries/players-for-teams';
import { useGame } from '@/lib/queries/schedule';
import type { PlayerProp } from '@/lib/types/props';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const SEASON = 2026;

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [props, setProps, refreshFromStorage] = usePersistedProps(id ?? undefined);

  const { data: game, isLoading: gameLoading } = useGame(id, SEASON);
  const { data: players = [], isLoading: playersLoading } = usePlayersForTeams(
    game?.awayTeamAbbrev,
    game?.homeTeamAbbrev,
    SEASON
  );
  const { data: boxScores = [] } = useGameBoxScores(id, SEASON);
  const { data: supabasePlays = [], isLoading: playsLoading } = usePlayByPlay(id, SEASON);

  const useESPN = !playsLoading && supabasePlays.length === 0;
  const { data: espnData } = useESPNLiveGame(id, { enabled: !!id && useESPN });
  /** Only treat as live when game is actually in progress — not scheduled/preview (which also have isFinal: false) */
  const isLiveESPN = useESPN && espnData && espnData.statusName === 'STATUS_IN_PROGRESS';

  const [activeTab, setActiveTab] = useState<'matchup' | 'live'>('matchup');

  useFocusEffect(
    useCallback(() => {
      refreshFromStorage();
    }, [refreshFromStorage])
  );

  useEffect(() => {
    if (game?.completed || isLiveESPN) {
      setActiveTab('live');
    } else {
      setActiveTab('matchup');
    }
  }, [game?.completed, isLiveESPN]);

  if (!id) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={styles.center}>
          <ThemedText>Invalid game</ThemedText>
        </ThemedView>
      </>
    );
  }

  if (gameLoading && !game) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading game...
          </ThemedText>
        </ThemedView>
      </>
    );
  }

  if (!game) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={styles.center}>
          <ThemedText>Game not found</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText style={{ color: colors.tint }}>Go back</ThemedText>
          </Pressable>
        </ThemedView>
      </>
    );
  }

  const title = `${game.awayTeamAbbrev} @ ${game.homeTeamAbbrev}`;
  const liveTabLabel = isLiveESPN ? 'Live' : game.completed ? 'Replay' : 'Sim';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ThemedView style={styles.container}>
        {/* Persistent header: tab bar only — score moved to card in content area */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
              zIndex: 10,
              elevation: 2,
            },
          ]}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'matchup' && [styles.tabItemActive, { borderBottomColor: colors.tint }],
              ]}
              onPress={() => setActiveTab('matchup')}
              activeOpacity={0.7}>
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'matchup' ? colors.tint : colors.secondaryText },
                ]}>
                Matchup
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'live' && [styles.tabItemActive, { borderBottomColor: colors.tint }],
              ]}
              onPress={() => setActiveTab('live')}
              activeOpacity={0.7}>
              <View style={styles.tabLabelRow}>
                {isLiveESPN && (
                  <View style={[styles.liveTabDot, { backgroundColor: '#e53935' }]} />
                )}
                <ThemedText
                  style={[
                    styles.tabLabel,
                    { color: activeTab === 'live' ? colors.tint : colors.secondaryText },
                  ]}>
                  {liveTabLabel}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab content */}
        {activeTab === 'matchup' ? (
          <GameMatchupView
            game={game}
            players={players}
            boxScores={boxScores}
            injuries={espnData?.injuries ?? []}
          />
        ) : (
          <GameLiveView
            game={game}
            plays={supabasePlays}
            playsLoading={playsLoading}
            supabaseBoxScores={boxScores}
            espnData={espnData}
            playersForTeams={players}
            props={props}
            setProps={setProps as (updater: (prev: PlayerProp[]) => PlayerProp[]) => void}
          />
        )}
      </ThemedView>
    </>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
  },
  backBtn: {
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  liveTabDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
