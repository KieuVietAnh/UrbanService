import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import ConfiguredMapTileLayer from './ConfiguredMapTileLayer';
import { createIncidentMarkerIcon, getGroupedIncidentMarkerStatus } from './incidentMarkerIcon';


const STATUS_LABELS = {
  submitted: 'Đã gửi',
  aireviewed: 'Đã phân loại tự động',
  verified: 'Đã xác minh',
  assigned: 'Đã chuyển xử lý',
  inprogress: 'Đang xử lý',
  resolved: 'Đã có kết quả',
  submittedforapproval: 'Đang kiểm tra kết quả',
  needrework: 'Cần xử lý lại',
  approved: 'Chờ người dân đánh giá',
  closed: 'Đã kết thúc',
};

const PRIORITY_LABELS = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
  urgent: 'Khẩn cấp',
};

const CATEGORY_LABELS = {
  'garbage collection': 'Thu gom rác',
  'waste management': 'Quản lý chất thải',
  'road maintenance': 'Bảo trì đường bộ',
  'street lighting': 'Chiếu sáng đô thị',
  drainage: 'Thoát nước',
  'water supply': 'Cấp nước',
  'public safety': 'An toàn công cộng',
};

const normalizeLookupKey = (value) => (
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLocaleLowerCase('en-US')
);

const translateStatus = (value) => (
  STATUS_LABELS[normalizeLookupKey(value)] ||
  value ||
  'Chưa xác định'
);

const translatePriority = (value) => (
  PRIORITY_LABELS[
    String(value || '').trim().toLocaleLowerCase('en-US')
  ] ||
  value ||
  'Chưa xác định'
);

const translateCategory = (value) => {
  const normalizedCategory = String(value || '')
    .trim()
    .toLocaleLowerCase('en-US');

  return (
    CATEGORY_LABELS[normalizedCategory] ||
    value ||
    'Chưa xác định'
  );
};

const DEFAULT_CENTER = [10.776530, 106.700981];
const DEFAULT_ZOOM = 12;

const isValidCoordinate = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isValidLocation = (latitude, longitude) => isValidCoordinate(latitude, -90, 90) && isValidCoordinate(longitude, -180, 180);
const hasCoordinateValue = (value) => value != null && !(typeof value === 'string' && !value.trim());
const hasValidLocationValue = (latitude, longitude) => (
  hasCoordinateValue(latitude) &&
  hasCoordinateValue(longitude) &&
  isValidLocation(Number(latitude), Number(longitude))
);

const distanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

function AreaBoundaryAutoFit({ boundaryGeoJson, centerLatitude, centerLongitude, areaKey }) {
  const map = useMap();

  useEffect(() => {
    if (boundaryGeoJson) {
      const layer = L.geoJSON(boundaryGeoJson);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [36, 36],
          maxZoom: 14,
          animate: true,
          duration: 0.65,
        });
        return;
      }
    }

    if (hasValidLocationValue(centerLatitude, centerLongitude)) {
      map.setView([Number(centerLatitude), Number(centerLongitude)], 14, { animate: true });
    }
  }, [areaKey, boundaryGeoJson, centerLatitude, centerLongitude, map]);

  return null;
}

function AutoFitBounds({ incidents, fitRequestKey }) {
  const map = useMap();

  const validPositions = useMemo(
    () => incidents
      .filter((incident) => isValidLocation(incident.latitude, incident.longitude))
      .map((incident) => [incident.latitude, incident.longitude]),
    [incidents]
  );

  useEffect(() => {
    if (validPositions.length > 0) {
      map.fitBounds(validPositions, {
        padding: [40, 40],
        maxZoom: 15,
        animate: true,
      });
    } else {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
    }
  }, [fitRequestKey, map, validPositions]);

  return null;
}


const getMapEntityId = (item) => (
  item?.incidentId || item?.feedbackId || item?.id || ''
);

function FocusIncident({ feedbackId, latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!feedbackId || !isValidLocation(lat, lng)) return undefined;

    const target = [lat, lng];
    let timerId;

    const finishFocus = () => {
      map.fire('focusedincidentready', { feedbackId: String(feedbackId) });
    };

    map.stop();
    map.setView(target, 13, { animate: false });

    timerId = window.setTimeout(() => {
      map.once('moveend', finishFocus);
      map.flyTo(target, 17, {
        animate: true,
        duration: 0.8,
        easeLinearity: 0.25,
      });
    }, 250);

    return () => {
      window.clearTimeout(timerId);
      map.off('moveend', finishFocus);
    };
  }, [feedbackId, latitude, longitude, map]);

  return null;
}

const IncidentMarker = ({ marker, focusFeedbackId, openFeedbackDetail, entityLabel = 'phản ánh' }) => {
  const map = useMap();
  const markerRef = useRef(null);
  const containsFocusedFeedback = marker.tickets.some((ticket) => (
    String(getMapEntityId(ticket)) === String(focusFeedbackId)
  ));

  useEffect(() => {
    if (!containsFocusedFeedback || !markerRef.current) return undefined;

    const openFocusedPopup = (event) => {
      if (String(event?.feedbackId) !== String(focusFeedbackId)) return;
      markerRef.current?.openPopup();
    };

    map.on('focusedincidentready', openFocusedPopup);
    return () => map.off('focusedincidentready', openFocusedPopup);
  }, [containsFocusedFeedback, focusFeedbackId, map]);

  const markerStatus = getGroupedIncidentMarkerStatus(marker.tickets);
  const markerIcon = useMemo(
    () => createIncidentMarkerIcon(markerStatus, {
      count: marker.tickets.length,
      focused: containsFocusedFeedback,
    }),
    [containsFocusedFeedback, marker.tickets.length, markerStatus]
  );

  return (
    <Marker
      ref={markerRef}
      position={[marker.latitude, marker.longitude]}
      icon={markerIcon}
      eventHandlers={{
        click: (event) => {
          event.target.openPopup();
        },
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95} sticky interactive={false} className="pointer-events-none">
        <div className="space-y-1 text-xs">
          {marker.tickets.length === 1 ? (
            <>
              <div className="truncate font-bold text-slate-900">
                {marker.tickets[0].title}
              </div>
              <div>
                Danh mục: {translateCategory(marker.tickets[0].categoryName)}
              </div>
              <div>
                Trạng thái: {translateStatus(marker.tickets[0].status)}
              </div>
              <div>
                Mức độ ảnh hưởng: {translatePriority(marker.tickets[0].priority)}
              </div>
            </>
          ) : (
            <div className="truncate font-bold text-slate-900">{marker.tickets.length} {entityLabel} tại điểm này</div>
          )}
        </div>
      </Tooltip>
      <Popup
        autoPan={true}
        keepInView={true}
        maxWidth={360}
        minWidth={300}
        className="incident-map-popup"
      >
        <div className="space-y-3 text-xs">
          <div className="font-bold text-slate-900">
            {marker.tickets.length === 1
              ? `Thông tin ${entityLabel}`
              : `${marker.tickets.length} ${entityLabel} tại điểm này`}
          </div>
          <div className="incident-map-popup-list grid gap-2 pr-1">
            {marker.tickets.map((ticket) => (
              <button
                key={getMapEntityId(ticket) || `${ticket.latitude}-${ticket.longitude}`}
                type="button"
                onClick={() => openFeedbackDetail(ticket)}
                className={`w-full rounded-2xl border bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-primary hover:bg-slate-50 ${
                  String(getMapEntityId(ticket)) === String(focusFeedbackId)
                    ? 'border-primary ring-2 ring-primary/15'
                    : 'border-slate-200'
                }`}
              >
                <div className="incident-map-ticket-title font-bold">{ticket.title}</div>
                <div className="incident-map-ticket-meta mt-1 text-[10px] font-normal text-slate-500">
                  {translateCategory(ticket.categoryName)}
                  {' · '}
                  {translateStatus(ticket.status)}
                  {' · '}
                  {translatePriority(ticket.priority)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Popup>
    </Marker>
  );
};


const priorityHeatWeight = (value) => {
  const key = String(value || '').trim().toLocaleLowerCase('en-US');
  if (key === 'urgent' || key === 'critical') return 1;
  if (key === 'high') return 0.82;
  if (key === 'medium') return 0.58;
  if (key === 'low') return 0.38;
  return 0.45;
};

function IncidentHeatLayer({ incidents, weightBuilder }) {
  const validIncidents = useMemo(
    () => (Array.isArray(incidents) ? incidents : []).filter((incident) => (
      isValidLocation(incident?.latitude, incident?.longitude)
    )),
    [incidents],
  );

  return validIncidents.map((incident) => {
    const rawWeight = typeof weightBuilder === 'function'
      ? Number(weightBuilder(incident))
      : priorityHeatWeight(incident?.priority);
    const weight = Number.isFinite(rawWeight) ? Math.min(Math.max(rawWeight, 0.2), 1) : 0.45;
    const radius = 18 + Math.round(weight * 24);

    return (
      <CircleMarker
        key={`heat-${getMapEntityId(incident) || `${incident.latitude}-${incident.longitude}`}`}
        center={[incident.latitude, incident.longitude]}
        radius={radius}
        pathOptions={{
          stroke: false,
          fill: true,
          fillColor: '#ef4444',
          fillOpacity: 0.08 + (weight * 0.18),
        }}
        interactive={false}
      />
    );
  });
}

function PersistMapView({ onViewStateChange }) {
  const map = useMap();

  useEffect(() => {
    if (typeof onViewStateChange !== 'function') return undefined;

    const persist = () => {
      const center = map.getCenter();
      onViewStateChange({
        latitude: center.lat,
        longitude: center.lng,
        zoom: map.getZoom(),
      });
    };

    map.on('moveend', persist);
    map.on('zoomend', persist);
    return () => {
      map.off('moveend', persist);
      map.off('zoomend', persist);
    };
  }, [map, onViewStateChange]);

  return null;
}

const IncidentMapThemeStyles = () => (
  <style>{`
    .incident-map-shell {
      position: relative;
      isolation: isolate;
      z-index: 0;
      border-color: rgba(203, 213, 225, 0.82);
      background: #ffffff;
    }

    .incident-map-shell .leaflet-container {
      position: relative;
      z-index: 0;
      height: 100%;
      width: 100%;
      background: #dbeafe;
    }

    .incident-map-shell .leaflet-control-zoom,
    .incident-map-shell .leaflet-control-attribution {
      border: 1px solid rgba(148, 163, 184, 0.5) !important;
      border-radius: 12px !important;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14) !important;
    }

    .incident-map-shell .leaflet-control-zoom a {
      border-color: rgba(203, 213, 225, 0.78) !important;
      background: rgba(255, 255, 255, 0.94) !important;
      color: #334155 !important;
    }

    .incident-map-shell .leaflet-control-zoom a:hover {
      background: #eff6ff !important;
      color: #1d4ed8 !important;
    }

    .incident-map-shell .leaflet-control-attribution {
      background: rgba(255, 255, 255, 0.86) !important;
      color: #64748b !important;
      backdrop-filter: blur(8px);
    }

    .incident-map-shell .leaflet-popup-content-wrapper,
    .incident-map-shell .leaflet-popup-tip,
    .incident-map-shell .leaflet-tooltip {
      border: 1px solid rgba(203, 213, 225, 0.82);
      background: rgba(255, 255, 255, 0.97);
      color: #334155;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
    }

    .incident-map-shell .leaflet-popup-content-wrapper {
      border-radius: 16px;
    }

    .incident-map-shell .incident-map-popup .leaflet-popup-content {
      width: min(330px, calc(100vw - 72px)) !important;
      margin: 14px 16px 16px;
    }

    .incident-map-shell .incident-map-popup-list {
      max-height: 250px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.7) transparent;
    }

    .incident-map-shell .incident-map-popup-list::-webkit-scrollbar {
      width: 6px;
    }

    .incident-map-shell .incident-map-popup-list::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.7);
    }

    .incident-map-shell .incident-map-ticket-title {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-height: 1.35;
    }

    .incident-map-shell .incident-map-ticket-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .incident-map-shell .leaflet-popup-close-button {
      color: #64748b !important;
    }

    html[data-theme="dark"] .incident-map-shell {
      border-color: rgba(96, 165, 250, 0.2);
      background: #0a1930;
      box-shadow:
        0 22px 58px rgba(0, 0, 0, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-container {
      background: #10223a;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-tile-pane {
      filter:
        invert(0.74)
        hue-rotate(176deg)
        brightness(0.9)
        contrast(0.82)
        saturate(0.62);
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-tile {
      opacity: 0.96;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-control-zoom,
    html[data-theme="dark"] .incident-map-shell .leaflet-control-attribution {
      border-color: rgba(96, 165, 250, 0.22) !important;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28) !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-control-zoom a,
    html[data-theme="dark"] .incident-map-shell .leaflet-control-attribution {
      border-color: rgba(96, 165, 250, 0.18) !important;
      background: rgba(7, 20, 39, 0.92) !important;
      color: #dbeafe !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-control-zoom a:hover {
      background: rgba(17, 38, 70, 0.98) !important;
      color: #ffffff !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-popup-content-wrapper,
    html[data-theme="dark"] .incident-map-shell .leaflet-popup-tip,
    html[data-theme="dark"] .incident-map-shell .leaflet-tooltip {
      border-color: rgba(96, 165, 250, 0.2) !important;
      background: rgba(11, 24, 48, 0.97) !important;
      color: #dbeafe !important;
      box-shadow: 0 22px 54px rgba(0, 0, 0, 0.4) !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-popup-close-button {
      color: #93c5fd !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-popup-content button {
      border-color: rgba(96, 165, 250, 0.2) !important;
      background: rgba(13, 29, 54, 0.92) !important;
      color: #e8eef8 !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-popup-content button:hover {
      border-color: rgba(56, 189, 248, 0.4) !important;
      background: rgba(17, 38, 70, 0.98) !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-popup-content .text-slate-900,
    html[data-theme="dark"] .incident-map-shell .leaflet-tooltip .text-slate-900 {
      color: #f8fafc !important;
    }

    html[data-theme="dark"] .incident-map-shell .leaflet-popup-content .text-slate-500 {
      color: #9fb0c7 !important;
    }
  `}</style>
);

export const IncidentMap = ({
  incidents,
  fitRequestKey = 0,
  focusFeedbackId = null,
  focusIncidentId = null,
  focusLatitude = null,
  focusLongitude = null,
  detailPathBuilder = null,
  detailStateBuilder = null,
  entityLabel = 'phản ánh',
  returnPath = '/community/map',
  showMarkers = true,
  showHeatLayer = false,
  heatWeightBuilder = null,
  initialViewState = null,
  onViewStateChange = null,
  areaBoundaryGeoJson = null,
  areaBoundaryKey = null,
  areaCenterLatitude = null,
  areaCenterLongitude = null,
  fitBoundaryGeoJson = null,
  autoFitIncidents = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasInitialView = Boolean(
    initialViewState &&
    isValidLocation(Number(initialViewState.latitude), Number(initialViewState.longitude)) &&
    Number.isFinite(Number(initialViewState.zoom))
  );
  const { theme } = useTheme();
  const resolvedFocusId = focusIncidentId || focusFeedbackId;

  const openFeedbackDetail = (ticket) => {
    const currentUserId = user?.userId ?? user?.id;
    const isOwnFeedback =
      currentUserId != null &&
      ticket?.reporterUserId != null &&
      String(ticket.reporterUserId) === String(currentUserId);
    const detailPath = detailPathBuilder
      ? detailPathBuilder(ticket)
      : isOwnFeedback
        ? `/tickets/${ticket.feedbackId}`
        : `/community/feed/${ticket.incidentId || ticket.feedbackId}`;

    const extraDetailState = typeof detailStateBuilder === 'function'
      ? detailStateBuilder(ticket) || {}
      : {};

    navigate(detailPath, {
      state: {
        ...extraDetailState,
        from: returnPath,
        mapState: {
          focusMap: true,
          ...(ticket?.incidentId
            ? { focusIncidentId: ticket.incidentId }
            : { focusFeedbackId: ticket.feedbackId }),
          focusLatitude: ticket.latitude,
          focusLongitude: ticket.longitude,
        },
      },
    });
  };

  const incidentsWithFocusedMarker = useMemo(() => {
    const source = Array.isArray(incidents) ? incidents : [];
    const focusLat = Number(focusLatitude);
    const focusLng = Number(focusLongitude);
    const hasFocusedTicket = source.some((incident) => (
      String(getMapEntityId(incident)) === String(resolvedFocusId)
    ));

    if (!resolvedFocusId || !isValidLocation(focusLat, focusLng) || hasFocusedTicket) {
      return source;
    }

    return [
      ...source,
      {
        ...(focusIncidentId ? { incidentId: resolvedFocusId } : { feedbackId: resolvedFocusId }),
        latitude: focusLat,
        longitude: focusLng,
        title: `${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} đang xem`,
        categoryName: 'Chưa có thông tin',
        status: '',
        priority: '',
      },
    ];
  }, [entityLabel, focusIncidentId, focusLatitude, focusLongitude, incidents, resolvedFocusId]);

  const markers = useMemo(() => {
    const validIncidents = incidentsWithFocusedMarker.filter((incident) => isValidLocation(incident.latitude, incident.longitude));
    const groups = [];
    const threshold = 40; // khoảng cách gần nhau (m)

    validIncidents.forEach((incident) => {
      const existingGroup = groups.find((group) =>
        distanceMeters(group.latitude, group.longitude, incident.latitude, incident.longitude) <= threshold
      );

      if (existingGroup) {
        existingGroup.tickets.push(incident);
      } else {
        groups.push({
          latitude: incident.latitude,
          longitude: incident.longitude,
          tickets: [incident],
        });
      }
    });

    return groups;
  }, [incidentsWithFocusedMarker]);

  return (
    <>
      <IncidentMapThemeStyles />
      <div className="public-map-stack incident-map-shell h-[550px] w-full overflow-hidden border-0 shadow-none transition-shadow duration-200 ease-out map-interaction">
        <MapContainer
          center={
            initialViewState && isValidLocation(Number(initialViewState.latitude), Number(initialViewState.longitude))
              ? [Number(initialViewState.latitude), Number(initialViewState.longitude)]
              : DEFAULT_CENTER
          }
          zoom={Number.isFinite(Number(initialViewState?.zoom)) ? Number(initialViewState.zoom) : DEFAULT_ZOOM}
          scrollWheelZoom={true}
          className="relative z-0 h-full w-full"
          zoomControl={true}
          preferCanvas={true}
        >
          <ConfiguredMapTileLayer
            key={theme}
          />
          <PersistMapView onViewStateChange={onViewStateChange} />
          {areaBoundaryGeoJson ? (
            <GeoJSON
              key={`manager-area-boundary-${areaBoundaryKey || 'selected'}`}
              data={areaBoundaryGeoJson}
              style={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.12,
                opacity: 0.92,
                weight: 3,
              }}
              interactive={false}
            />
          ) : null}
          {resolvedFocusId ? (
            <FocusIncident
              feedbackId={resolvedFocusId}
              latitude={focusLatitude}
              longitude={focusLongitude}
            />
          ) : areaBoundaryGeoJson || hasValidLocationValue(areaCenterLatitude, areaCenterLongitude) ? (
            <AreaBoundaryAutoFit
              boundaryGeoJson={areaBoundaryGeoJson}
              centerLatitude={areaCenterLatitude}
              centerLongitude={areaCenterLongitude}
              areaKey={areaBoundaryKey}
            />
          ) : fitBoundaryGeoJson ? (
            <AreaBoundaryAutoFit
              boundaryGeoJson={fitBoundaryGeoJson}
              centerLatitude={null}
              centerLongitude={null}
              areaKey="all-managed-areas"
            />
          ) : autoFitIncidents || !hasInitialView || fitRequestKey > 0 ? (
            <AutoFitBounds
              incidents={markers}
              fitRequestKey={fitRequestKey}
            />
          ) : null}
          {showHeatLayer ? (
            <IncidentHeatLayer incidents={incidentsWithFocusedMarker} weightBuilder={heatWeightBuilder} />
          ) : null}
          {showMarkers ? markers.map((marker) => (
            <IncidentMarker
              key={`${marker.latitude}-${marker.longitude}`}
              marker={marker}
              focusFeedbackId={resolvedFocusId}
              openFeedbackDetail={openFeedbackDetail}
              entityLabel={entityLabel}
            />
          )) : null}
        </MapContainer>
      </div>
    </>
  );
};

export default IncidentMap;
