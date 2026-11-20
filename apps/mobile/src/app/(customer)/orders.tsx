import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { EmptyState } from '../../components/EmptyState';
import { loadOrders, removeOrder, SavedOrder, subscribeOrders } from '../../lib/storage';
import { colors, radius, spacing } from '../../theme';

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-8).toUpperCase()}` : id.toUpperCase();
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<SavedOrder[] | null>(null);

  useEffect(() => subscribeOrders(setOrders), []);
  useFocusEffect(
    useCallback(() => {
      loadOrders().then(setOrders);
    }, [])
  );

  if (orders === null) return null;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="No orders yet"
        message="When you place an order or open a tracking link in Inklly, it shows up here so you can check its status any time."
        actionLabel="Find a print shop"
        onAction={() => router.navigate('/nearby')}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={orders}
      keyExtractor={(o) => o.url}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          onPress={() => router.push({ pathname: '/web', params: { url: item.url } })}
          onLongPress={() =>
            Alert.alert('Remove this order?', 'It will be removed from this list only.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => removeOrder(item.url) },
            ])
          }
        >
          <View style={styles.icon}>
            <Ionicons name="document-text" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.orderId ? `Order ${shortId(item.orderId)}` : item.title || 'Print order'}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {[item.shopCode ? `Shop ${item.shopCode}` : null, timeAgo(item.openedAt)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.trackPill}>
            <Text style={styles.trackText}>Track</Text>
          </View>
        </Pressable>
      )}
      ListFooterComponent={<Text style={styles.hint}>Long-press an order to remove it.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  trackPill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginLeft: spacing.sm,
  },
  trackText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
});
