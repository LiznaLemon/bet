import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await signOut();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sign out');
      setIsSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Account controls and app preferences will live here.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <ThemedText style={styles.sectionTitle}>Account</ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Sign out of your account on this device.
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          disabled={isSigningOut}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            { borderColor: colors.tint },
            pressed && !isSigningOut ? styles.signOutButtonPressed : null,
            isSigningOut ? styles.signOutButtonDisabled : null,
          ]}>
          {isSigningOut ? (
            <ActivityIndicator color={colors.tint} size="small" />
          ) : (
            <ThemedText style={[styles.signOutText, { color: colors.tint }]}>Log out</ThemedText>
          )}
        </Pressable>

        {errorMessage ? (
          <ThemedText style={[styles.errorText, { color: colors.textSecondary }]}>{errorMessage}</ThemedText>
        ) : null}
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
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  signOutButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signOutButtonPressed: {
    opacity: 0.8,
  },
  signOutButtonDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
  },
});
