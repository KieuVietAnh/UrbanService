import React from 'react';
import MapView, { Marker } from 'react-native-maps';
import type { TicketLocationMapProps } from './reporting-map.types';

export default function TicketLocationMap({
  latitude,
  longitude,
  initialRegion,
  camera,
  style,
}: TicketLocationMapProps) {
  return (
    <MapView
      style={style}
      initialRegion={initialRegion}
      camera={camera}
      liteMode
      scrollEnabled={false}
      zoomEnabled={false}
    >
      <Marker coordinate={{ latitude, longitude }} />
    </MapView>
  );
}
