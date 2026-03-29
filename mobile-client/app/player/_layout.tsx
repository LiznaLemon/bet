import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack } from 'expo-router';

export default function PlayerLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const tintColor = Colors[colorScheme].tint;
  const textColor = Colors[colorScheme].text;

  const transparentHeader = {
    headerTransparent: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: 'transparent' },
    headerTitleStyle: { color: textColor },
    headerTintColor: tintColor,
  } as const;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="[id]"
        options={{
          ...transparentHeader,
          headerShown: true,
        }}
      />
    </Stack>
  );
}
