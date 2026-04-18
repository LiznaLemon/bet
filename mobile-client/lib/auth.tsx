import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EmailOtpType, Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();
const AUTH_DEBUG = true;
let lastHandledAuthUrl: string | null = null;

function authLog(message: string, payload?: Record<string, unknown>) {
  if (!AUTH_DEBUG || !__DEV__) return;
  if (payload) {
    console.log(`[auth] ${message}`, payload);
    return;
  }
  console.log(`[auth] ${message}`);
}

type UserProfile = {
  userId: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  acceptedLegal: boolean;
  acceptedLegalAt: string | null;
  legalVersion: string | null;
};

type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptedLegal: boolean;
  legalVersion: string;
};

type AuthContextValue = {
  session: Session | null;
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  isHandlingAuthCallback: boolean;
  isRecoveryMode: boolean;
  profile: UserProfile | null;
  signUpWithEmail: (input: SignUpInput) => Promise<{ requiresEmailConfirmation: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (legal?: { acceptedLegal: boolean; legalVersion: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  markOnboardingCompleted: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfileRow(row: Record<string, unknown>): UserProfile {
  return {
    userId: String(row.user_id ?? ''),
    onboardingCompleted: Boolean(row.onboarding_completed),
    onboardingCompletedAt:
      typeof row.onboarding_completed_at === 'string' ? row.onboarding_completed_at : null,
    acceptedLegal: Boolean(row.accepted_legal),
    acceptedLegalAt: typeof row.accepted_legal_at === 'string' ? row.accepted_legal_at : null,
    legalVersion: typeof row.legal_version === 'string' ? row.legal_version : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isHandlingAuthCallback, setIsHandlingAuthCallback] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [oauthLegalIntent, setOauthLegalIntent] = useState<{
    acceptedLegal: boolean;
    legalVersion: string;
  } | null>(null);

  const createSessionFromUrl = useCallback(async (url: string) => {
    authLog('processing auth callback url');
    const parsed = new URL(url);
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = parsed.searchParams;

    const getParam = (key: string): string | null => {
      return hashParams.get(key) ?? queryParams.get(key);
    };

    const accessToken = getParam('access_token');
    const refreshToken = getParam('refresh_token');
    const tokenHash = getParam('token_hash');
    const type = getParam('type');
    const authCode = getParam('code');
    const errorCode = getParam('error_code');
    const errorDescription = getParam('error_description');

    authLog('callback params detected', {
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      hasTokenHash: Boolean(tokenHash),
      type: type ?? null,
      hasCode: Boolean(authCode),
      hasError: Boolean(errorCode),
    });

    // Detect password recovery directly from the URL. With detectSessionInUrl: false,
    // supabase-js never fires the PASSWORD_RECOVERY event on onAuthStateChange, so we
    // set isRecoveryMode here before any token exchange runs.
    if (type === 'recovery') {
      setIsRecoveryMode(true);
    }

    if (errorCode) {
      throw new Error(errorDescription ?? `Auth callback failed (${errorCode})`);
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        throw error;
      }
      return;
    }

    if (authCode) {
      const { error } = await supabase.auth.exchangeCodeForSession(authCode);
      if (error) {
        throw error;
      }
      return;
    }

    // Email confirmation links can contain token_hash + type instead of access/refresh tokens.
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      if (error) {
        throw error;
      }
      return;
    }

    authLog('callback did not include usable auth params');
  }, []);

  const ensureProfile = useCallback(
    async (
      userId: string,
      opts?: {
        acceptedLegal?: boolean;
        legalVersion?: string;
        onboardingCompleted?: boolean;
      },
    ) => {
      const nowIso = new Date().toISOString();
      const upsertPayload: Record<string, unknown> = {
        user_id: userId,
      };

      if (opts?.acceptedLegal) {
        upsertPayload.accepted_legal = true;
        upsertPayload.accepted_legal_at = nowIso;
        upsertPayload.legal_version = opts.legalVersion ?? null;
      }

      if (opts?.onboardingCompleted) {
        upsertPayload.onboarding_completed = true;
        upsertPayload.onboarding_completed_at = nowIso;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert(upsertPayload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      setProfile(mapProfileRow(data as Record<string, unknown>));
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }

    setIsProfileLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      setIsProfileLoading(false);
      throw error;
    }

    if (!data) {
      await ensureProfile(session.user.id);
      setIsProfileLoading(false);
      return;
    }

    setProfile(mapProfileRow(data as Record<string, unknown>));
    setIsProfileLoading(false);
  }, [ensureProfile, session?.user?.id]);

  const metadataAcceptedLegal = session?.user?.user_metadata?.accepted_legal === true;
  const metadataLegalVersion =
    typeof session?.user?.user_metadata?.legal_version === 'string'
      ? String(session.user.user_metadata.legal_version)
      : null;

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(data.session);
        setIsAuthLoading(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    let disposed = false;
    setIsProfileLoading(true);

    const hydrateProfile = async () => {
      try {
        if (oauthLegalIntent?.acceptedLegal) {
          await ensureProfile(session.user.id, {
            acceptedLegal: true,
            legalVersion: oauthLegalIntent.legalVersion,
          });
          setOauthLegalIntent(null);
        } else {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (error) {
            throw error;
          }

          if (!data) {
            const acceptedFromMetadata =
              metadataAcceptedLegal && metadataLegalVersion
                ? {
                    acceptedLegal: true,
                    legalVersion: metadataLegalVersion,
                  }
                : undefined;

            await ensureProfile(session.user.id, acceptedFromMetadata);
          } else {
            setProfile(mapProfileRow(data as Record<string, unknown>));
          }
        }
      } catch (error) {
        if (!disposed) {
          console.warn('Failed to hydrate user profile', error);
        }
      } finally {
        if (!disposed) {
          setIsProfileLoading(false);
        }
      }
    };

    void hydrateProfile();

    return () => {
      disposed = true;
    };
  }, [ensureProfile, metadataAcceptedLegal, metadataLegalVersion, oauthLegalIntent, session?.user?.id]);

  const incomingUrl = Linking.useURL();
  useEffect(() => {
    if (!incomingUrl) {
      return;
    }

    if (incomingUrl === lastHandledAuthUrl) {
      authLog('skipping already processed deep link');
      return;
    }

    const looksLikeAuthCallback =
      incomingUrl.includes('access_token=') ||
      incomingUrl.includes('refresh_token=') ||
      incomingUrl.includes('token_hash=') ||
      incomingUrl.includes('code=') ||
      incomingUrl.includes('error_code=') ||
      incomingUrl.includes('error=') ||
      incomingUrl.includes('error_description=');

    if (!looksLikeAuthCallback) {
      return;
    }

    authLog('incoming deep link received');
    lastHandledAuthUrl = incomingUrl;
    setIsHandlingAuthCallback(true);
    void createSessionFromUrl(incomingUrl)
      .catch((error) => {
        console.warn('Failed to create session from deep link', error);
      })
      .finally(() => {
        setIsHandlingAuthCallback(false);
      });
  }, [createSessionFromUrl, incomingUrl]);

  const signUpWithEmail = useCallback(
    async ({ firstName, lastName, email, password, acceptedLegal, legalVersion }: SignUpInput) => {
      const emailRedirectTo = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            first_name: firstName,
            last_name: lastName,
            accepted_legal: acceptedLegal,
            legal_version: legalVersion,
            accepted_legal_at: new Date().toISOString(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user && data.session) {
        await ensureProfile(data.user.id, {
          acceptedLegal,
          legalVersion,
        });
      }

      return {
        requiresEmailConfirmation: !data.session,
      };
    },
    [ensureProfile],
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(
    async (legal?: { acceptedLegal: boolean; legalVersion: string }) => {
      if (legal?.acceptedLegal) {
        setOauthLegalIntent({
          acceptedLegal: true,
          legalVersion: legal.legalVersion,
        });
      }

      const redirectTo = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error('Google OAuth URL was not returned');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        await createSessionFromUrl(result.url);
      }
    },
    [createSessionFromUrl],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setProfile(null);
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    // No redirectTo needed: the email template uses an 8-digit OTP code the user
    // types into the app manually, so there's no deep link for Supabase to hand back.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  }, []);

  const verifyRecoveryOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });
    if (error) {
      throw error;
    }
    // supabase-js fires PASSWORD_RECOVERY on onAuthStateChange for recovery OTP
    // verification, which flips isRecoveryMode to true and causes AuthGate to
    // route the user to /(auth)/update-password.
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
    setIsRecoveryMode(false);
  }, []);

  const markOnboardingCompleted = useCallback(async () => {
    if (!session?.user?.id) {
      throw new Error('No active user session');
    }

    await ensureProfile(session.user.id, { onboardingCompleted: true });
  }, [ensureProfile, session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthLoading,
      isProfileLoading,
      isHandlingAuthCallback,
      isRecoveryMode,
      profile,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      resetPasswordForEmail,
      verifyRecoveryOtp,
      updatePassword,
      markOnboardingCompleted,
      refreshProfile,
    }),
    [
      isAuthLoading,
      isHandlingAuthCallback,
      isProfileLoading,
      isRecoveryMode,
      markOnboardingCompleted,
      profile,
      refreshProfile,
      session,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      resetPasswordForEmail,
      verifyRecoveryOtp,
      updatePassword,
      signUpWithEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
