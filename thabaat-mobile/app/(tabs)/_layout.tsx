import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brand, fonts } from '@/constants/brand';
import { useRole } from '@/hooks/useRole';
import { showsAdminTab, showsTeamTab } from '@/lib/app-role';
import { isDemoMode } from '@/lib/demo-mode';

// Everyone sees Home, Events and Account. Volunteers add Team; admins and organizers add Team and Admin.
export default function TabLayout() {
  const { role } = useRole();
  const hidden = (show: boolean) => (show && !isDemoMode ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: brand.tealText, // teal at the point: the active tab, never a surface
        tabBarInactiveTintColor: brand.inkMuted,
        tabBarStyle: { backgroundColor: brand.card, borderTopColor: brand.line, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.label },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} /> }} />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: ({ color }) => <IconSymbol size={26} name="ticket.fill" color={color} /> }} />
      <Tabs.Screen name="team" options={{ title: 'Team', href: hidden(showsTeamTab(role)), tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.3.fill" color={color} /> }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', href: hidden(showsAdminTab(role)), tabBarIcon: ({ color }) => <IconSymbol size={26} name="gearshape.fill" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Account', tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.crop.circle" color={color} /> }} />
    </Tabs>
  );
}
