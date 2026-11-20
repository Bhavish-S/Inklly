import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useMode } from '../lib/mode';
import { colors } from '../theme';

/** Entry gate: routes to onboarding or the remembered mode. */
export default function Index() {
  const { mode, ready } = useMode();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (mode === 'customer') return <Redirect href="/nearby" />;
  if (mode === 'merchant') return <Redirect href="/counter" />;
  return <Redirect href="/onboarding" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
