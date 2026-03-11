import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { GameLogEntry } from '@/lib/types';
import {
  getNoteworthyBadges,
  type NoteworthyBadge,
  type SimilarPlayerWithGames,
} from '@/lib/utils/player-similarity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function BadgeChip({
  badge,
  colorScheme,
}: {
  badge: NoteworthyBadge;
  colorScheme: 'light' | 'dark';
}) {
  const labels: Record<NoteworthyBadge, string> = {
    season_high: 'Season high',
    top_10_pct: 'Top 10%',
    best_vs_team: 'Best vs team',
  };
  return (
    <View style={[styles.badgeChip, { backgroundColor: Colors[colorScheme].tint + '30' }]}>
      <ThemedText style={[styles.badgeText, { color: Colors[colorScheme].tint }]}>
        {labels[badge]}
      </ThemedText>
    </View>
  );
}

type SimilarPlayersModalProps = {
  visible: boolean;
  onClose: () => void;
  sourcePlayerName: string;
  similarPlayers: SimilarPlayerWithGames[] | null;
  opponentAbbrev: string;
  isLoading?: boolean;
};

export function SimilarPlayersModal({
  visible,
  onClose,
  sourcePlayerName,
  similarPlayers,
  opponentAbbrev,
  isLoading = false,
}: SimilarPlayersModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.content,
            { backgroundColor: colors.background, paddingTop: insets.top },
          ]}
          pointerEvents="box-none">
          <View style={styles.header}>
            <ThemedText style={styles.title}>Similar Players vs {opponentAbbrev}</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.secondaryText }]}>
              Players like {sourcePlayerName}
            </ThemedText>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.7}
              style={styles.closeBtn}>
              <ThemedText style={[styles.closeText, { color: colors.tint }]}>Done</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEventThrottle={16}
            nestedScrollEnabled={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled">
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.tint} />
                <ThemedText style={[styles.loadingText, { color: colors.secondaryText }]}>
                  Loading similar players…
                </ThemedText>
              </View>
            ) : !similarPlayers || similarPlayers.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ThemedText style={[styles.loadingText, { color: colors.secondaryText }]}>
                  No similar players found vs {opponentAbbrev}.
                </ThemedText>
              </View>
            ) : (
            similarPlayers.map(({ player, gamesVsOpponent, avgPts, avgReb, avgAst }) => {
              const fullLog = (player.game_log ?? []) as GameLogEntry[];
              return (
                <View
                  key={player.athlete_id}
                  style={[styles.playerCard, { borderColor: colors.border }]}>
                  <View style={styles.playerHeader}>
                    <Image
                      source={{ uri: player.athlete_headshot_href }}
                      style={[styles.avatar, { backgroundColor: colors.border }]}
                    />
                    <View style={styles.playerInfo}>
                      <ThemedText style={styles.playerName}>
                        {player.athlete_display_name}
                      </ThemedText>
                      <ThemedText style={[styles.playerTeam, { color: colors.secondaryText }]}>
                        {player.team_abbreviation} • {gamesVsOpponent.length} game
                        {gamesVsOpponent.length !== 1 ? 's' : ''} vs {opponentAbbrev}
                      </ThemedText>
                      <ThemedText style={[styles.avgLine, { color: colors.secondaryText }]}>
                        Avg: {avgPts.toFixed(1)} pts, {avgReb.toFixed(1)} reb, {avgAst.toFixed(1)} ast
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.gamesSection}>
                    <ThemedText style={[styles.gamesLabel, { color: colors.secondaryText }]}>
                      Games
                    </ThemedText>
                    {gamesVsOpponent.map((game) => {
                      const badges = getNoteworthyBadges(
                        game,
                        fullLog,
                        opponentAbbrev
                      );
                      return (
                        <View
                          key={game.game_id ?? game.game_date}
                          style={[styles.gameRow, { borderTopColor: colors.border }]}>
                          <ThemedText style={[styles.gameDate, { color: colors.secondaryText }]}>
                            {formatDate(game.game_date ?? '')}
                          </ThemedText>
                          <View style={styles.gameStats}>
                            <ThemedText style={styles.gameStatLine}>
                              {game.points ?? 0} pts, {game.rebounds ?? 0} reb, {game.assists ?? 0}{' '}
                              ast
                            </ThemedText>
                            {badges.length > 0 && (
                              <View style={styles.badgesRow}>
                                {badges.map((b, i) => (
                                  <BadgeChip key={i} badge={b.badge} colorScheme={colorScheme} />
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  content: {
    flex: 1,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 24,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  playerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerTeam: {
    fontSize: 13,
    marginTop: 2,
  },
  avgLine: {
    fontSize: 12,
    marginTop: 2,
  },
  gamesSection: {
    marginTop: 12,
  },
  gamesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderTopWidth: 1,
    gap: 12,
  },
  gameDate: {
    fontSize: 13,
    minWidth: 50,
  },
  gameStats: {
    flex: 1,
  },
  gameStatLine: {
    fontSize: 14,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badgeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
