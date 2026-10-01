import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import { Circle, Marker } from 'react-native-maps';
import { styles } from '../homeStyles';

type Coordinate = { latitude: number; longitude: number };
type IncidentMarker = Coordinate & { id: string };

type Props = {
  userLocation: Coordinate | null;
  markers: IncidentMarker[];
  onMapRef: (map: unknown) => void;
};

export default function NearbyIncidentsMap({ userLocation, markers, onMapRef }: Props) {
  return (
    <MapView
      style={{ ...StyleSheet.absoluteFillObject }}
      initialRegion={
        userLocation
          ? { latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }
          : { latitude: 10.7399, longitude: 106.7019, latitudeDelta: 0.05, longitudeDelta: 0.05 }
      }
      mapRef={onMapRef}
      onRegionChangeComplete={() => {}}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {userLocation ? (
        <>
          <Circle
            center={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
            radius={1000}
            strokeColor="rgba(37,99,235,0.18)"
            fillColor="rgba(37,99,235,0.08)"
          />
          <Marker key="__user" coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}>
            <View style={styles.mapPinUser} />
          </Marker>
        </>
      ) : null}

      {markers.map((marker, index) => (
        <Marker key={marker.id} coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}>
          <View style={[styles.mapPin, index % 3 === 0 && styles.mapPinHot, index % 3 === 1 && styles.mapPinWarn]} />
        </Marker>
      ))}
    </MapView>
  );
}
