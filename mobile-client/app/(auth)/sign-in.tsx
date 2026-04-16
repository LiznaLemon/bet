import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

export default function SignInScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisabled = !email.trim() || !password.trim() || isSubmitting;

  const handleEmailSignIn = async () => {
    if (isDisabled) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText style={styles.title}>Welcome back</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sign in to continue with Arcs.
        </ThemedText>

        <View style={styles.inputGroup}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

        <Pressable
          disabled={isDisabled}
          onPress={() => void handleEmailSignIn()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.tint, opacity: pressed || isDisabled ? 0.65 : 1 },
          ]}>
          <ThemedText style={[styles.primaryButtonText, { color: colorScheme === 'dark' ? '#000000' : '#FFFFFF' }]}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </ThemedText>
        </Pressable>

        <View style={styles.footerRow}>
          <ThemedText style={{ color: colors.textSecondary }}>Need an account?</ThemedText>
          <Pressable onPress={() => router.push('/(auth)/sign-up')}>
            <ThemedText style={[styles.footerLink, { color: colors.tint }]}>Sign up</ThemedText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 12,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  errorText: {
    marginTop: 10,
    color: '#DC2626',
    fontSize: 13,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
