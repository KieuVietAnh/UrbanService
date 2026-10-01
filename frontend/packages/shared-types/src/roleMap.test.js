import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_ROLES, getInternalRole, getRoleLabel } from './roleMap.js';

test('exports canonical app role constants', () => {
  assert.equal(APP_ROLES.SERVICE_USER, 'service-user');
  assert.equal(APP_ROLES.SYSTEM_STAFF, 'system-staff');
  assert.equal(APP_ROLES.SERVICE_PROVIDER, 'service-provider');
  assert.equal(APP_ROLES.INTERACTION_MANAGER, 'interaction-manager');
  assert.equal(APP_ROLES.ADMINISTRATOR, 'administrator');
});

test('normalizes backend and alias roles into internal role values', () => {
  assert.equal(getInternalRole('ServiceUser'), APP_ROLES.SERVICE_USER);
  assert.equal(getInternalRole('service-operator-staff'), APP_ROLES.SERVICE_PROVIDER);
  assert.equal(getInternalRole('Administrator'), APP_ROLES.ADMINISTRATOR);
});

test('formats role labels for UI', () => {
  assert.equal(getRoleLabel(APP_ROLES.SERVICE_USER), 'Resident');
  assert.equal(getRoleLabel(APP_ROLES.SERVICE_PROVIDER), 'Service Provider');
  assert.equal(getRoleLabel(APP_ROLES.ADMINISTRATOR), 'Admin');
});
