import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// expo-sqlite provides localStorage polyfill for React Native; web has built-in localStorage
if (Platform.OS !== 'web') {
  try {
    require('expo-sqlite/localStorage/install');
  } catch {
    // Fallback if expo-sqlite unavailable (e.g. Expo Go without native build)
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// The app has no user accounts: every request uses the public anon key, so no
// auth session is stored or refreshed.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
