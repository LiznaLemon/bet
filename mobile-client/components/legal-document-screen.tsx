import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import type { LegalDocument } from '@/constants/legal-content';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.title}>{document.title}</ThemedText>
        <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
          Effective Date: {document.effectiveDate}
        </ThemedText>
        <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
          Last Updated: {document.lastUpdated}
        </ThemedText>

        <View style={styles.sectionList}>
          {document.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <ThemedText style={styles.sectionHeading}>{section.heading}</ThemedText>
              <ThemedText style={[styles.sectionBody, { color: colors.textSecondary }]}>
                {section.body}
              </ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 20,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionList: {
    marginTop: 20,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
});
