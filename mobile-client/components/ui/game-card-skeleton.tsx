import { Skeleton } from '@/components/ui/skeleton';
import { StyleSheet, View } from 'react-native';

/** Mimics the layout of a GameMatchupDisplay card while data is loading. */
export function GameCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Time label */}
      <View style={styles.center}>
        <Skeleton width={140} height={13} borderRadius={4} />
      </View>

      {/* Team row */}
      <View style={styles.teamsRow}>
        <View style={styles.teamSide}>
          <Skeleton width={72} height={36} borderRadius={6} />
        </View>
        <Skeleton width={12} height={13} borderRadius={3} style={styles.dash} />
        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Skeleton width={72} height={36} borderRadius={6} />
        </View>
      </View>

      {/* Record row */}
      <View style={styles.teamsRow}>
        <View style={styles.teamSide}>
          <Skeleton width={44} height={11} borderRadius={3} />
        </View>
        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Skeleton width={44} height={11} borderRadius={3} />
        </View>
      </View>
    </View>
  );
}

/** Renders N skeletons to fill the expected list. */
export function GameCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.cardWrapper}>
          <GameCardSkeleton />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
    overflow: 'hidden',
  },
  card: {
    padding: 16,
    gap: 12,
  },
  center: {
    alignItems: 'center',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamSide: {
    flex: 1,
  },
  teamSideRight: {
    alignItems: 'flex-end',
  },
  dash: {
    marginHorizontal: 8,
  },
});
