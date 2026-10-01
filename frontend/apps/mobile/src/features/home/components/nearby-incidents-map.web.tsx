import React from 'react';
import { StyleSheet, View } from 'react-native';

type Coordinate = { latitude: number; longitude: number };
type IncidentMarker = Coordinate & { id: string };

type Props = {
  userLocation: Coordinate | null;
  markers: IncidentMarker[];
  onMapRef: (map: unknown) => void;
};

export default function NearbyIncidentsMap(_props: Props) {
  return <View style={StyleSheet.absoluteFillObject} />;
}
