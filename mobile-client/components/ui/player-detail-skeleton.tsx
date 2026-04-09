import { Skeleton } from '@/components/ui/skeleton';
import { StyleSheet, View } from 'react-native';

function PillRow({ widths }: { widths: number[] }) {
  return (
    <View style={styles.pillRow}>
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} height={28} borderRadius={14} />
      ))}
    </View>
  );
}

function StatCardRow({ count, cardHeight = 52 }: { count: number; cardHeight?: number }) {
  return (
    <View style={styles.statCardRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.statCard, { flex: 1 }]}>
          <Skeleton width="60%" height={22} borderRadius={4} />
          <Skeleton width="80%" height={11} borderRadius={4} style={styles.statLabelBar} />
        </View>
      ))}
    </View>
  );
}

function SectionBlock({ cardCounts }: { cardCounts: number[] }) {
  return (
    <View style={styles.section}>
      <Skeleton width={160} height={12} borderRadius={4} style={styles.sectionTitle} />
      {cardCounts.map((count, i) => (
        <StatCardRow key={i} count={count} />
      ))}
    </View>
  );
}

/** Full-screen skeleton for the player detail screen while player data loads. */
export function PlayerDetailSkeleton() {
  return (
    <View style={styles.container}>
      {/* Time period pills */}
      <PillRow widths={[72, 100, 84]} />

      {/* Chart stat pills + chart */}
      <View style={styles.chartSection}>
        <PillRow widths={[44, 46, 46, 46, 38, 38, 34]} />
        <Skeleton width="100%" height={12} borderRadius={4} style={styles.chartTitle} />
        <Skeleton width="100%" height={100} borderRadius={6} style={styles.chartBar} />
      </View>

      {/* Stat sections */}
      <SectionBlock cardCounts={[3, 3, 2]} />
      <SectionBlock cardCounts={[3, 2]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 24,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chartSection: {
    gap: 12,
  },
  chartTitle: {
    marginTop: 4,
  },
  chartBar: {
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  statCardRow: {
    flexDirection: 'row',
    gap: 0,
  },
  statCard: {
    gap: 6,
    paddingVertical: 8,
  },
  statLabelBar: {
    marginTop: 2,
  },
});
