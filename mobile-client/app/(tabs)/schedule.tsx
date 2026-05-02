import { GameMatchupDisplay } from '@/components/game-matchup-display';
import {
  SCHEDULE_FETCH_DAYS_FUTURE,
  SCHEDULE_FETCH_DAYS_PAST,
  ScheduleDateFilter,
} from '@/components/schedule-date-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GameCardSkeletonList } from '@/components/ui/game-card-skeleton';
import { findNearestGameDate, getGamesForDate, type ScheduleGame } from '@/constants/schedule';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFadeTransition } from '@/hooks/use-fade-transition';
import { useESPNScoreboardInfo } from '@/lib/queries/espn-scoreboard';
import { useScheduleForSelectedDate } from '@/lib/queries/schedule';
import { getLocalDateStr } from '@/lib/utils/date';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

/** Parse YYYY-MM-DD as local date (avoids UTC midnight shifting to previous day in US timezones) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatMonthYear(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function GameCard({
  game,
  colorScheme,
  scheduleGames,
  liveLabel,
}: {
  game: ScheduleGame;
  colorScheme: 'light' | 'dark';
  scheduleGames: ScheduleGame[];
  liveLabel?: string;
}) {
  const colors = Colors[colorScheme];
  return (
    <Pressable
      style={({ pressed }) => [
        styles.gameCard,
        { borderColor: colors.dividerSubtle },
        pressed && styles.gameCardPressed,
      ]}
      onPress={() => router.push(`/game/${game.id}`)}>
      <View style={styles.gameCardContent}>
        <GameMatchupDisplay
          game={game}
          colorScheme={colorScheme}
          scheduleGames={scheduleGames}
          liveLabel={liveLabel}
        />
      </View>
      <View style={[styles.cardFooterDivider, { backgroundColor: colors.dividerSubtle }]} />
      <View style={styles.cardFooter}>
        <ThemedText style={[styles.cardFooterLabel, { color: colors.textSecondary }]}>
          Game Details
        </ThemedText>
        <View style={[styles.cardFooterCircle, { borderColor: colors.dividerSubtle }]}>
          <ThemedText style={[styles.cardFooterChevron, { color: colors.textSecondary }]}>›</ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

export default function ScheduleScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());

  const {
    data: scheduleData = [],
    isLoading,
    isFetching,
    isError,
    refetch,
    isRefetching,
  } = useScheduleForSelectedDate(selectedDate, 2026, {
    daysPast: SCHEDULE_FETCH_DAYS_PAST,
    daysFuture: SCHEDULE_FETCH_DAYS_FUTURE,
  });

  const today = getLocalDateStr();
  const isToday = selectedDate === today;

  // Auto-jump to the nearest date with games on first load.
  // Uses a ref so manual date changes by the user are never overridden.
  const hasAutoJumped = useRef(false);
  useEffect(() => {
    if (isLoading || isFetching || !scheduleData.length || hasAutoJumped.current) return;
    hasAutoJumped.current = true;
    if (getGamesForDate(scheduleData, today).length > 0) return;
    const nearest = findNearestGameDate(scheduleData, today);
    if (nearest && nearest !== today) setSelectedDate(nearest);
  }, [isLoading, isFetching, scheduleData, today]);

  const { data: scoreboardInfo } = useESPNScoreboardInfo(selectedDate, isToday);

  const games = useMemo(() => {
    const raw = getGamesForDate(scheduleData, selectedDate);
    if (!scoreboardInfo?.size) return raw;
    return raw.map((g) => {
      const info = scoreboardInfo.get(`${g.awayTeamAbbrev}@${g.homeTeamAbbrev}`);
      if (!info?.timeOverride || g.completed) return g;
      if (info.timeOverride === g.gameTime) return g;
      return { ...g, gameTime: info.timeOverride };
    });
  }, [scheduleData, selectedDate, scoreboardInfo]);

  const isReady = !isLoading && !isFetching;
  const listOpacity = useFadeTransition(selectedDate, isReady);

  const showSkeleton = isLoading || isFetching;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Schedule
        </ThemedText>
      </View>
      <View style={styles.monthSection}>
        <ThemedText style={[styles.monthLabel, { color: colors.textSecondary }]}>
          {formatMonthYear(selectedDate)}
        </ThemedText>
        <Pressable
          onPress={() => setSelectedDate(today)}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          accessibilityState={{ disabled: isToday }}
          accessibilityElementsHidden={isToday}
          importantForAccessibility={isToday ? 'no' : 'yes'}
          style={({ pressed }) => [
            styles.todayBtn,
            { borderColor: colors.tint },
            isToday ? styles.todayBtnHidden : pressed && styles.todayBtnPressed,
          ]}>
          <ThemedText style={[styles.todayBtnText, { color: colors.tint }]}>Today</ThemedText>
        </Pressable>
      </View>
      <ScheduleDateFilter
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        colorScheme={colorScheme}
      />

      <View style={styles.listArea}>
        {showSkeleton ? (
          <View style={styles.listContent}>
            <GameCardSkeletonList count={4} />
          </View>
        ) : (
          <Animated.View style={[styles.listArea, { opacity: listOpacity }]}>
            {isError ? (
              <View style={styles.stateContainer}>
                <ThemedText style={[styles.stateText, { color: colors.textSecondary }]}>
                  Couldn&apos;t load schedule
                </ThemedText>
                <Pressable onPress={() => void refetch()} style={[styles.retryBtn, { borderColor: colors.tint }]}>
                  <ThemedText style={[styles.retryText, { color: colors.tint }]}>Tap to retry</ThemedText>
                </Pressable>
              </View>
            ) : games.length === 0 ? (
              <View style={styles.stateContainer}>
                <ThemedText style={[styles.stateText, { color: colors.textSecondary }]}>
                  No games scheduled for this day
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={games}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <GameCard
                    game={item}
                    colorScheme={colorScheme}
                    scheduleGames={scheduleData}
                    liveLabel={
                      scoreboardInfo?.get(`${item.awayTeamAbbrev}@${item.homeTeamAbbrev}`)
                        ?.liveLabel ?? undefined
                    }
                  />
                )}
                windowSize={5}
                maxToRenderPerBatch={4}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefetching && !isLoading}
                    onRefresh={() => refetch()}
                  />
                }
              />
            )}
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
    paddingBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  monthSection: {
    paddingHorizontal: 20,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  /** Keeps row height/width stable when viewing today (button still in layout). */
  todayBtnHidden: {
    opacity: 0,
  },
  todayBtnPressed: {
    opacity: 0.7,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  gameCard: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gameCardContent: {
    padding: 16,
  },
  gameCardPressed: {
    opacity: 0.9,
  },
  cardFooterDivider: {
    height: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cardFooterLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardFooterCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterChevron: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
    includeFontPadding: false,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  stateText: {
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
