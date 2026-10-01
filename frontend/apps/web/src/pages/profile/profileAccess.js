const RESIDENT_ROLE = 'service-user';

/**
 * Swagger restricts GET/PUT /api/profile to SERVICEUSER accounts.
 * Staff account details come from the authenticated session instead.
 */
export const canUseResidentProfileApi = (normalizedRole) => (
  normalizedRole === RESIDENT_ROLE
);

export const getSessionProfile = (user) => ({
  ...(user || {}),
  fullName: user?.fullName || '',
  phoneNumber: user?.phoneNumber || user?.phone || '',
  address: user?.address || '',
});
