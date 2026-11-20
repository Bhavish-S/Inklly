/** Contract for GET /api/v1/portal/shops/nearby and /api/v1/merchant/shop-profile. */

export interface OpeningHours {
  open: string;  // "HH:MM" (IST)
  close: string; // "HH:MM"; earlier than open means it closes after midnight
  closedDays: number[]; // 0 = Sunday ... 6 = Saturday
}

export interface NearbyShop {
  shopCode: string;
  name: string;
  tagline: string | null;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  landmark: string | null;
  openingHours: OpeningHours | null;
  isOpenNow: boolean | null;
  acceptingOrders: boolean;
  acceptsUpi: boolean;
  acceptsCash: boolean;
  portalPath: string;
}

export interface NearbyShopsQuery {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  q?: string;
}

export interface ShopProfile {
  latitude: number | null;
  longitude: number | null;
  landmark: string | null;
  openingHours: OpeningHours | null;
  listedOnMap: boolean;
  updatedAt: string | null;
}

export type ShopProfileUpdate = Partial<Pick<ShopProfile, 'latitude' | 'longitude' | 'landmark' | 'openingHours' | 'listedOnMap'>>;
