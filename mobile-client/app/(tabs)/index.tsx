import { GameMatchupDisplay } from '@/components/game-matchup-display';
import {
  SCHEDULE_FETCH_DAYS_FUTURE,
  SCHEDULE_FETCH_DAYS_PAST,
  ScheduleDateFilter,
} from '@/components/schedule-date-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GameCardSkeletonList } from '@/components/ui/game-card-skeleton';
import { getGamesForDate, type ScheduleGame } from '@/constants/schedule';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFadeTransition } from '@/hooks/use-fade-transition';
import { useESPNScoreboardInfo } from '@/lib/queries/espn-scoreboard';
import { useScheduleForSelectedDate } from '@/lib/queries/schedule';
import { getLocalDateStr } from '@/lib/utils/date';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
  return (
    <Pressable
      style={({ pressed }) => [
        styles.gameCard,
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
        <ThemedText style={[styles.monthLabel, { color: colors.secondaryText }]}>
          {formatMonthYear(selectedDate)}
        </ThemedText>
        {!isToday && (
          <Pressable
            onPress={() => setSelectedDate(today)}
            style={[styles.todayBtn, { borderColor: colors.tint }]}>
            <ThemedText style={[styles.todayBtnText, { color: colors.tint }]}>Today</ThemedText>
          </Pressable>
        )}
      </View>
      <ScheduleDateFilter
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        colorScheme={colorScheme}
      />

      <View style={styles.listArea}>
        {showSkeleton ? (
          // Skeleton renders at full opacity — no fade wrapper
          <View style={styles.listContent}>
            <GameCardSkeletonList count={4} />
          </View>
        ) : (
          // Content fades in once data is ready
          <Animated.View style={[styles.listArea, { opacity: listOpacity }]}>
            {isError ? (
              <View style={styles.stateContainer}>
                <ThemedText style={[styles.stateText, { color: colors.secondaryText }]}>
                  Couldn't load schedule
                </ThemedText>
                <Pressable onPress={() => void refetch()} style={[styles.retryBtn, { borderColor: colors.tint }]}>
                  <ThemedText style={[styles.retryText, { color: colors.tint }]}>Tap to retry</ThemedText>
                </Pressable>
              </View>
            ) : games.length === 0 ? (
              <View style={styles.stateContainer}>
                <ThemedText style={[styles.stateText, { color: colors.secondaryText }]}>
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
    borderColor: 'rgba(128, 128, 128, 0.25)',
    overflow: 'hidden',
  },
  gameCardContent: {
    padding: 16,
  },
  gameCardPressed: {
    opacity: 0.9,
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
