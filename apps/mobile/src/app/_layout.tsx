import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModeProvider } from '../lib/mode';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ModeProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: '700' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.white },
            contentStyle: { backgroundColor: colors.bg },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(customer)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(merchant)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="shop/[code]" options={{ title: 'Print shop' }} />
          <Stack.Screen name="web" options={{ title: 'Inklly' }} />
          <Stack.Screen name="p/[shopCode]" options={{ headerShown: false }} />
        </Stack>
      </ModeProvider>
    </SafeAreaProvider>
  );
}
