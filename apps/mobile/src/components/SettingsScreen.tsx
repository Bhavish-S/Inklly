import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, WEB_URL, API_URL } from '../config';
import { useMode } from '../lib/mode';
import { clearOrders } from '../lib/storage';
import { colors, radius, spacing } from '../theme';
import { BrandMark } from './BrandMark';

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
};

function Row({ icon, label, detail, onPress, danger }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {!!onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

export function SettingsScreen() {
  const { mode, setMode } = useMode();
  const other = mode === 'merchant' ? 'customer' : 'merchant';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const switchMode = () => {
    Alert.alert(
      other === 'merchant' ? 'Switch to shop owner mode?' : 'Switch to customer mode?',
      other === 'merchant'
        ? 'Manage your print counter and orders. You will need to sign in to your Inklly shop account.'
        : 'Find nearby print shops, scan shop QR codes and track your orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
            await setMode(other);
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <BrandMark size={56} />
        <View style={{ marginLeft: spacing.lg, flex: 1 }}>
          <Text style={styles.heroTitle}>Inklly</Text>
          <Text style={styles.heroSub}>
            {mode === 'merchant' ? 'Shop owner mode' : 'Customer mode'} · v{version}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Mode</Text>
      <View style={styles.card}>
        <Row
          icon={other === 'merchant' ? 'storefront-outline' : 'print-outline'}
          label={other === 'merchant' ? 'I run a print shop' : 'I want to print'}
          detail={other === 'merchant' ? 'Switch to shop owner mode' : 'Switch to customer mode'}
          onPress={switchMode}
        />
      </View>

      <Text style={styles.section}>Support</Text>
      <View style={styles.card}>
        <Row
          icon="logo-whatsapp"
          label="Chat on WhatsApp"
          onPress={() => Linking.openURL(SUPPORT_WHATSAPP).catch(() => undefined)}
        />
        <View style={styles.divider} />
        <Row
          icon="mail-outline"
          label="Email support"
          detail={SUPPORT_EMAIL}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined)}
        />
        <View style={styles.divider} />
        <Row
          icon="globe-outline"
          label="Open inklly website"
          detail={WEB_URL.replace(/^https?:\/\//, '')}
          onPress={() => Linking.openURL(WEB_URL).catch(() => undefined)}
        />
      </View>

      <Text style={styles.section}>About</Text>
      <View style={styles.card}>
        <Row
          icon="document-text-outline"
          label="Privacy policy"
          onPress={() => Linking.openURL(`${WEB_URL}/legal/privacy-policy`).catch(() => undefined)}
        />
        <View style={styles.divider} />
        <Row
          icon="reader-outline"
          label="Terms of service"
          onPress={() => Linking.openURL(`${WEB_URL}/legal/terms`).catch(() => undefined)}
        />
        <View style={styles.divider} />
        <Row icon="information-circle-outline" label="Version" detail={`${version} · API ${API_URL.replace(/^https?:\/\//, '')}`} />
        {mode === 'customer' && (
          <>
            <View style={styles.divider} />
            <Row
              icon="trash-outline"
              label="Clear order history"
              danger
              onPress={() =>
                Alert.alert('Clear order history?', 'This only removes saved tracking links from this phone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => clearOrders() },
                ])
              }
            />
          </>
        )}
      </View>

      <Text style={styles.footer}>Made in India for xerox & print shops</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 62 },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.xxl },
});
