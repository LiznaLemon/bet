import { FilterOptionButtons } from '@/components/filter-option-buttons';
import { PlayerCard } from '@/components/player-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePlayers } from '@/lib/queries/players';
import { useSchedule } from '@/lib/queries/schedule';
import type { Player } from '@/lib/types';
import { getTeamGamesByAbbrev, qualifiesForCategory } from '@/lib/utils/player-qualification';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type SortOption = 'ppg' | 'rpg' | 'apg' | '3pm' | 'spg' | 'bpg';

const ITEM_HEIGHT = 116; // Long layout height (100) + marginBottom (16)
const LIST_PADDING_TOP = 20;

export default function PlayersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { data: playersData = [], isLoading, isError, error, refetch, isRefetching } = usePlayers();
  const { data: scheduleData = [] } = useSchedule();

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('ppg');
  const deferredSortBy = useDeferredValue(sortBy);
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

  const overlayOpacity = useSharedValue(0);
  const [showOverlay, setShowOverlay] = useState(false);

  const handleSortPress = useCallback((key: SortOption) => {
    setSortBy(key);
    setShowOverlay(true);
    overlayOpacity.value = 1;
    overlayOpacity.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(setShowOverlay)(false);
    });
  }, []);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const teamGamesByAbbrev = useMemo(
    () => getTeamGamesByAbbrev(scheduleData),
    [scheduleData]
  );

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return playersData.filter((player: Player) =>
      player.athlete_display_name.toLowerCase().includes(query) ||
      player.team_abbreviation.toLowerCase().includes(query),
    );
  }, [playersData, searchQuery]);

  const filteredPlayers = useMemo(() => {
    const qualified = filtered.filter((p: Player) =>
      qualifiesForCategory(p, deferredSortBy, teamGamesByAbbrev)
    );
    if (deferredSortBy === '3pm') {
      const get3pm = (p: Player) =>
        (p.total_three_point_made ?? 0) / Math.max(1, p.games_played ?? 1);
      return qualified.sort((a, b) => get3pm(b) - get3pm(a));
    }
    return qualified.sort((a, b) =>
      parseFloat(b[deferredSortBy]) - parseFloat(a[deferredSortBy])
    );
  }, [filtered, deferredSortBy, teamGamesByAbbrev]);

  const handleChartAnimationComplete = useCallback((playerId: string) => {
    hasAnimatedRef.current[playerId] = true;
  }, []);

  const renderPlayer = useCallback(
    ({ item }: { item: Player }) => (
      <PlayerCard
        player={item}
        sortBy={deferredSortBy}
        colorScheme={colorScheme}
        layout={cardLayout}
        animationTrigger={triggerMapRef.current[item.athlete_id] ?? 0}
        skipChartAnimation={hasAnimatedRef.current[item.athlete_id] ?? false}
        onChartAnimationComplete={() => handleChartAnimationComplete(item.athlete_id)}
      />
    ),
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
        <ThemedText style={styles.subtitle}>2026 Season Averages</ThemedText>
      </View>

      {/* Search Bar */}
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: Colors[colorScheme].cardBackground,
            color: Colors[colorScheme].text,
          },
        ]}
        placeholder="Search by player or team..."
        placeholderTextColor={Colors[colorScheme].tabIconDefault}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {/* Layout Toggle (for testing - can remove later) */}
      <View style={styles.sortContainer}>
        {/* <ThemedText style={styles.sortLabel}>Layout:</ThemedText> */}
        {/* <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortButtons}
        >
          {[
            { key: 'default' as const, label: 'Default' },
            { key: 'compact' as const, label: 'Compact' },
            { key: 'detailed' as const, label: 'Detailed' },
            { key: 'wide' as const, label: 'Wide' },
            { key: 'long' as const, label: 'Long' },
          ].map(option => {
            const isActive = cardLayout === option.key;
            
            return (
              <Pressable
                key={option.key}
                style={({ pressed }) => [
                  styles.sortButton,
                  {
                    backgroundColor: Colors[colorScheme].cardBackground,
                    opacity: pressed ? 0.7 : 1,
                  },
                  isActive && {
                    borderWidth: 1,
                    borderColor: Colors[colorScheme].tint,
                  },
                ]}
                onPress={() => setCardLayout(option.key)}>
                <ThemedText
                  style={[
                    styles.sortButtonText,
                    isActive && styles.sortButtonTextActive,
                  ]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView> */}
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <ThemedText style={styles.sortLabel}>Sort by:</ThemedText>
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
          onSelect={(key) => handleSortPress(key as SortOption)}
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
        {isLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            <ThemedText style={[styles.loading, { marginTop: 12 }]}>Loading players...</ThemedText>
          </View>
        ) : isError ? (
          <ScrollView
            contentContainerStyle={styles.centerMessage}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={Colors[colorScheme].tint}
              />
            }>
            <ThemedText style={styles.errorText}>Failed to load players</ThemedText>
            <ThemedText style={[styles.errorSubtext, { color: Colors[colorScheme].secondaryText }]}>
              {error instanceof Error ? error.message : 'Network or server error'}
            </ThemedText>
            <ThemedText style={[styles.errorSubtext, { color: Colors[colorScheme].secondaryText, marginTop: 12 }]}>
              Pull down to refresh or tap Retry
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { backgroundColor: Colors[colorScheme].tint }]}
              onPress={handleRefresh}>
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </Pressable>
          </ScrollView>
        ) : (
          <FlatList
            data={filteredPlayers}
            renderItem={renderPlayer}
            keyExtractor={item => item.athlete_id}
            contentContainerStyle={[
              styles.listContent,
              filteredPlayers.length === 0 && styles.listContentEmpty,
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
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={Colors[colorScheme].tint}
              />
            }
            ListEmptyComponent={
              filteredPlayers.length === 0 ? (
                <View style={styles.centerMessage}>
                  <ThemedText style={styles.emptyText}>
                    {searchQuery ? 'No players match your search' : 'No players found'}
                  </ThemedText>
                </View>
              ) : null
            }
          />
        )}
        {showOverlay && (
          <Animated.View
            style={[
              styles.sortOverlay,
              { backgroundColor: Colors[colorScheme].background },
              overlayAnimatedStyle,
            ]}
            pointerEvents="none"
          />
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
    opacity: 0.6,
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
    marginBottom: 12,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  sortOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sortLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  resultsCount: {
    paddingHorizontal: 20,
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 12,
    width: '100%',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 20,
  },
  loading: {
    paddingHorizontal: 20,
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
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
    // backgroundColor: '#000000',
    // borderWidth: 1,
    // borderColor: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
