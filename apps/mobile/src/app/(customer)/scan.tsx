import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { extractShopCode, isInkllyUrl } from '../../config';
import { colors, radius, spacing } from '../../theme';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const [message, setMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const handledRef = useRef(false);

  // Re-arm the scanner every time the tab is shown.
  useFocusEffect(
    useCallback(() => {
      handledRef.current = false;
      setMessage(null);
    }, [])
  );

  const openShop = (code: string) => {
    router.push({ pathname: '/shop/[code]', params: { code } });
  };

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (handledRef.current) return;
    const text = (data || '').trim();
    const shopCode = extractShopCode(text);
    if (shopCode) {
      handledRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      openShop(shopCode);
      return;
    }
    if (isInkllyUrl(text)) {
      handledRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.push({ pathname: '/web', params: { url: text } });
      return;
    }
    if (message === null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
    setMessage(/^upi:/i.test(text) ? 'This is a UPI payment QR, not an Inklly shop QR.' : 'Not an Inklly shop QR code. Look for the Inklly QR at the counter.');
  };

  const submitManual = () => {
    const raw = manualCode.trim();
    if (!raw) return;
    const code = extractShopCode(raw) ?? raw.replace(/[^a-zA-Z0-9_-]/g, '');
    if (code) openShop(code);
  };

  const manualEntry = (
    <View style={styles.manual}>
      <Text style={styles.manualLabel}>Or enter the shop code</Text>
      <View style={styles.manualRow}>
        <TextInput
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="e.g. RAVIXEROX"
          placeholderTextColor="#94A3B8"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={submitManual}
          style={styles.input}
        />
        <Button label="Open" size="sm" onPress={submitManual} style={styles.manualButton} />
      </View>
    </View>
  );

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <EmptyState
          icon="camera-outline"
          title="Scan a shop's QR code"
          message="Allow camera access to scan the Inklly QR code at any print shop counter."
          actionLabel={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
          onAction={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        />
        <View style={styles.manualPad}>{manualEntry}</View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.cameraWrap}>
        {isFocused && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
          />
        )}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.overlayText}>Point at the Inklly QR code on the shop counter</Text>
        </View>
        {!!message && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{message}</Text>
          </View>
        )}
      </View>
      <View style={styles.manualPad}>{manualEntry}</View>
    </KeyboardAvoidingView>
  );
}

const FRAME = 240;
const CORNER = 34;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  cameraWrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  overlayText: {
    color: colors.white,
    marginTop: spacing.xl,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  toastText: { color: colors.white, fontSize: 13, textAlign: 'center' },
  manualPad: { padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  manual: {},
  manualLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
  manualRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  manualButton: { marginLeft: spacing.sm, height: 44 },
});
