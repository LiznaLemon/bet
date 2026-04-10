import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import {
  RivePlayersTabIcon,
  RiveScheduleTabIcon,
} from '@/components/rive-schedule-tab-icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Content height above the home indicator; RN uses 49 by default — see `getTabBarHeight` in @react-navigation/bottom-tabs. */
const TAB_BAR_CONTENT_HEIGHT = 44;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const isLightMode = !isDark;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 0,
        },
        tabBarLabelStyle: {
          marginBottom: 0,
        },
        tabBarStyle: {
          backgroundColor: isDark ? '#000000' : colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? 'rgba(37, 37, 37, 0.5)' : colors.border,
          /**
           * `minHeight` is ignored: BottomTabBar sets `height` from `getTabBarHeight`, which only
           * reads a numeric `height` here; otherwise it uses 49 + bottom inset (UIKit default).
           */
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 2,
          ...(isDark
            ? { alignSelf: 'center', width: 240 }
            : { alignSelf: 'stretch', width: '100%' }),
        },
        tabBarInactiveTintColor: colors.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Schedule',
          tabBarIcon: () => <RiveScheduleTabIcon isLightMode={isLightMode} />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'Players',
          tabBarIcon: () => <RivePlayersTabIcon isLightMode={isLightMode} />,
        }}
      />
      <Tabs.Screen
        name="props"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
