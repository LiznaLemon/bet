import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { useOnboardingState } from '@/lib/onboarding-state';

export default function IndexScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { session, isAuthLoading, isProfileLoading, isHandlingAuthCallback } = useAuth();
  const { hasCompletedOnboarding, isOnboardingHydrating } = useOnboardingState();

  if (isAuthLoading || isOnboardingHydrating || isHandlingAuthCallback || (session && isProfileLoading)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!session) {
    if (!hasCompletedOnboarding) {
      return <Redirect href="/(onboarding)" />;
    }
    return <Redirect href="/(auth)/sign-up" />;
  }

  return <Redirect href="/schedule" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
