import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { brand } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isDemoMode } from '@/lib/demo-mode';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme === 'dark' ? Colors.dark.tint : brand.green,
        tabBarInactiveTintColor: brand.inkMuted,
        tabBarStyle: { backgroundColor: brand.card, borderTopColor: brand.line, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isDemoMode ? 'Events' : 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="my-events"
        options={{
          title: 'My Events',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="calendar" color={color} />
          ),
        }}
      />

      <Tabs.Screen name="events" options={{ title: 'Events', href: isDemoMode ? null : undefined, tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} /> }} />
      <Tabs.Screen name="permissions" options={{ title: 'Permissions', href: isDemoMode ? null : undefined, tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} /> }} />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
