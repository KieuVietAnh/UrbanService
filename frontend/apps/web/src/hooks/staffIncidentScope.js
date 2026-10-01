export const hasStaffIncidentScopeMismatch = (incidents, assignedStaffUserId) => {
  const expectedStaffId = String(assignedStaffUserId ?? '').trim();
  if (!expectedStaffId || !Array.isArray(incidents)) return false;

  return incidents.some((incident) => {
    const actualStaffId = String(incident?.assignedStaffUserId ?? '').trim();
    return Boolean(actualStaffId && actualStaffId !== expectedStaffId);
  });
};
