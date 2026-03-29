import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack, router } from 'expo-router';
import { Pressable, Text } from 'react-native';

export default function GameLayout() {
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
        name="index"
        options={{
          ...transparentHeader,
          headerShown: true,
          headerBackTitle: 'Schedule',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginLeft: 8, paddingHorizontal: 8 }}>
              <Text style={{ color: tintColor, fontSize: 14 }}>‹ Schedule</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="select-props"
        options={{
          ...transparentHeader,
          title: 'Select Props',
          headerShown: true,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
