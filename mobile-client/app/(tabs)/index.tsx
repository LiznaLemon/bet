import { GameMatchupDisplay } from '@/components/game-matchup-display';
import {
  SCHEDULE_FETCH_DAYS_FUTURE,
  SCHEDULE_FETCH_DAYS_PAST,
  ScheduleDateFilter,
} from '@/components/schedule-date-filter';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getGamesForDate, type ScheduleGame } from '@/constants/schedule';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScheduleForSelectedDate } from '@/lib/queries/schedule';
import { getLocalDateStr } from '@/lib/utils/date';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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
}: {
  game: ScheduleGame;
  colorScheme: 'light' | 'dark';
  scheduleGames: ScheduleGame[];
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
        />
      </View>
    </Pressable>
  );
}

export default function ScheduleScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());
  const { data: scheduleData = [], isLoading, refetch, isRefetching } = useScheduleForSelectedDate(
    selectedDate,
    2026,
    { daysPast: SCHEDULE_FETCH_DAYS_PAST, daysFuture: SCHEDULE_FETCH_DAYS_FUTURE }
  );

  const games = useMemo(() => {
    return getGamesForDate(scheduleData, selectedDate);
  }, [scheduleData, selectedDate]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Schedule
        </ThemedText>
      </View>
      <View style={styles.monthSection}>
        <ThemedText style={[styles.monthLabel, { color: Colors[colorScheme].secondaryText }]}>
          {formatMonthYear(selectedDate)}
        </ThemedText>
      </View>
      <ScheduleDateFilter
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        colorScheme={colorScheme}
      />

      {isLoading ? (
        <ThemedText style={styles.loading}>Loading schedule...</ThemedText>
      ) : games.length === 0 ? (
        <ThemedText style={[styles.emptyState, { color: Colors[colorScheme].secondaryText }]}>
          No games scheduled for this day
        </ThemedText>
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
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  gameCard: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  gameCardContent: {
    padding: 16,
  },
  gameCardPressed: {
    opacity: 0.9,
  },
  loading: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});
