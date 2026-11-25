import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { DisplayPreferencesProvider } from '@/lib/display-preferences';
import { OnboardingStateProvider, useOnboardingState } from '@/lib/onboarding-state';
import {
  prefetchOnboardingAssets,
  whenOnboardingAssetsReady,
} from '@/lib/prefetch-onboarding-assets';
import { queryClient } from '@/lib/query-client';
import { prefetchPlayersFirstPage } from '@/lib/queries/players';
import { Colors } from '@/constants/theme';
import { loadTeamAbbreviations } from '@/lib/utils/team-abbreviation';

export const unstable_settings = {
  anchor: 'index',
};

// Hold the native splash open until AppGate has hydrated state and (if the
// user is heading to onboarding) until the onboarding images have decoded.
// This covers the cold-launch stack transition behind the splash so the user
// never sees a mid-animation hang — they go straight from splash to the
// destination screen.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash is already hidden (e.g., during Fast Refresh).
});

loadTeamAbbreviations();
prefetchPlayersFirstPage(2026, 'ppg');
prefetchOnboardingAssets();

function AppGate() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const segments = useSegments();
  const { hasCompletedOnboarding, isOnboardingHydrating } = useOnboardingState();

  const topSegment = segments[0];
  const inOnboardingGroup = topSegment === '(onboarding)';
  const inLegalGroup = topSegment === 'legal';

  const isLoading = isOnboardingHydrating;

  useEffect(() => {
    if (isLoading) return;

    if (!hasCompletedOnboarding && !inOnboardingGroup && !inLegalGroup) {
      router.replace('/(onboarding)');
      return;
    }

    // `!topSegment` covers the anchor `/` (index) route: index.tsx is a neutral
    // spinner that intentionally does not self-redirect, so this gate owns it.
    if (hasCompletedOnboarding && (inOnboardingGroup || !topSegment)) {
      router.replace('/schedule');
      return;
    }
  }, [isLoading, hasCompletedOnboarding, inOnboardingGroup, inLegalGroup, topSegment]);

  // Hide the native splash screen once all critical cold-launch work is done:
  // (1) onboarding state has hydrated, (2) if the user is headed to the
  // onboarding flow, the onboarding images have also been decoded. Two nested
  // requestAnimationFrames give expo-router's router.replace() a chance to
  // commit the destination route natively before the splash fades — otherwise
  // the splash can reveal the transient `/` route and the user sees a flash
  // or a mid-stack transition.
  useEffect(() => {
    if (isLoading) return;

    let cancelled = false;
    const goingToOnboarding = !hasCompletedOnboarding;
    const ready = goingToOnboarding ? whenOnboardingAssetsReady() : Promise.resolve();

    void ready.finally(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          SplashScreen.hideAsync().catch(() => {});
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, hasCompletedOnboarding]);

  // Always render the Stack so Expo Router's navigation tree is never torn down.
  // The loading overlay sits on top without unmounting the navigator.
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="(onboarding)"
          // Use a fade instead of the default iOS slide for the app's first
          // entry into onboarding. Fades don't require frame-perfect timing, so
          // any remaining cold-launch jitter (JS mount, image decode) doesn't
          // present as a visible mid-slide hang. The explicit white contentStyle
          // keeps the card background consistent with the onboarding screen so
          // the fade doesn't cross a dark/light boundary.
          options={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
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
        <OnboardingStateProvider>
          <DisplayPreferencesProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AppGate />
              <StatusBar style="auto" />
            </ThemeProvider>
          </DisplayPreferencesProvider>
        </OnboardingStateProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
