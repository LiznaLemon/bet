import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack, router } from 'expo-router';
import { Pressable, Text } from 'react-native';

export default function GameLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const tintColor = Colors[colorScheme].tint;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerBackTitle: 'Schedule',
          headerTintColor: tintColor,
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
          title: 'Select Props',
          headerShown: true,
          presentation: 'card',
        }}
      />
    </Stack>
  );
}
