import React, { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletEventHandlerFnMap, Marker as LeafletMarker } from 'leaflet';
import { FALLBACK_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL, shopPin } from './leaflet-pins';

export interface LocationPickerMapProps {
  value: { lat: number; lng: number } | null;
  onChange: (value: { lat: number; lng: number }) => void;
  /** Bumped by the parent to recentre on `value` (e.g. after "Use my current location"). */
  recenterKey?: number;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

const ClickToPlace: React.FC<{ onChange: LocationPickerMapProps['onChange'] }> = ({ onChange }) => {
  useMapEvents({ click: (e) => onChange({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }) });
  return null;
};

const Recenter: React.FC<{ value: LocationPickerMapProps['value']; recenterKey?: number }> = ({ value, recenterKey }) => {
  const map = useMap();
  useEffect(() => {
    if (value && recenterKey) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 17), { duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);
  return null;
};

/** Small map where the shop owner taps or drags a pin. Loaded lazily with Leaflet. */
const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ value, onChange, recenterKey }) => {
  const handlers = useMemo<LeafletEventHandlerFnMap>(() => ({
    dragend: (e) => {
      const { lat, lng } = (e.target as LeafletMarker).getLatLng();
      onChange({ lat: round6(lat), lng: round6(lng) });
    },
  }), [onChange]);

  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : FALLBACK_CENTER}
      zoom={value ? 17 : 12}
      className="h-full w-full"
      scrollWheelZoom={false}
    >
      <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
      <ClickToPlace onChange={onChange} />
      <Recenter value={value} recenterKey={recenterKey} />
      {value && <Marker position={[value.lat, value.lng]} draggable icon={shopPin('')} eventHandlers={handlers} />}
    </MapContainer>
  );
};

export default LocationPickerMap;
