import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

export default function UpdatePasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const isDisabled = !password.trim() || !confirmPassword.trim() || isSubmitting;

  const handleSubmit = async () => {
    if (isDisabled) return;
    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      // AuthGate detects isRecoveryMode === false + session and navigates to /schedule
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update password.');
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText style={styles.title}>Set new password</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Choose a new password for your account.
        </ThemedText>

        <View style={styles.inputGroup}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            secureTextEntry
            autoCapitalize="none"
            autoFocus
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              { borderColor: confirmPassword && !passwordsMatch ? '#DC2626' : colors.border, color: colors.textPrimary },
            ]}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {errorMessage ? <ThemedText style={styles.errorText}>{errorMessage}</ThemedText> : null}

        <Pressable
          disabled={isDisabled}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.tint, opacity: pressed || isDisabled ? 0.65 : 1 },
          ]}>
          <ThemedText style={[styles.primaryButtonText, { color: colorScheme === 'dark' ? '#000000' : '#FFFFFF' }]}>
            {isSubmitting ? 'Updating...' : 'Update password'}
          </ThemedText>
        </Pressable>
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
});
