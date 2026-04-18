import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

type Step = 'email' | 'code';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { resetPasswordForEmail, verifyRecoveryOtp } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resentMessage, setResentMessage] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.replace(/\s+/g, '');

  const emailDisabled = !normalizedEmail || isSubmitting;
  const codeDisabled = trimmedCode.length !== 8 || isSubmitting;

  const sendResetEmail = async (target: string) => {
    await resetPasswordForEmail(target);
  };

  const handleSendEmail = async () => {
    if (emailDisabled) return;
    setErrorMessage(null);
    setResentMessage(null);
    setIsSubmitting(true);
    try {
      await sendResetEmail(normalizedEmail);
      setStep('code');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (codeDisabled) return;
    setErrorMessage(null);
    setResentMessage(null);
    setIsSubmitting(true);
    try {
      await verifyRecoveryOtp(normalizedEmail, trimmedCode);
      // On success, a recovery session is now active and `isRecoveryMode` is true.
      // AuthGate will route to /(auth)/update-password automatically.
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'That code is invalid or has expired.',
      );
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResending) return;
    setErrorMessage(null);
    setResentMessage(null);
    setIsResending(true);
    try {
      await sendResetEmail(normalizedEmail);
      setResentMessage('A new code has been sent.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {step === 'email' ? (
          <>
            <ThemedText style={styles.title}>Reset password</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter your email and we&apos;ll send you an 8-digit code to reset your password.
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
                autoCorrect={false}
                autoFocus
              />
            </View>

            {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

            <Pressable
              disabled={emailDisabled}
              onPress={() => void handleSendEmail()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.tint, opacity: pressed || emailDisabled ? 0.65 : 1 },
              ]}>
              <ThemedText
                style={[
                  styles.primaryButtonText,
                  { color: colorScheme === 'dark' ? '#000000' : '#FFFFFF' },
                ]}>
                {isSubmitting ? 'Sending...' : 'Send code'}
              </ThemedText>
            </Pressable>

            <View style={styles.footerRow}>
              <Pressable onPress={() => router.back()}>
                <ThemedText style={[styles.footerLink, { color: colors.tint }]}>
                  Back to sign in
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ThemedText style={styles.title}>Enter code</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              We sent an 8-digit code to {normalizedEmail}. Enter it below to continue.
            </ThemedText>

            <View style={styles.inputGroup}>
              <TextInput
                value={code}
                onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 8))}
                placeholder="8-digit code"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  styles.codeInput,
                  { borderColor: colors.border, color: colors.textPrimary },
                ]}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={8}
                autoFocus
              />
            </View>

            {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}
            {resentMessage ? (
              <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                {resentMessage}
              </ThemedText>
            ) : null}

            <Pressable
              disabled={codeDisabled}
              onPress={() => void handleVerifyCode()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.tint, opacity: pressed || codeDisabled ? 0.65 : 1 },
              ]}>
              <ThemedText
                style={[
                  styles.primaryButtonText,
                  { color: colorScheme === 'dark' ? '#000000' : '#FFFFFF' },
                ]}>
                {isSubmitting ? 'Verifying...' : 'Verify code'}
              </ThemedText>
            </Pressable>

            <View style={styles.footerRow}>
              <Pressable onPress={() => void handleResend()} disabled={isResending}>
                <ThemedText
                  style={[
                    styles.footerLink,
                    { color: colors.tint, opacity: isResending ? 0.6 : 1 },
                  ]}>
                  {isResending ? 'Resending...' : 'Resend code'}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Pressable
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setErrorMessage(null);
                  setResentMessage(null);
                }}>
                <ThemedText style={[styles.footerLink, { color: colors.textSecondary }]}>
                  Use a different email
                </ThemedText>
              </Pressable>
            </View>
          </>
        )}
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
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: 20,
    fontWeight: '600',
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
    marginTop: 18,
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
