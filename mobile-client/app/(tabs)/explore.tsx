import { AddPropForm } from '@/components/add-prop-form';
import { PropCard } from '@/components/prop-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePlayers } from '@/lib/queries/players';
import { useSchedule } from '@/lib/queries/schedule';
import type { Player } from '@/lib/types';
import type { PlayerProp } from '@/lib/types/props';
import { useCallback, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

export default function ExploreScreen() {
  const { data: players = [], isLoading: playersLoading, refetch: refetchPlayers } = usePlayers();
  const { data: scheduleGames = [] } = useSchedule();
  const [props, setProps] = useState<PlayerProp[]>([]);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    for (const p of players) {
      map.set(p.athlete_id, p);
    }
    return map;
  }, [players]);

  const handleAddProp = useCallback((prop: PlayerProp) => {
    setProps((prev) => [...prev, prop]);
  }, []);

  const handleRemoveProp = useCallback((propId: string) => {
    setProps((prev) => prev.filter((p) => p.id !== propId));
  }, []);

  const handleRefresh = useCallback(() => {
    refetchPlayers();
  }, [refetchPlayers]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={playersLoading} onRefresh={handleRefresh} />
        }>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Props Builder
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Test player props and see historical hit rates
          </ThemedText>
        </View>

        <AddPropForm
          players={players}
          isLoading={playersLoading}
          onAddProp={handleAddProp}
          hideTitle={true}
          paginationSeason={2026}
        />

        <View style={styles.propsSection}>
          <ThemedText style={styles.sectionTitle}>
            Your Props ({props.length})
          </ThemedText>
          {props.length === 0 ? (
            <ThemedText style={styles.emptyState}>
              Add a prop above to see historical hit rates and insights.
            </ThemedText>
          ) : (
            props.map((prop) => (
              <PropCard
                key={prop.id}
                prop={prop}
                player={playerMap.get(prop.playerId) ?? null}
                scheduleGames={scheduleGames}
                otherPropsForSamePlayer={props.filter((p) => p.playerId === prop.playerId && p.id !== prop.id)}
                onRemove={handleRemoveProp}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    // marginBottom: 20,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  propsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyState: {
    fontSize: 14,
    opacity: 0.7,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
