import { toolsApi, userAreaAlertApi } from '@urbanmind/shared-api';

export type AreaSubscription = {
  subscriptionId?: number;
  areaId: number;
  areaName?: string;
  isPrimaryArea?: boolean;
  receiveAlerts?: boolean;
};

export type AreaAlert = {
  alertId: number;
  areaId: number;
  areaName?: string;
  categoryName?: string;
  title?: string;
  message?: string;
  alertType?: string;
  severity?: string;
  status?: string;
  startAt?: string;
  endAt?: string | null;
  isSubscribedArea?: boolean;
};

export const areaAlertKeys = {
  all: ['resident-area-alerts'] as const,
  alerts: (onlySubscribed: boolean) => [...areaAlertKeys.all, 'alerts', onlySubscribed] as const,
  subscriptions: () => [...areaAlertKeys.all, 'subscriptions'] as const,
  areas: () => [...areaAlertKeys.all, 'areas'] as const,
};

export const areaAlertsApi = {
  getAlerts: (onlySubscribedAreas = true) => userAreaAlertApi.getAlerts({
    OnlySubscribedAreas: onlySubscribedAreas,
    PageNumber: 1,
    PageSize: 50,
  }) as Promise<{ items: AreaAlert[]; totalItems?: number }>,
  getSubscriptions: () => userAreaAlertApi.getSubscriptions() as Promise<AreaSubscription[]>,
  getAreas: () => toolsApi.getAreas({}, { throwOnError: true }) as Promise<any[]>,
  subscribe: (areaId: number) => userAreaAlertApi.subscribe(areaId, { receiveAlerts: true }),
  unsubscribe: (areaId: number) => userAreaAlertApi.unsubscribe(areaId),
};
