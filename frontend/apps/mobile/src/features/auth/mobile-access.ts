import { APP_ROLES, getInternalRole } from '@urbanmind/shared-types';

type SessionUser = { role?: string; isVerified?: boolean } | null;

export function getMobileRole(user: SessionUser) {
  return user?.role ? getInternalRole(user.role) : '';
}

export function getMobileEntry(user: SessionUser) {
  if (!user) return '/(auth)/login' as const;
  const role = getMobileRole(user);
  if (role !== APP_ROLES.SERVICE_USER && role !== APP_ROLES.SYSTEM_STAFF) {
    return '/unsupported-role' as const;
  }
  if (user.isVerified !== true) return '/(auth)/verify-phone' as const;
  return role === APP_ROLES.SYSTEM_STAFF ? '/(staff)/staff' as const : '/(resident)' as const;
}

export function canAccessMobileWorkspace(user: SessionUser, role: string) {
  return Boolean(user && user.isVerified === true && getMobileRole(user) === role);
}

export function getMobileRedirect(user: SessionUser, segments: string[]): ReturnType<typeof getMobileEntry> | null {
  const [group, screen] = segments;
  if (!user) {
    return group === '(auth)' ? null : '/(auth)/login';
  }
  const entry = getMobileEntry(user);
  if (entry === '/unsupported-role') return group === 'unsupported-role' ? null : entry;
  if (entry === '/(auth)/verify-phone') {
    return group === '(auth)' && ['verify-phone', 'verify-email', 'otp'].includes(screen) ? null : entry;
  }
  const expectedGroup = getMobileRole(user) === APP_ROLES.SYSTEM_STAFF ? '(staff)' : '(resident)';
  return group === expectedGroup ? null : entry;
}
