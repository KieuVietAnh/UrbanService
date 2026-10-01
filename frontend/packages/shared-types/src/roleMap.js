export const APP_ROLES = Object.freeze({
  SERVICE_USER: 'service-user',
  SYSTEM_STAFF: 'system-staff',
  SERVICE_PROVIDER: 'service-provider',
  INTERACTION_MANAGER: 'interaction-manager',
  ADMINISTRATOR: 'administrator',
});

export const ROLE_MAP = {
  ServiceUser: 'Resident',
  SystemStaff: 'System Staff',
  ServiceOperator: 'Service Provider',
  ServiceProvider: 'Service Provider',
  InteractionManager: 'Interaction Manager',
  SystemAdmin: 'Admin',
  Administrator: 'Admin',
};

const BACKEND_TO_INTERNAL = {
  ServiceUser: APP_ROLES.SERVICE_USER,
  SystemStaff: APP_ROLES.SYSTEM_STAFF,
  ServiceOperator: APP_ROLES.SERVICE_PROVIDER,
  ServiceProvider: APP_ROLES.SERVICE_PROVIDER,
  InteractionManager: APP_ROLES.INTERACTION_MANAGER,
  SystemAdmin: APP_ROLES.ADMINISTRATOR,
  Administrator: APP_ROLES.ADMINISTRATOR,
};

const INTERNAL_TO_BACKEND = Object.fromEntries(
  Object.entries(BACKEND_TO_INTERNAL).map(([backend, internal]) => [internal, backend])
);

export const getInternalRole = (role) => {
  if (!role) return role;
  if (BACKEND_TO_INTERNAL[role]) return BACKEND_TO_INTERNAL[role];
  if (INTERNAL_TO_BACKEND[role]) return role;

  const normalized = String(role).trim().replace(/[-_\s]/g, '').toLowerCase();
  switch (normalized) {
    case 'serviceuser':
      return 'service-user';
    case 'systemstaff':
      return 'system-staff';
    case 'serviceprovider':
    case 'serviceoperator':
    case 'serviceproviderstaff':
    case 'serviceoperatorstaff':
      return 'service-provider';
    case 'interactionmanager':
      return 'interaction-manager';
    case 'systemadmin':
    case 'administrator':
    case 'admin':
      return 'administrator';
    default:
      if (normalized.includes('serviceprovider') || normalized.includes('serviceoperator')) {
        return 'service-provider';
      }
      return role;
  }
};

export const getRoleLabel = (role) => {
  if (!role) return '';
  if (ROLE_MAP[role]) return ROLE_MAP[role];
  const backendRole = INTERNAL_TO_BACKEND[role];
  if (backendRole) {
    return ROLE_MAP[backendRole] || role;
  }
  const internalRole = getInternalRole(role);
  const fallbackBackendRole = INTERNAL_TO_BACKEND[internalRole];
  return ROLE_MAP[fallbackBackendRole] || role;
};
