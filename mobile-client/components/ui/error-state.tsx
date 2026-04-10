import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Pressable, StyleSheet, View } from 'react-native';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/** Full-area error card. Shows a retry button when onRetry is provided. */
export function ErrorState({
  message = 'Something went wrong',
  onRetry,
}: ErrorStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </ThemedText>
      {onRetry && (
        <Pressable onPress={onRetry} style={[styles.retryBtn, { borderColor: colors.tint }]}>
          <ThemedText style={[styles.retryText, { color: colors.tint }]}>Tap to retry</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
