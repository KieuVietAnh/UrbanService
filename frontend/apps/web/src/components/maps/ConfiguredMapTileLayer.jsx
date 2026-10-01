import { useRef, useState } from 'react';
import { TileLayer } from 'react-leaflet';

import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_PROVIDERS,
} from '../../config/mapConfig';

export function ConfiguredMapTileLayer({ onReady, onUnavailable, ...tileLayerProps }) {
  const providers = MAP_TILE_PROVIDERS;
  const [providerIndex, setProviderIndex] = useState(0);
  const failedProvidersRef = useRef(new Set());
  const activeProvider = providers[providerIndex];

  const handleLoad = (event) => {
    tileLayerProps.eventHandlers?.load?.(event);
    onReady?.();
  };

  const handleTileError = (event) => {
    tileLayerProps.eventHandlers?.tileerror?.(event);
    if (failedProvidersRef.current.has(activeProvider)) return;

    failedProvidersRef.current.add(activeProvider);
    if (providerIndex < providers.length - 1) {
      setProviderIndex((currentIndex) => Math.min(currentIndex + 1, providers.length - 1));
      return;
    }

    onUnavailable?.();
  };

  if (!activeProvider) return null;

  return (
    <TileLayer
      {...tileLayerProps}
      key={activeProvider}
      attribution={MAP_TILE_ATTRIBUTION}
      url={activeProvider}
      eventHandlers={{
        ...tileLayerProps.eventHandlers,
        load: handleLoad,
        tileerror: handleTileError,
      }}
    />
  );
}

export default ConfiguredMapTileLayer;
