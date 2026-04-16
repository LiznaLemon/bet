import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { PlayerCard } from '@/components/player-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PlayerListSkeleton } from '@/components/ui/player-list-skeleton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFadeTransition } from '@/hooks/use-fade-transition';
import { usePlayersPaginated, type PaginatedPlayer } from '@/lib/queries/players';
import type { Player } from '@/lib/types';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';

type SortOption = 'ppg' | 'rpg' | 'apg' | '3pm' | 'spg' | 'bpg';

const ITEM_HEIGHT = 116; // Long layout height (100) + marginBottom (16)
const LIST_PADDING_TOP = 20;
const SEASON = 2026;

export default function PlayersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('ppg');
  const deferredSortBy = useDeferredValue(sortBy);

  const {
    data: paginatedData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePlayersPaginated(SEASON, searchQuery, deferredSortBy);

  const playersData: PaginatedPlayer[] = useMemo(
    () => paginatedData?.pages.flatMap((p) => p.players) ?? [],
    [paginatedData]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  const isSortPending = sortBy !== deferredSortBy;
  const listOpacity = useFadeTransition(sortBy, !isLoading && !isSortPending);

  const [cardLayout, setCardLayout] = useState<'default' | 'compact' | 'detailed' | 'wide' | 'long'>('long');
  const triggerMapRef = useRef<Record<string, number>>({});
  const triggerCounterRef = useRef(0);
  const hasAnimatedRef = useRef<Record<string, boolean>>({});
  const [animationVersion, setAnimationVersion] = useState(0);

  // Trigger bar chart animation only when item first enters viewport
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: Player; isViewable: boolean }[] }) => {
      if (viewableItems.length === 0) return;

      let hasNew = false;
      for (const { item, isViewable } of viewableItems) {
        if (isViewable && item && !(item.athlete_id in triggerMapRef.current)) {
          triggerMapRef.current[item.athlete_id] = ++triggerCounterRef.current;
          hasNew = true;
        }
      }
      if (hasNew) {
        setAnimationVersion(v => v + 1);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 50,
  }).current;

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleChartAnimationComplete = useCallback((playerId: string) => {
    hasAnimatedRef.current[playerId] = true;
  }, []);

  const renderPlayer = useCallback(
    ({ item }: { item: PaginatedPlayer }) => {
      const playerWithGameLog = {
        ...item,
        game_log: item.recent_game_log ?? item.game_log ?? [],
      };
      return (
        <PlayerCard
          player={playerWithGameLog}
          sortBy={deferredSortBy}
          colorScheme={colorScheme}
          layout={cardLayout}
          rank={item.stat_rank ?? undefined}
          qualified={item.qualified !== false}
          animationTrigger={triggerMapRef.current[item.athlete_id] ?? 0}
          skipChartAnimation={hasAnimatedRef.current[item.athlete_id] ?? false}
          onChartAnimationComplete={() => handleChartAnimationComplete(item.athlete_id)}
        />
      );
    },
    [deferredSortBy, colorScheme, cardLayout, handleChartAnimationComplete],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: LIST_PADDING_TOP + ITEM_HEIGHT * index,
      index,
    }),
    [],
  );
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          NBA Players
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>2026 Season Averages</ThemedText>
      </View>

      {/* Search Bar */}
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.cardBackground,
            color: colors.text,
          },
        ]}
        placeholder="Search by player or team..."
        placeholderTextColor={colors.tabIconDefault}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {/* Sort Options */}
      <View style={[styles.sortContainer, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.sortLabel, { color: colors.textSecondary }]}>Sort by:</ThemedText>
        <FilterOptionButtons
          options={[
            { key: 'ppg', label: 'Points' },
            { key: 'rpg', label: 'Rebounds' },
            { key: 'apg', label: 'Assists' },
            { key: '3pm', label: '3PT Made' },
            { key: 'spg', label: 'Steals' },
            { key: 'bpg', label: 'Blocks' },
          ]}
          value={sortBy}
          onSelect={(key) => setSortBy(key as SortOption)}
          colorScheme={colorScheme}
          scrollable
        />
      </View>

      {/* Results Count */}
      {/* <ThemedText style={styles.resultsCount}>
        {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
      </ThemedText> */}

      {/* Players List */}
      <View style={styles.listWrapper}>
        {isError && !isLoading ? (
          <ScrollView
            contentContainerStyle={styles.centerMessage}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={colors.tint}
              />
            }>
            <ThemedText style={styles.errorText}>Couldn&apos;t load players</ThemedText>
            <ThemedText style={[styles.errorSubtext, { color: colors.textSecondary }]}>
              {error instanceof Error ? error.message : 'Network or server error'}
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { borderColor: colors.tint }]}
              onPress={handleRefresh}>
              <ThemedText style={[styles.retryButtonText, { color: colors.tint }]}>
                Tap to retry
              </ThemedText>
            </Pressable>
          </ScrollView>
        ) : isLoading || isSortPending ? (
          <PlayerListSkeleton />
        ) : (
          <Animated.View style={[styles.listAnimatedWrapper, { opacity: listOpacity }]}>
            <FlatList
              data={playersData}
              renderItem={renderPlayer}
              keyExtractor={item => item.athlete_id}
              contentContainerStyle={[
                styles.listContent,
                playersData.length === 0 && styles.listContentEmpty,
              ]}
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              extraData={animationVersion}
              initialNumToRender={8}
              maxToRenderPerBatch={10}
              windowSize={11}
              removeClippedSubviews={Platform.OS === 'android'}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching && !isFetchingNextPage}
                  onRefresh={handleRefresh}
                  tintColor={colors.tint}
                />
              }
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ThemedText style={[styles.errorSubtext, { color: colors.textSecondary }]}>
                      Loading more…
                    </ThemedText>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.centerMessage}>
                  <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {searchQuery ? 'No players match your search' : 'No players found'}
                  </ThemedText>
                </View>
              }
            />
          </Animated.View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  searchInput: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  sortContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listWrapper: {
    flex: 1,
  },
  listAnimatedWrapper: {
    flex: 1,
  },
  sortLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  resultsCount: {
    paddingHorizontal: 20,
    fontSize: 12,
    marginBottom: 12,
    width: '100%',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 20,
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
