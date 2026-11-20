import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BrandMark } from '../components/BrandMark';
import { useMode } from '../lib/mode';
import type { AppMode } from '../lib/storage';
import { colors, radius, shadow, spacing } from '../theme';

type Choice = {
  mode: AppMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
};

const CHOICES: Choice[] = [
  {
    mode: 'customer',
    icon: 'print',
    title: 'I want to print',
    subtitle: 'Find a nearby xerox shop, upload documents and pay by UPI or cash.',
  },
  {
    mode: 'merchant',
    icon: 'storefront',
    title: 'I run a print shop',
    subtitle: 'Run your counter, accept orders and get paid straight to your UPI.',
  },
];

export default function Onboarding() {
  const { setMode } = useMode();

  const choose = async (mode: AppMode) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await setMode(mode);
    router.replace(mode === 'customer' ? '/nearby' : '/counter');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <BrandMark size={72} />
        <Text style={styles.title}>Welcome to Inklly</Text>
        <Text style={styles.subtitle}>Print anything at your neighbourhood xerox shop — no WhatsApp, no queues.</Text>
      </View>

      <View style={styles.choices}>
        {CHOICES.map((c) => (
          <Pressable
            key={c.mode}
            accessibilityRole="button"
            onPress={() => choose(c.mode)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={[styles.iconWrap, c.mode === 'merchant' && { backgroundColor: colors.accentSoft }]}>
              <Ionicons name={c.icon} size={28} color={c.mode === 'merchant' ? colors.accent : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardSub}>{c.subtitle}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.primary} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.footnote}>You can switch any time in Settings.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  header: { alignItems: 'center', marginTop: spacing.xxl * 1.5 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: spacing.xl, letterSpacing: -0.5 },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    maxWidth: 320,
  },
  choices: { marginTop: spacing.xxl * 1.5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  cardPressed: { transform: [{ scale: 0.98 }], borderColor: colors.primary },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18, paddingRight: spacing.sm },
  footnote: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 'auto', marginBottom: spacing.xl },
});
