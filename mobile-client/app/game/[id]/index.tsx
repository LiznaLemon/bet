import { GameLiveView } from '@/components/game-live-view';
import { GameMatchupView } from '@/components/game-matchup-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GameMatchupSkeleton } from '@/components/ui/game-matchup-skeleton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFadeTransition } from '@/hooks/use-fade-transition';
import { usePersistedProps } from '@/hooks/use-persisted-props';
import { useESPNLiveGame } from '@/lib/queries/espn-live-game';
import { useStoredInjuries } from '@/lib/queries/game-injury-reports';
import { useGameBoxScores } from '@/lib/queries/game-boxscores';
import { usePlayByPlay } from '@/lib/queries/play-by-play';
import { usePlayersForTeams } from '@/lib/queries/players-for-teams';
import { useGame } from '@/lib/queries/schedule';
import type { PlayerProp } from '@/lib/types/props';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const SEASON = 2026;

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const headerHeight = useHeaderHeight();

  const [props, setProps, refreshFromStorage] = usePersistedProps(id ?? undefined);

  const { data: game, isLoading: gameLoading, isError: gameError, refetch: refetchGame } = useGame(id, SEASON);
  const { data: players = [], isLoading: playersLoading } = usePlayersForTeams(
    game?.awayTeamAbbrev,
    game?.homeTeamAbbrev,
    SEASON
  );
  const { data: boxScores = [] } = useGameBoxScores(id, SEASON);
  const { data: supabasePlays = [], isLoading: playsLoading } = usePlayByPlay(id, SEASON);

  const useESPN = !playsLoading && supabasePlays.length === 0;
  const { data: espnData } = useESPNLiveGame(id, { enabled: !!id && useESPN });
  const { data: storedSnapshot } = useStoredInjuries(id, game?.completed ?? false);
  /** Only treat as live when game is actually in progress — not scheduled/preview (which also have isFinal: false) */
  const isLiveESPN = useESPN && espnData && espnData.statusName === 'STATUS_IN_PROGRESS';

  /**
   * ESPN has fresher game times than the DB (which only syncs once daily).
   * For upcoming games, override gameTime with ESPN's current shortDetail.
   */
  const gameWithFreshTime = useMemo(() => {
    if (!game || game.completed || !espnData?.statusShortDetail) return game;
    const parts = espnData.statusShortDetail.split(' - ');
    const espnTime = parts.length > 1 ? parts[1].trim() : null;
    if (!espnTime || espnTime === game.gameTime) return game;
    return { ...game, gameTime: espnTime };
  }, [game, espnData?.statusShortDetail]);

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

  // Fade in the matchup tab content once the primary data is ready
  const matchupReady = !gameLoading && !playersLoading && !!game;
  const matchupOpacity = useFadeTransition(id, matchupReady);

  if (!id) {
    return (
      <>
        <Stack.Screen options={{ title: 'Game' }} />
        <ThemedView style={[styles.center, { paddingTop: headerHeight }]}>
          <ThemedText>Invalid game</ThemedText>
        </ThemedView>
      </>
    );
  }

  const title = game ? `${game.awayTeamAbbrev} @ ${game.homeTeamAbbrev}` : 'Game';
  const liveTabLabel = isLiveESPN ? 'Live' : game?.completed ? 'Replay' : 'Props Simulator';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        {/* Tab bar */}
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, zIndex: 10, elevation: 2 },
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
          <View style={styles.tabContent}>
            {gameError && !game ? (
              // Hard failure — show retry at full opacity
              <ScrollView contentContainerStyle={styles.center}>
                <ThemedText style={[styles.errorText, { color: colors.secondaryText }]}>
                  Couldn't load game
                </ThemedText>
                <Pressable
                  onPress={() => void refetchGame()}
                  style={[styles.retryBtn, { borderColor: colors.tint }]}>
                  <ThemedText style={[styles.retryText, { color: colors.tint }]}>
                    Tap to retry
                  </ThemedText>
                </Pressable>
              </ScrollView>
            ) : !matchupReady ? (
              // Skeleton at full opacity while loading
              <GameMatchupSkeleton />
            ) : (
              // Content fades in when ready
              <Animated.View style={[styles.tabContent, { opacity: matchupOpacity }]}>
                <GameMatchupView
                  game={gameWithFreshTime ?? game!}
                  players={players}
                  boxScores={boxScores}
                  injuries={
                    game?.completed
                      ? (storedSnapshot?.injuries.length
                          ? storedSnapshot.injuries
                          : (espnData?.injuries ?? []))
                      : (espnData?.injuries ?? [])
                  }
                  injurySnapshotCapturedAt={
                    game?.completed ? (storedSnapshot?.capturedAt ?? undefined) : undefined
                  }
                  liveDataFetchedAt={game?.completed ? undefined : espnData?.fetchedAt}
                />
              </Animated.View>
            )}
          </View>
        ) : game ? (
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
        ) : (
          <GameMatchupSkeleton />
        )}
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
    paddingBottom: 0,
    borderBottomWidth: 1,
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
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
