import { Skeleton } from '@/components/ui/skeleton';
import { StyleSheet, View } from 'react-native';

/** Section placeholder: a label bar + a content block */
function SectionSkeleton({ contentHeight = 80 }: { contentHeight?: number }) {
  return (
    <View style={styles.section}>
      <Skeleton width={120} height={12} borderRadius={4} style={styles.sectionLabel} />
      <Skeleton width="100%" height={contentHeight} borderRadius={8} />
    </View>
  );
}

/** Full skeleton for the game matchup tab while initial data loads. */
export function GameMatchupSkeleton() {
  return (
    <View style={styles.container}>
      {/* Score / matchup header card */}
      <View style={styles.headerCard}>
        <View style={styles.center}>
          <Skeleton width={140} height={13} borderRadius={4} />
        </View>
        <View style={styles.scoreRow}>
          <View style={styles.teamBlock}>
            <Skeleton width={68} height={36} borderRadius={6} />
            <Skeleton width={44} height={11} borderRadius={3} style={styles.recordBar} />
          </View>
          <Skeleton width={16} height={18} borderRadius={3} />
          <View style={[styles.teamBlock, styles.teamBlockRight]}>
            <Skeleton width={68} height={36} borderRadius={6} />
            <Skeleton width={44} height={11} borderRadius={3} style={styles.recordBar} />
          </View>
        </View>
      </View>

      {/* Stat filter pills */}
      <View style={styles.pills}>
        {[80, 64, 72, 56].map((w, i) => (
          <Skeleton key={i} width={w} height={28} borderRadius={14} />
        ))}
      </View>

      {/* Content sections */}
      <SectionSkeleton contentHeight={90} />
      <SectionSkeleton contentHeight={120} />
      <SectionSkeleton contentHeight={72} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 20,
  },
  headerCard: {
    gap: 16,
    paddingVertical: 12,
  },
  center: {
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  teamBlock: {
    alignItems: 'flex-start',
    gap: 6,
  },
  teamBlockRight: {
    alignItems: 'flex-end',
  },
  recordBar: {
    marginTop: 2,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    marginBottom: 2,
  },
});
