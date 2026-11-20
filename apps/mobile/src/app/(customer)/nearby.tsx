import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EmptyState } from '../../components/EmptyState';
import { ShopCard } from '../../components/ShopCard';
import { fetchNearbyShops, NearbyShop } from '../../lib/api';
import { colors, radius, shadow, spacing } from '../../theme';

type Coords = { lat: number; lng: number };
type LocStatus = 'pending' | 'granted' | 'denied' | 'unavailable';
type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; shops: NearbyShop[]; unavailable?: boolean }
  | { kind: 'error'; message: string };

const INDIA_REGION: Region = { latitude: 21.1458, longitude: 79.0882, latitudeDelta: 22, longitudeDelta: 22 };
const PEEK_HEIGHT = 132;

function regionFor(c: Coords, delta = 0.08): Region {
  return { latitude: c.lat, longitude: c.lng, latitudeDelta: delta, longitudeDelta: delta };
}

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<NearbyShop>>(null);

  const [locStatus, setLocStatus] = useState<LocStatus>('pending');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [selected, setSelected] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  // ---------- Location ----------
  const locate = useCallback(async () => {
    setSearchNote(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocStatus('denied');
        return;
      }
      setLocStatus('granted');
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
      if (last) {
        setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
        setPlaceLabel(null);
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: current.coords.latitude, lng: current.coords.longitude });
      setPlaceLabel(null);
      setActiveQuery('');
    } catch {
      setLocStatus((s) => (s === 'granted' ? s : 'unavailable'));
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  // ---------- Data ----------
  const load = useCallback(async (c: Coords, q: string) => {
    setState({ kind: 'loading' });
    const res = await fetchNearbyShops({ lat: c.lat, lng: c.lng, q });
    if (res.status === 'error') setState({ kind: 'error', message: res.message });
    else setState({ kind: 'done', shops: res.shops, unavailable: res.status === 'unavailable' });
    return res;
  }, []);

  const skipLoadRef = useRef(false);
  useEffect(() => {
    if (!coords) return;
    if (skipLoadRef.current) {
      skipLoadRef.current = false; // results were already fetched by runSearch
      return;
    }
    mapRef.current?.animateToRegion(regionFor(coords), 600);
    load(coords, activeQuery);
  }, [coords, activeQuery, load]);

  const shops = state.kind === 'done' ? state.shops : [];

  // Fit the map to the results once they arrive.
  useEffect(() => {
    if (!coords || shops.length === 0) return;
    const points = shops.slice(0, 10).map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
    points.push({ latitude: coords.lat, longitude: coords.lng });
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 140, right: 60, bottom: 360, left: 60 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [shops, coords]);

  // ---------- Search ----------
  const runSearch = useCallback(async () => {
    const text = query.trim();
    Keyboard.dismiss();
    setSearchNote(null);
    if (!text) {
      setActiveQuery('');
      if (!coords) locate();
      return;
    }
    // 1) Near the current point, treat the text as a shop name / area filter.
    if (coords) {
      setState({ kind: 'loading' });
      const res = await fetchNearbyShops({ lat: coords.lat, lng: coords.lng, q: text });
      if (res.status === 'ok' && res.shops.length > 0) {
        setState({ kind: 'done', shops: res.shops });
        if (text !== activeQuery) skipLoadRef.current = true;
        setActiveQuery(text);
        return;
      }
    }
    // 2) Otherwise treat it as a city / area and recentre there.
    try {
      setState({ kind: 'loading' });
      const results = await Location.geocodeAsync(`${text}, India`);
      if (results.length > 0) {
        setPlaceLabel(text);
        setActiveQuery('');
        setCoords({ lat: results[0].latitude, lng: results[0].longitude });
        return;
      }
    } catch {
      // fall through
    }
    setSearchNote(`Couldn't find "${text}". Try a city or area name, e.g. "Koramangala, Bengaluru".`);
    if (coords) load(coords, activeQuery);
    else setState({ kind: 'idle' });
  }, [query, coords, load, locate, activeQuery]);

  // ---------- Bottom sheet ----------
  const [containerH, setContainerH] = useState(0);
  const sheetH = Math.max(containerH * 0.86, 300);
  const snaps = useMemo(() => {
    const expanded = 0;
    const half = Math.max(sheetH - containerH * 0.45, 0);
    const peek = Math.max(sheetH - PEEK_HEIGHT, 0);
    return { expanded, half, peek };
  }, [sheetH, containerH]);
  const translateY = useRef(new Animated.Value(0)).current;
  const currentY = useRef(0);
  const initialised = useRef(false);

  useEffect(() => {
    if (!containerH) return;
    if (!initialised.current) {
      initialised.current = true;
      translateY.setValue(snaps.half);
      currentY.current = snaps.half;
    }
  }, [containerH, snaps.half, translateY]);

  const snapTo = useCallback(
    (y: number) => {
      currentY.current = y;
      Animated.spring(translateY, { toValue: y, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.8 }).start();
    },
    [translateY]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => translateY.stopAnimation((v) => (currentY.current = v)),
        onPanResponderMove: (_e, g) => {
          const next = Math.min(Math.max(currentY.current + g.dy, snaps.expanded), snaps.peek);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const projected = Math.min(Math.max(currentY.current + g.dy + g.vy * 120, snaps.expanded), snaps.peek);
          const candidates = [snaps.expanded, snaps.half, snaps.peek];
          const target = candidates.reduce((a, b) => (Math.abs(b - projected) < Math.abs(a - projected) ? b : a));
          snapTo(target);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [snaps, snapTo, translateY]
  );

  const toggleSheet = () => snapTo(currentY.current === snaps.expanded ? snaps.half : snaps.expanded);

  const selectShop = (shop: NearbyShop, index: number, fromMap: boolean) => {
    Haptics.selectionAsync().catch(() => undefined);
    setSelected(shop.shopCode);
    mapRef.current?.animateToRegion(regionFor({ lat: shop.latitude, lng: shop.longitude }, 0.02), 450);
    if (fromMap) {
      if (currentY.current === snaps.peek) snapTo(snaps.half);
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    }
  };

  const openShop = (shop: NearbyShop) => {
    router.push({ pathname: '/shop/[code]', params: { code: shop.shopCode, name: shop.name } });
  };

  // ---------- Render ----------
  const headline = (() => {
    if (state.kind === 'loading') return 'Finding print shops…';
    if (state.kind === 'done' && shops.length > 0)
      return `${shops.length} print shop${shops.length === 1 ? '' : 's'} ${placeLabel ? `near ${placeLabel}` : 'near you'}`;
    if (locStatus === 'pending') return 'Getting your location…';
    if (!coords) return 'Find a print shop';
    return placeLabel ? `Near ${placeLabel}` : 'Near you';
  })();

  const renderEmpty = () => {
    if (state.kind === 'loading' || (locStatus === 'pending' && !coords)) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (!coords) {
      return (
        <EmptyState
          compact
          icon="navigate-circle-outline"
          title={locStatus === 'denied' ? 'Location is off' : "Couldn't get your location"}
          message="Search for your city or area above, or allow location to see the closest print shops."
          actionLabel="Use my location"
          onAction={locate}
        />
      );
    }
    if (state.kind === 'error') {
      return (
        <EmptyState
          compact
          icon="cloud-offline-outline"
          title="Couldn't load shops"
          message={state.message}
          actionLabel="Try again"
          onAction={() => load(coords, activeQuery)}
        />
      );
    }
    return (
      <EmptyState
        compact
        icon="storefront-outline"
        title={activeQuery ? `No shops match "${activeQuery}"` : 'No Inklly shops nearby yet'}
        message={
          state.kind === 'done' && state.unavailable
            ? 'Nearby search is being rolled out. Meanwhile, scan the QR code at any Inklly print shop.'
            : 'Try another area, or scan the Inklly QR code at your print shop.'
        }
        actionLabel="Scan a shop QR"
        onAction={() => router.navigate('/scan')}
      />
    );
  };

  return (
    <View style={styles.screen} onLayout={(e: LayoutChangeEvent) => setContainerH(e.nativeEvent.layout.height)}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={coords ? regionFor(coords) : INDIA_REGION}
        showsUserLocation={locStatus === 'granted'}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={{ top: insets.top + 70, right: 0, bottom: PEEK_HEIGHT, left: 0 }}
      >
        {shops.map((shop, index) => (
          <Marker
            key={shop.shopCode}
            coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
            title={shop.name}
            description={shop.isOpenNow === false ? 'Closed now · tap to view' : 'Tap to print here'}
            pinColor={shop.shopCode === selected ? colors.accent : colors.primary}
            onPress={() => selectShop(shop, index, true)}
            onCalloutPress={() => openShop(shop)}
          />
        ))}
      </MapView>

      {/* Search bar */}
      <View style={[styles.searchWrap, { top: insets.top + spacing.sm }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={coords ? 'Search shop, area or city' : 'Search your city or area'}
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            onSubmitEditing={runSearch}
            style={styles.searchInput}
          />
          {!!query && (
            <Pressable
              hitSlop={10}
              onPress={() => {
                setQuery('');
                setSearchNote(null);
                if (activeQuery) setActiveQuery('');
              }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityLabel="Use my location"
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            setQuery('');
            locate();
          }}
          style={({ pressed }) => [styles.locateBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="locate" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Bottom sheet */}
      {containerH > 0 && (
        <Animated.View style={[styles.sheet, { height: sheetH, transform: [{ translateY }] }]}>
          <View {...pan.panHandlers}>
            <Pressable onPress={toggleSheet} style={styles.handleArea}>
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {headline}
              </Text>
              {!!searchNote && <Text style={styles.searchNote}>{searchNote}</Text>}
            </View>
          </View>
          <FlatList
            ref={listRef}
            data={shops}
            keyExtractor={(s) => s.shopCode}
            contentContainerStyle={[styles.listContent, { paddingBottom: snaps.peek + spacing.xl }]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={renderEmpty}
            onScrollToIndexFailed={({ index, averageItemLength }) =>
              listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
            }
            renderItem={({ item, index }) => (
              <ShopCard
                shop={item}
                selected={item.shopCode === selected}
                onPress={() => selectShop(item, index, false)}
                onPrint={() => openShop(item)}
              />
            )}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primarySoft },
  searchWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, marginLeft: spacing.sm, paddingVertical: 0 },
  locateBtn: {
    width: 50,
    height: 50,
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  searchNote: { fontSize: 12, color: colors.danger, marginTop: 4 },
  listContent: { paddingHorizontal: spacing.lg },
  loadingBox: { paddingVertical: spacing.xxl, alignItems: 'center' },
});
