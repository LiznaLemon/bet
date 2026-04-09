import { Skeleton } from '@/components/ui/skeleton';
import { StyleSheet, View } from 'react-native';

const CARD_HEIGHT = 100;
const CARD_MARGIN_BOTTOM = 16;
const LEFT_COL_WIDTH = 64; // avatar (48) + gap from card (16)

function PlayerCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Left column: avatar + stat badge */}
      <View style={styles.leftCol}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <Skeleton width={60} height={22} borderRadius={11} style={styles.badge} />
      </View>
      {/* Right content: name row + chart */}
      <View style={styles.rightCol}>
        <View style={styles.nameRow}>
          <Skeleton width={24} height={10} borderRadius={4} />
          <Skeleton width={130} height={12} borderRadius={4} />
        </View>
        <Skeleton width="100%" height={48} borderRadius={4} style={styles.chart} />
      </View>
    </View>
  );
}

/** Full-screen skeleton for the players list while loading or re-sorting. */
export function PlayerListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <PlayerCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    height: CARD_HEIGHT,
    marginBottom: CARD_MARGIN_BOTTOM,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  leftCol: {
    width: LEFT_COL_WIDTH,
    alignItems: 'center',
    height: '100%',
  },
  badge: {
    marginTop: 8,
  },
  rightCol: {
    flex: 1,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chart: {
    marginTop: 4,
  },
});
