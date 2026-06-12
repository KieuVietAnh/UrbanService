export const ROLE_MAP = {
  ServiceUser: 'Resident',
  SystemStaff: 'System Staff',
  ServiceProvider: 'Service Provider',
  InteractionManager: 'Interaction Manager',
  Administrator: 'Admin',
};

const BACKEND_TO_INTERNAL = {
  ServiceUser: 'service-user',
  SystemStaff: 'system-staff',
  ServiceProvider: 'service-provider',
  InteractionManager: 'interaction-manager',
  Administrator: 'administrator',
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
      return 'service-provider';
    case 'interactionmanager':
      return 'interaction-manager';
    case 'administrator':
    case 'admin':
      return 'administrator';
    default:
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
