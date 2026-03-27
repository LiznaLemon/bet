import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import {
  RivePlayersTabIcon,
  RivePropsTabIcon,
  RiveScheduleTabIcon,
} from '@/components/rive-schedule-tab-icon';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: 'rgba(37, 37, 37, 0.5)',
          // borderTopColor: Colors[colorScheme ?? 'light'].secondaryText,
          borderTopWidth: 0.2,
          paddingTop: 10,
          paddingBottom: 10,
          minHeight: 60,
        },
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].secondaryText,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Schedule',
          tabBarIcon: () => <RiveScheduleTabIcon />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'Players',
          tabBarIcon: () => <RivePlayersTabIcon />,
        }}
      />
      <Tabs.Screen
        name="props"
        options={{
          title: 'Props',
          tabBarIcon: () => <RivePropsTabIcon />,
        }}
      />
    </Tabs>
  );
}
