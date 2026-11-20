import React from 'react';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/** Builds a `tabBarIcon` renderer that switches between filled (active) and outline icons. */
export function tabIcon(active: IconName, inactive: IconName) {
  return function TabBarIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color as string} />;
  };
}
