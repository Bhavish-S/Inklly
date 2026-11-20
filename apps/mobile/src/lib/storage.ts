import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppMode = 'customer' | 'merchant';

const MODE_KEY = 'inklly.mode';
const ORDERS_KEY = 'inklly.orders.v1';
const MAX_ORDERS = 50;

export async function loadMode(): Promise<AppMode | null> {
  try {
    const value = await AsyncStorage.getItem(MODE_KEY);
    return value === 'customer' || value === 'merchant' ? value : null;
  } catch {
    return null;
  }
}

export async function saveMode(mode: AppMode | null): Promise<void> {
  try {
    if (mode) await AsyncStorage.setItem(MODE_KEY, mode);
    else await AsyncStorage.removeItem(MODE_KEY);
  } catch {
    // Non-fatal: the user will simply be asked again next launch.
  }
}

export type SavedOrder = {
  url: string;
  orderId: string | null;
  shopCode: string | null;
  title: string | null;
  openedAt: number;
};

type Listener = (orders: SavedOrder[]) => void;
const listeners = new Set<Listener>();

export function subscribeOrders(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadOrders(): Promise<SavedOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(ORDERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedOrder[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.openedAt - a.openedAt) : [];
  } catch {
    return [];
  }
}

async function writeOrders(orders: SavedOrder[]) {
  try {
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(orders));
}

/** Records a tracking link. Deduplicates by order id (or URL) and keeps the newest first. */
export async function rememberTrackLink(url: string, title?: string | null): Promise<void> {
  let orderId: string | null = null;
  let shopCode: string | null = null;
  try {
    const u = new URL(url);
    u.searchParams.delete('app');
    url = u.toString();
    orderId = u.searchParams.get('order') || null;
    shopCode = u.searchParams.get('shop') || null;
  } catch {
    return;
  }
  const key = orderId ?? url;
  const existing = await loadOrders();
  const previous = existing.find((o) => (o.orderId ?? o.url) === key);
  const cleanTitle = title && !/^https?:/i.test(title) ? title : previous?.title ?? null;
  const next: SavedOrder[] = [
    { url, orderId, shopCode: shopCode ?? previous?.shopCode ?? null, title: cleanTitle, openedAt: Date.now() },
    ...existing.filter((o) => (o.orderId ?? o.url) !== key),
  ].slice(0, MAX_ORDERS);
  await writeOrders(next);
}

export async function removeOrder(url: string): Promise<void> {
  const existing = await loadOrders();
  await writeOrders(existing.filter((o) => o.url !== url));
}

export async function clearOrders(): Promise<void> {
  await writeOrders([]);
}
