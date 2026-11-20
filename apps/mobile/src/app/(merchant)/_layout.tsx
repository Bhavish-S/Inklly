import React from 'react';
import { Tabs } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { tabScreenOptions } from '../../components/tabOptions';
import { tabIcon as icon } from '../../components/TabIcon';

export default function MerchantTabs() {
  return (
    <Tabs
      screenOptions={tabScreenOptions}
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => undefined) }}
    >
      <Tabs.Screen name="counter" options={{ title: 'Counter', tabBarIcon: icon('calculator', 'calculator-outline') }} />
      <Tabs.Screen
        name="merchant-orders"
        options={{ title: 'Orders', tabBarIcon: icon('file-tray-full', 'file-tray-full-outline') }}
      />
      <Tabs.Screen
        name="merchant-settings"
        options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-outline') }}
      />
    </Tabs>
  );
}
