import { MiniBarChart } from '@/components/mini-bar-chart';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { Image } from 'expo-image';
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
  animationTrigger,
  skipChartAnimation,
  onChartAnimationComplete,
}: PlayerCardProps) {
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
          { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
        onPress={() => router.push(`/player/${player.athlete_id}`)}>
        <View style={styles.playerInfo}>
          <Image
            source={{ uri: player.athlete_headshot_href }}
            style={[styles.playerImage, { backgroundColor: Colors[colorScheme].border }]}
            contentFit="cover"
          />
          <View style={styles.playerDetails}>
            <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            <ThemedText style={styles.statAverage}>
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
          { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
        onPress={() => router.push(`/player/${player.athlete_id}`)}>
        <Image
          source={{ uri: player.athlete_headshot_href }}
          style={[styles.playerImageSmall, { backgroundColor: Colors[colorScheme].border }]}
          contentFit="cover"
        />
        <View style={styles.compactInfo}>
          <ThemedText style={styles.playerNameCompact}>{player.athlete_display_name}</ThemedText>
          <ThemedText style={styles.teamText}>
            {player.team_abbreviation} • {player.athlete_position_abbreviation}
          </ThemedText>
        </View>
        <View style={styles.compactStat}>
          <ThemedText style={styles.statValueLarge}>{currentStatValue}</ThemedText>
          <ThemedText style={styles.statLabelSmall}>{statLabel}</ThemedText>
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
          { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
        onPress={() => router.push(`/player/${player.athlete_id}`)}>
        <View style={styles.detailedHeader}>
          <Image
            source={{ uri: player.athlete_headshot_href }}
            style={[styles.playerImageLarge, { backgroundColor: Colors[colorScheme].border }]}
            contentFit="cover"
          />
          <View style={styles.detailedInfo}>
            <ThemedText style={styles.playerNameDetailed}>{player.athlete_display_name}</ThemedText>
            <ThemedText style={styles.teamTextDetailed}>
              {player.team_abbreviation} • {player.athlete_position_abbreviation}
            </ThemedText>
            <ThemedText style={styles.gamesPlayedText}>{player.games_played} Games</ThemedText>
          </View>
        </View>
        
        <View style={styles.detailedStats}>
          <View style={styles.statColumn}>
            <ThemedText style={styles.statValue}>{player.ppg}</ThemedText>
            <ThemedText style={styles.statLabel}>PPG</ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText style={styles.statValue}>{player.rpg}</ThemedText>
            <ThemedText style={styles.statLabel}>RPG</ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText style={styles.statValue}>{player.apg}</ThemedText>
            <ThemedText style={styles.statLabel}>APG</ThemedText>
          </View>
        </View>

        <View style={styles.chartSection}>
          <ThemedText style={styles.chartTitle}>Last 10 Games ({statLabel})</ThemedText>
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
          { borderBottomColor: Colors[colorScheme].border },
          // { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
        onPress={() => router.push(`/player/${player.athlete_id}`)}>
        <View style={styles.playerInfo}>
          <Image
            source={{ uri: player.athlete_headshot_href }}
            style={[styles.playerImage, { backgroundColor: Colors[colorScheme].border }]}
            contentFit="cover"
          />
          <View style={styles.playerDetails}>
            <ThemedText style={styles.playerName}>{player.athlete_display_name}</ThemedText>
            <ThemedText style={styles.statAverage}>
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
          { 
            // paddingBottom: 8, 
            // borderBottomWidth: 1, 
            // borderBottomColor: Colors[colorScheme].border,
            // backgroundColor: Colors[colorScheme].cardBackground,
          },
          // { backgroundColor: Colors[colorScheme].cardBackground },
        ]}
        onPress={() => router.push(`/player/${player.athlete_id}`)}>
        {/* Player Image */}
        <View style={styles.longHeaderColumn}>
          <Image
            source={{ uri: player.athlete_headshot_href }}
            style={[styles.playerImageLong, { backgroundColor: Colors[colorScheme].border }]}
            contentFit="cover"
          />
          <View style={[styles.statValueContainer, { borderWidth: 1, borderColor: Colors[colorScheme].border, backgroundColor: Colors[colorScheme].cardBackground }]}>
            <ThemedText style={styles.statAverageLong}>
              {currentStatValue} {statLabel}
            </ThemedText>
          </View>
         </View>
        
        {/* Content Container: Name/Stat Row + Chart */}
        <View style={styles.longContentContainer}>
          {/* Name and Stat in Row */}
          <View style={styles.longHeaderRow}>
            <ThemedText style={styles.playerNameLong}>
              {player.athlete_display_name}
              <ThemedText style={styles.playerNameTeam}>
                {' | '}
                {player.jersey_number != null ? `#${player.jersey_number} | ` : ''}
                {player.athlete_position_abbreviation} | {player.team_abbreviation}
              </ThemedText>
            </ThemedText>
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
  playerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  playerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statAverage: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },

  // Compact Layout
  playerCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerImageSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    opacity: 0.6,
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
    opacity: 0.6,
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
  playerImageLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    opacity: 0.7,
    marginTop: 4,
  },
  gamesPlayedText: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  detailedStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
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
    opacity: 0.6,
    marginTop: 2,
  },
  chartSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  chartTitle: {
    fontSize: 12,
    opacity: 0.6,
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
  playerImageLong: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginTop: 4,
  },
  longContentContainer: {
    flex: 1,
    flexDirection: 'column',
    // height: '100%',
    // justifyContent: 'space-between',
    gap: 8,
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
    opacity: 0.5,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
    // gap: 4,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statAverageLong: {
    fontSize: 14,
    fontWeight: '600',
    // marginLeft: 12,
  },
  longChartContainer: {
    width: '100%',
  },
});
