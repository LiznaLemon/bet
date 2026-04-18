import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DisplayPreferencesProvider } from '@/lib/display-preferences';
import { OnboardingStateProvider, useOnboardingState } from '@/lib/onboarding-state';
import { queryClient } from '@/lib/query-client';
import { prefetchPlayersFirstPage } from '@/lib/queries/players';
import { Colors } from '@/constants/theme';
import { loadTeamAbbreviations } from '@/lib/utils/team-abbreviation';

export const unstable_settings = {
  anchor: 'index',
};

loadTeamAbbreviations();
prefetchPlayersFirstPage(2026, 'ppg');

function AuthGate() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const segments = useSegments();
  const { session, isAuthLoading, isHandlingAuthCallback, isProfileLoading, isRecoveryMode } = useAuth();
  const { hasCompletedOnboarding, isOnboardingHydrating } = useOnboardingState();

  const topSegment = segments[0];
  const secondSegment = segments[1];
  const inAuthGroup = topSegment === '(auth)';
  const inAuthCallbackRoute = topSegment === 'auth';
  const inAuthArea = inAuthGroup || inAuthCallbackRoute;
  const inOnboardingGroup = topSegment === '(onboarding)';
  const inLegalGroup = topSegment === 'legal';
  const inUpdatePasswordRoute = secondSegment === 'update-password';

  const isLoading =
    isAuthLoading || isOnboardingHydrating || isHandlingAuthCallback || (!!session && isProfileLoading);

  useEffect(() => {
    if (isLoading) return;

    if (!session && !hasCompletedOnboarding && !inOnboardingGroup && !inAuthArea && !inLegalGroup) {
      router.replace('/(onboarding)');
      return;
    }

    if (!session && hasCompletedOnboarding && !inAuthArea && !inLegalGroup) {
      router.replace('/(auth)/sign-up');
      return;
    }

    if (!session && hasCompletedOnboarding && inOnboardingGroup) {
      router.replace('/(auth)/sign-up');
      return;
    }

    if (session && isRecoveryMode && !inUpdatePasswordRoute) {
      router.replace('/(auth)/update-password');
      return;
    }

    if (session && !isRecoveryMode && (inAuthArea || inOnboardingGroup)) {
      router.replace('/schedule');
      return;
    }
  }, [isLoading, session, hasCompletedOnboarding, inOnboardingGroup, inAuthArea, inLegalGroup, isRecoveryMode, inUpdatePasswordRoute]);

  // Always render the Stack so Expo Router's navigation tree is never torn down.
  // The loading overlay sits on top without unmounting the navigator.
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="legal" options={{ headerShown: false }} />
        <Stack.Screen name="game" options={{ headerShown: false }} />
        <Stack.Screen name="player" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      {isLoading && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.tint} size="large" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OnboardingStateProvider>
            <DisplayPreferencesProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <AuthGate />
                <StatusBar style="auto" />
              </ThemeProvider>
            </DisplayPreferencesProvider>
          </OnboardingStateProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
