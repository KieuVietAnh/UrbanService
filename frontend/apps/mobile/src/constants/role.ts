import { APP_ROLES } from '@urbanmind/shared-types';

export const USER_ROLES = APP_ROLES;

export type UserRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];
