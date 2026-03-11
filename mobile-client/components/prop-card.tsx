import { InsightCarousel } from '@/components/insight-carousel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Player } from '@/lib/types';
import type { PlayerProp } from '@/lib/types/props';
import {
  computeHitRate,
  computePropInsights,
  formatPropDescription,
} from '@/lib/props/compute-prop-stats';
import type { GameLogEntry, ScheduleGame } from '@/lib/types';
import { Image } from 'expo-image';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type PropCardProps = {
  prop: PlayerProp;
  player: Player | null;
  scheduleGames: ScheduleGame[];
  otherPropsForSamePlayer?: PlayerProp[];
  onRemove: (propId: string) => void;
};

export function PropCard({ prop, player, scheduleGames, otherPropsForSamePlayer = [], onRemove }: PropCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const gameLog = (player?.game_log ?? []) as GameLogEntry[];
  const hitRate = useMemo(() => computeHitRate(gameLog, prop), [gameLog, prop]);
  const insights = useMemo(
    () =>
      player
        ? computePropInsights(player, prop, hitRate, scheduleGames, otherPropsForSamePlayer)
        : [],
    [player, prop, hitRate, scheduleGames, otherPropsForSamePlayer]
  );

  const handleRemove = useCallback(() => {
    onRemove(prop.id);
  }, [prop.id, onRemove]);

  if (!player) {
    return (
      <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <ThemedText style={styles.placeholder}>Player not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.playerRow}>
          <Image source={{ uri: player.athlete_headshot_href }} style={[styles.headshot, { backgroundColor: colors.border }]} />
          <View style={styles.playerInfo}>
            <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            <ThemedText style={styles.propDescription}>{formatPropDescription(prop)}</ThemedText>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.removeButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={handleRemove}
          accessibilityLabel="Remove prop">
          <ThemedText style={[styles.removeButtonText, { color: colors.tint }]}>Remove</ThemedText>
        </Pressable>
      </View>

      <View style={styles.hitRateRow}>
        <ThemedText style={styles.hitRateLabel}>Historical hit rate</ThemedText>
        <ThemedText style={[styles.hitRateValue, { color: colors.tint }]}>
          {hitRate.hitCount}/{hitRate.totalGames} ({(hitRate.hitRate * 100).toFixed(0)}%)
        </ThemedText>
      </View>

      {insights.length > 0 && (
        <InsightCarousel insights={insights} style={styles.insights} cycleDurationMs={5000} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headshot: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  propDescription: {
    fontSize: 14,
    marginTop: 2,
    opacity: 0.85,
  },
  removeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  hitRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hitRateLabel: {
    fontSize: 13,
    opacity: 0.8,
  },
  hitRateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  insights: {
    marginTop: 4,
  },
  placeholder: {
    fontSize: 14,
    opacity: 0.7,
  },
});
