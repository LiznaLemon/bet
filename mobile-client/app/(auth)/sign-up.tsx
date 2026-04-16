import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LEGAL_VERSION } from '@/constants/legal-content';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

export default function SignUpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { signUpWithEmail } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);

  const missingField = !firstName.trim() || !lastName.trim() || !email.trim() || !password.trim();
  const isDisabled = missingField || !acceptedLegal || isSubmitting || awaitingEmailConfirmation;

  const updateFirstName = (value: string) => {
    setFirstName(value);
    if (awaitingEmailConfirmation) {
      setAwaitingEmailConfirmation(false);
      setInfoMessage(null);
    }
  };

  const updateLastName = (value: string) => {
    setLastName(value);
    if (awaitingEmailConfirmation) {
      setAwaitingEmailConfirmation(false);
      setInfoMessage(null);
    }
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    if (awaitingEmailConfirmation) {
      setAwaitingEmailConfirmation(false);
      setInfoMessage(null);
    }
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    if (awaitingEmailConfirmation) {
      setAwaitingEmailConfirmation(false);
      setInfoMessage(null);
    }
  };

  const handleEmailSignUp = async () => {
    if (isDisabled) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);
    try {
      const result = await signUpWithEmail({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        acceptedLegal: true,
        legalVersion: LEGAL_VERSION,
      });
      if (result.requiresEmailConfirmation) {
        setAwaitingEmailConfirmation(true);
        setInfoMessage('Email sent. Check your inbox to confirm your account, then sign in.');
      } else {
        router.replace('/(onboarding)');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign up right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.title}>Create your account</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sign up to access onboarding, player trends, and live game insights.
        </ThemedText>

        <View style={styles.inputGroup}>
          <TextInput
            value={firstName}
            onChangeText={updateFirstName}
            placeholder="First name"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            autoCapitalize="words"
          />
          <TextInput
            value={lastName}
            onChangeText={updateLastName}
            placeholder="Last name"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            autoCapitalize="words"
          />
          <TextInput
            value={email}
            onChangeText={updateEmail}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            value={password}
            onChangeText={updatePassword}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Pressable onPress={() => setAcceptedLegal((prev) => !prev)} style={styles.checkboxRow}>
          <View style={[styles.checkbox, { borderColor: colors.border }]}>
            {acceptedLegal ? <Ionicons name="checkmark" size={14} color={colors.tint} /> : null}
          </View>
          <ThemedText style={[styles.checkboxText, { color: colors.textSecondary }]}>
            I agree to the{' '}
            <Link href="/legal/terms" style={[styles.inlineLink, { color: colors.tint }]}>
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" style={[styles.inlineLink, { color: colors.tint }]}>
              Privacy Policy
            </Link>
            .
          </ThemedText>
        </Pressable>

        {infoMessage ? (
          <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>{infoMessage}</ThemedText>
        ) : null}
        {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

        <Pressable
          disabled={isDisabled}
          onPress={() => void handleEmailSignUp()}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.tint,
              opacity: pressed || isDisabled ? 0.65 : 1,
            },
          ]}>
          <ThemedText style={[styles.primaryButtonText, { color: colorScheme === 'dark' ? '#000' : '#fff' }]}>
            {isSubmitting
              ? 'Creating account...'
              : awaitingEmailConfirmation
                ? 'Email sent'
                : 'Create account'}
          </ThemedText>
        </Pressable>

        <View style={styles.footerRow}>
          <ThemedText style={{ color: colors.textSecondary }}>Already have an account?</ThemedText>
          <Pressable onPress={() => router.push('/(auth)/sign-in')}>
            <ThemedText style={[styles.footerLink, { color: colors.tint }]}>Sign in</ThemedText>
          </Pressable>
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
    paddingTop: 12,
    paddingBottom: 36,
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
  checkboxRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  inlineLink: {
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    color: '#DC2626',
    fontSize: 13,
  },
  infoText: {
    marginTop: 10,
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
