import type { StyleProp, ViewStyle } from 'react-native';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapRegion = MapCoordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapCamera = {
  center: MapCoordinate;
  pitch: number;
  heading: number;
  altitude: number;
  zoom: number;
};

export type FeedbackLocationMapHandle = {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  fitToCoordinates: (
    coordinates: MapCoordinate[],
    options?: {
      edgePadding?: { top: number; left: number; right: number; bottom: number };
      animated?: boolean;
    }
  ) => void;
};

export type FeedbackLocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onCoordinateSelect: (latitude: number, longitude: number) => void;
};

export type TicketLocationMapProps = {
  latitude: number;
  longitude: number;
  initialRegion: MapRegion;
  camera?: MapCamera;
  style: StyleProp<ViewStyle>;
};
