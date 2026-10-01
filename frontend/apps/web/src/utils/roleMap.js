export { APP_ROLES, getInternalRole, getRoleLabel, ROLE_MAP } from '@urbanmind/shared-types';
export const normalizeRole = (role) => {
  const rawRole = String(role || '').trim();

  const normalizedRole = rawRole
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .replaceAll(' ', '-')
    .toLowerCase();

  const roleAliases = {
    administrator: 'administrator',
    admin: 'administrator',

    serviceuser: 'service-user',
    'service-user': 'service-user',
    citizen: 'service-user',
    user: 'service-user',

    systemstaff: 'system-staff',
    'system-staff': 'system-staff',
    staff: 'system-staff',

    serviceprovider: 'service-provider',
    'service-provider': 'service-provider',
    serviceoperator: 'service-provider',
    'service-operator': 'service-provider',
    serviceoperatorstaff: 'service-provider',
    'service-operator-staff': 'service-provider',
    operator: 'service-provider',
    provider: 'service-provider',

    interactionmanager: 'interaction-manager',
    'interaction-manager': 'interaction-manager',
  };

  return roleAliases[normalizedRole] || normalizedRole;
};

const ROLE_ENTRY_PATHS = {
  'service-user': '/',
  'system-staff': '/dashboard',
  'service-provider': '/provider/tasks',
  'interaction-manager': '/manager/interactions',
  administrator: '/admin/audit',
};

export const getRoleEntryPath = (role) => (
  ROLE_ENTRY_PATHS[normalizeRole(role)] || '/dashboard'
);
