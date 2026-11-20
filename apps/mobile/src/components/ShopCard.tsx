import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NearbyShop } from '../lib/api';
import { formatDistance } from '../lib/api';
import { colors, radius, spacing } from '../theme';
import { Badge } from './Badge';
import { Button } from './Button';

type Props = {
  shop: NearbyShop;
  selected?: boolean;
  onPress: () => void;
  onPrint: () => void;
};

export function ShopCard({ shop, selected, onPress, onPrint }: Props) {
  const distance = formatDistance(shop.distanceKm);
  const closed = shop.isOpenNow === false || shop.acceptingOrders === false;
  const place = [shop.landmark, shop.address, shop.city].filter(Boolean).join(', ');

  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.selected]}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{shop.name.trim().charAt(0).toUpperCase() || 'I'}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {shop.name}
            </Text>
            {!!distance && <Text style={styles.distance}>{distance}</Text>}
          </View>
          {!!shop.tagline && (
            <Text style={styles.tagline} numberOfLines={1}>
              {shop.tagline}
            </Text>
          )}
          {!!place && (
            <View style={styles.placeRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.place} numberOfLines={1}>
                {place}
              </Text>
            </View>
          )}
          <View style={styles.badges}>
            {shop.isOpenNow != null && (
              <Badge dot label={shop.isOpenNow ? 'Open now' : 'Closed'} tone={shop.isOpenNow ? 'success' : 'danger'} />
            )}
            {shop.acceptingOrders === false && shop.isOpenNow !== false && <Badge label="Not taking orders" tone="warning" />}
            {!!shop.acceptsUpi && <Badge label="UPI" tone="primary" />}
            {!!shop.acceptsCash && <Badge label="Cash" tone="accent" />}
          </View>
          {!!shop.openingHours && (
            <Text style={styles.hours} numberOfLines={1}>
              {shop.openingHours}
            </Text>
          )}
        </View>
      </View>
      <Button
        label={closed ? 'View shop' : 'Print here'}
        variant={closed ? 'secondary' : 'primary'}
        size="sm"
        onPress={onPrint}
        style={styles.cta}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.primary, borderWidth: 1.5 },
  row: { flexDirection: 'row' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  distance: { fontSize: 13, fontWeight: '700', color: colors.primary, marginLeft: spacing.sm },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  place: { flex: 1, fontSize: 12, color: colors.textMuted, marginLeft: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  hours: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  cta: { marginTop: spacing.md, alignSelf: 'stretch' },
});
