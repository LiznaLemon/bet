import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'arcs-onboarding-completed';
const FORCE_SHOW_ONBOARDING = false;

const storage =
  AsyncStorage && typeof AsyncStorage.getItem === 'function'
    ? AsyncStorage
    : typeof localStorage !== 'undefined'
      ? {
          getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
          setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
          removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
        }
      : null;

type OnboardingStateContextValue = {
  hasCompletedOnboarding: boolean;
  isOnboardingHydrating: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

const OnboardingStateContext = createContext<OnboardingStateContextValue | null>(null);

export function OnboardingStateProvider({ children }: { children: ReactNode }) {
  const [storedOnboardingCompletion, setStoredOnboardingCompletion] = useState(false);
  const [isOnboardingHydrating, setIsOnboardingHydrating] = useState(true);
  const [hasDismissedForcedOnboarding, setHasDismissedForcedOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!storage) {
        if (!cancelled) {
          setIsOnboardingHydrating(false);
        }
        return;
      }

      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (!cancelled) {
          setStoredOnboardingCompletion(raw === 'true');
        }
      } finally {
        if (!cancelled) {
          setIsOnboardingHydrating(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    setStoredOnboardingCompletion(true);
    setHasDismissedForcedOnboarding(true);
    if (!storage) return;
    await storage.setItem(STORAGE_KEY, 'true');
  }, []);

  const resetOnboarding = useCallback(async () => {
    setStoredOnboardingCompletion(false);
    setHasDismissedForcedOnboarding(false);
    if (!storage) return;
    await storage.removeItem(STORAGE_KEY);
  }, []);

  const hasCompletedOnboarding =
    FORCE_SHOW_ONBOARDING && !hasDismissedForcedOnboarding ? false : storedOnboardingCompletion;

  const value = useMemo(
    () => ({
      hasCompletedOnboarding,
      isOnboardingHydrating,
      completeOnboarding,
      resetOnboarding,
    }),
    [completeOnboarding, hasCompletedOnboarding, isOnboardingHydrating, resetOnboarding],
  );

  return <OnboardingStateContext.Provider value={value}>{children}</OnboardingStateContext.Provider>;
}

export function useOnboardingState() {
  const context = useContext(OnboardingStateContext);
  if (!context) {
    throw new Error('useOnboardingState must be used within OnboardingStateProvider');
  }
  return context;
}
