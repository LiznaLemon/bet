import { router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const LEGAL_LINKS: { label: string; href: Href }[] = [
  { label: 'Terms of Use', href: '/legal/terms' },
  { label: 'Privacy Policy', href: '/legal/privacy' },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Legal</ThemedText>
        {LEGAL_LINKS.map((link) => (
          <Pressable
            key={link.label}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [
              styles.button,
              { borderColor: colors.border },
              pressed ? styles.buttonPressed : null,
            ]}>
            <ThemedText style={[styles.buttonText, { color: colors.tint }]}>{link.label}</ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  header: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
