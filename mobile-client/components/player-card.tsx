import { MiniBarChart } from '@/components/mini-bar-chart';
import { PlayerAvatar } from '@/components/player-avatar';
import { PlayerAvatarWithStatChip } from '@/components/player-avatar-with-stat-chip';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

type GameLog = {
  points: number;
  rebounds: number;
  assists: number;
  [key: string]: any;
};

type Player = {
  athlete_id: string;
  athlete_display_name: string;
  athlete_headshot_href: string;
  athlete_position_abbreviation: string;
  team_abbreviation: string;
  games_played: number;
  ppg: string;
  rpg: string;
  apg: string;
  game_log: GameLog[];
  [key: string]: any;
};

type SortOption = 'ppg' | 'rpg' | 'apg' | '3pm' | 'spg' | 'bpg';

interface PlayerCardProps {
  player: Player;
  sortBy: SortOption;
  colorScheme: 'light' | 'dark';
  layout?: 'default' | 'compact' | 'detailed' | 'wide' | 'long';
  /** 1-based rank in the list (e.g. 1, 2, 3). When provided, shows a small number to the left of the player name. */
  rank?: number;
  /** Whether the player meets the games-played qualification threshold. When false, the card is dimmed. */
  qualified?: boolean;
  /** Increment to trigger bar chart intro animation (e.g. from useFocusEffect) */
  animationTrigger?: number;
  /** Skip bar chart animation (e.g. when remounting recycled list items) */
  skipChartAnimation?: boolean;
  /** Called when bar chart intro animation completes */
  onChartAnimationComplete?: () => void;
}

function PlayerCardComponent({ 
  player, 
  sortBy, 
  colorScheme,
  layout = 'default',
  rank,
  qualified = true,
  animationTrigger,
  skipChartAnimation,
  onChartAnimationComplete,
}: PlayerCardProps) {
  const colors = Colors[colorScheme];
  const currentStatValue =
    sortBy === '3pm'
      ? ((player.total_three_point_made ?? 0) / Math.max(1, player.games_played ?? 1)).toFixed(1)
      : player[sortBy];

  const statLabel =
    sortBy === 'ppg' ? 'PPG' : sortBy === 'rpg' ? 'RPG' : sortBy === 'apg' ? 'APG' : sortBy === '3pm' ? '3PM' : sortBy === 'spg' ? 'SPG' : 'BPG';

  const gameLogData = useMemo(() => {
    const statKey =
      sortBy === 'ppg' ? 'points' : sortBy === 'rpg' ? 'rebounds' : sortBy === 'apg' ? 'assists' : sortBy === '3pm' ? 'three_point_made' : sortBy === 'spg' ? 'steals' : 'blocks';
    return player.game_log.slice(0, 10).map(game => game[statKey]).reverse();
  }, [sortBy, player.game_log]);

  // Layout: Default (current design with bar chart)
  if (layout === 'default') {
    return (
      <TouchableOpacity
        style={[
          styles.playerCard,
          { backgroundColor: colors.cardBackground },
        ]}
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: player.athlete_id, name: player.athlete_display_name, from: 'Players' } })}>
        <View style={styles.playerInfo}>
          <PlayerAvatar uri={player.athlete_headshot_href} size={50} />
          <View style={styles.playerDetails}>
            <View style={styles.nameRow}>
              <View style={styles.rankSlot}>
                <ThemedText style={[styles.rankNumber, { color: colors.textSecondary }]}>
                  {rank != null ? `${rank}.` : '–'}
                </ThemedText>
              </View>
              <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            </View>
            <ThemedText style={[styles.statAverage, { color: colors.textSecondary }]}>
              {currentStatValue} {statLabel}
            </ThemedText>
          </View>
        </View>

        <MiniBarChart 
          data={gameLogData} 
          colorScheme={colorScheme} 
          useGradient={true} 
          chartHeight={50}
          animationTrigger={animationTrigger}
          skipAnimation={skipChartAnimation}
          onAnimationComplete={onChartAnimationComplete}
        />
      </TouchableOpacity>
    );
  }

  // Layout: Compact (smaller, more list-like)
  if (layout === 'compact') {
    return (
      <TouchableOpacity
        style={[
          styles.playerCardCompact,
          { backgroundColor: colors.cardBackground },
        ]}
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: player.athlete_id, name: player.athlete_display_name, from: 'Players' } })}>
        <PlayerAvatar uri={player.athlete_headshot_href} size={40} />
        <View style={styles.compactInfo}>
          <View style={styles.nameRow}>
            <View style={styles.rankSlot}>
              <ThemedText style={[styles.rankNumber, { color: colors.textSecondary }]}>
                {rank != null ? `${rank}.` : '–'}
              </ThemedText>
            </View>
            <ThemedText style={styles.playerNameCompact}>{player.athlete_display_name}</ThemedText>
          </View>
          <ThemedText style={[styles.teamText, { color: colors.textSecondary }]}>
            {toThreeLetterAbbrev(player.team_abbreviation) || player.team_abbreviation} • {player.athlete_position_abbreviation}
          </ThemedText>
        </View>
        <View style={styles.compactStat}>
          <ThemedText style={styles.statValueLarge}>{currentStatValue}</ThemedText>
          <ThemedText style={[styles.statLabelSmall, { color: colors.textTertiary }]}>{statLabel}</ThemedText>
        </View>
      </TouchableOpacity>
    );
  }

  // Layout: Detailed (shows more info + bar chart)
  if (layout === 'detailed') {
    return (
      <TouchableOpacity
        style={[
          styles.playerCardDetailed,
          { backgroundColor: colors.cardBackground },
        ]}
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: player.athlete_id, name: player.athlete_display_name, from: 'Players' } })}>
        <View style={styles.detailedHeader}>
          <PlayerAvatar uri={player.athlete_headshot_href} size={60} />
          <View style={styles.detailedInfo}>
            <View style={styles.nameRow}>
              <View style={styles.rankSlot}>
                <ThemedText style={[styles.rankNumber, { color: colors.textSecondary }]}>
                  {rank != null ? `${rank}.` : '–'}
                </ThemedText>
              </View>
              <ThemedText style={styles.playerNameDetailed}>{player.athlete_display_name}</ThemedText>
            </View>
            <ThemedText style={[styles.teamTextDetailed, { color: colors.textSecondary }]}>
              {toThreeLetterAbbrev(player.team_abbreviation) || player.team_abbreviation} • {player.athlete_position_abbreviation}
            </ThemedText>
            <ThemedText style={[styles.gamesPlayedText, { color: colors.textTertiary }]}>{player.games_played} Games</ThemedText>
          </View>
        </View>
        
        <View style={[styles.detailedStats, { borderTopColor: colors.dividerSubtle }]}>
          <View style={styles.statColumn}>
            <ThemedText style={styles.statValue}>{player.ppg}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textTertiary }]}>PPG</ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText style={styles.statValue}>{player.rpg}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textTertiary }]}>RPG</ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText style={styles.statValue}>{player.apg}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textTertiary }]}>APG</ThemedText>
          </View>
        </View>

        <View style={[styles.chartSection, { borderTopColor: colors.dividerSubtle }]}>
          <ThemedText style={[styles.chartTitle, { color: colors.textSecondary }]}>Last 10 Games ({statLabel})</ThemedText>
          <MiniBarChart data={gameLogData} colorScheme={colorScheme} useGradient={true} animationTrigger={animationTrigger} skipAnimation={skipChartAnimation} onAnimationComplete={onChartAnimationComplete} />
        </View>
      </TouchableOpacity>
    );
  }

  if (layout === 'wide') {
    return (
      <TouchableOpacity
        style={[
          styles.playerCardWide,
          { borderBottomColor: colors.border },
          // { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: player.athlete_id, name: player.athlete_display_name, from: 'Players' } })}>
        <View style={styles.playerInfo}>
          <PlayerAvatar uri={player.athlete_headshot_href} size={50} />
          <View style={styles.playerDetails}>
            <View style={styles.nameRow}>
              <View style={styles.rankSlot}>
                <ThemedText style={[styles.rankNumber, { color: colors.textSecondary }]}>
                  {rank != null ? `${rank}.` : '–'}
                </ThemedText>
              </View>
              <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            </View>
            <ThemedText style={[styles.statAverage, { color: colors.textSecondary }]}>
              {currentStatValue} {statLabel}
            </ThemedText>
          </View>
        </View>
        <MiniBarChart data={gameLogData} colorScheme={colorScheme} useGradient={true} />
      </TouchableOpacity>
    );
  }

  // Layout: Long (player image on left, name + stat in row, chart below)
  if (layout === 'long') {
    return (
      <TouchableOpacity
        style={[
          styles.playerCardLong,
          !qualified && { opacity: 0.45 },
        ]}
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: player.athlete_id, name: player.athlete_display_name, from: 'Players' } })}>
        <PlayerAvatarWithStatChip
          uri={player.athlete_headshot_href}
          avatarSize={48}
          chipLabel={`${currentStatValue} ${statLabel}`}
          colorScheme={colorScheme}
          style={styles.longHeaderColumn}
          chipStyle={{ transform: [{ translateY: 1 }] }}
        />
        
        {/* Content Container: Name/Stat Row + Chart */}
        <View style={styles.longContentContainer}>
          {/* Name and Stat in Row */}
          <View style={styles.longHeaderRow}>
            <View style={styles.nameRow}>
              <View style={styles.rankSlot}>
                <ThemedText style={[styles.rankNumber, { color: colors.textSecondary }]}>
                  {rank != null ? `${rank}.` : '–'}
                </ThemedText>
              </View>
              <ThemedText style={styles.playerNameLong}>
              {player.athlete_display_name}
              <ThemedText style={[styles.playerNameTeam, { color: colors.textSecondary }]}>
                {' '}({toThreeLetterAbbrev(player.team_abbreviation) || player.team_abbreviation})
              </ThemedText>
            </ThemedText>
          </View>
          </View>
          
          {/* Bar Chart */}
          <View style={styles.longChartContainer}>
            <MiniBarChart data={gameLogData} colorScheme={colorScheme} useGradient={false} chartHeight={50} animationTrigger={animationTrigger} skipAnimation={skipChartAnimation} onAnimationComplete={onChartAnimationComplete} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return null;
}

// Memoize to prevent unnecessary re-renders in FlatList
export const PlayerCard = memo(PlayerCardComponent);

const styles = StyleSheet.create({
  // Default Layout
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  playerCardWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rankSlot: {
    minWidth: 24,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statAverage: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Compact Layout
  playerCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  compactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerNameCompact: {
    fontSize: 15,
    fontWeight: '600',
  },
  teamText: {
    fontSize: 12,
    marginTop: 2,
  },
  compactStat: {
    alignItems: 'flex-end',
  },
  statValueLarge: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabelSmall: {
    fontSize: 10,
  },

  // Detailed Layout
  playerCardDetailed: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerNameDetailed: {
    fontSize: 18,
    fontWeight: '700',
  },
  teamTextDetailed: {
    fontSize: 13,
    marginTop: 4,
  },
  gamesPlayedText: {
    fontSize: 12,
    marginTop: 2,
  },
  detailedStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  statColumn: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  chartSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  chartTitle: {
    fontSize: 12,
    marginBottom: 8,
  },

  // Long Layout Styles
  playerCardLong: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // padding: 16,
    // borderRadius: 12,
    marginBottom: 16,
    gap: 16,
    // borderWidth: 1,
    // borderColor: 'green',
    height: 100,
  },
  longContentContainer: {
    flex: 1,
    flexDirection: 'column',
    // height: '100%',
    // justifyContent: 'space-between',
    // gap: 0,
    // height: '100%',
    // borderWidth: 1,
    // borderColor: 'blue',
  },
  longHeaderColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    // justifyContent: 'space-between',
    // gap: 8,
    height: '100%',
    // borderWidth: 1,
    // borderColor: 'red',
  },
  longHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerNameLong: {
    fontSize: 16,
    fontWeight: '400',
    flex: 1,
  },
  playerNameTeam: {
  },
  longChartContainer: {
    width: '100%',
  },
});
