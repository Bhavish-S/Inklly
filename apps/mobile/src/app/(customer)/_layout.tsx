import React from 'react';
import { Tabs } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { tabScreenOptions } from '../../components/tabOptions';
import { tabIcon as icon } from '../../components/TabIcon';

export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={tabScreenOptions}
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => undefined) }}
    >
      <Tabs.Screen name="nearby" options={{ title: 'Nearby', headerShown: false, tabBarIcon: icon('map', 'map-outline') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('qr-code', 'qr-code-outline') }} />
      <Tabs.Screen name="orders" options={{ title: 'My orders', tabBarIcon: icon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-outline') }} />
    </Tabs>
  );
}
