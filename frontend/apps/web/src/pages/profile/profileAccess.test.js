import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseResidentProfileApi, getSessionProfile } from './profileAccess.js';

test('only resident accounts may call the resident profile endpoint', () => {
  assert.equal(canUseResidentProfileApi('service-user'), true);
  assert.equal(canUseResidentProfileApi('system-staff'), false);
  assert.equal(canUseResidentProfileApi('interaction-manager'), false);
  assert.equal(canUseResidentProfileApi('service-provider'), false);
  assert.equal(canUseResidentProfileApi('administrator'), false);
});

test('staff profile fields fall back to authenticated session data', () => {
  assert.deepEqual(
    getSessionProfile({
      userId: 'staff-1',
      fullName: 'Nguyen Van Staff',
      email: 'staff@example.com',
      phone: '0901234567',
    }),
    {
      userId: 'staff-1',
      fullName: 'Nguyen Van Staff',
      email: 'staff@example.com',
      phone: '0901234567',
      phoneNumber: '0901234567',
      address: '',
    },
  );
});
