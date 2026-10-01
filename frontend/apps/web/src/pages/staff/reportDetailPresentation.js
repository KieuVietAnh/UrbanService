export const getRelatedIncidentId = (feedback = {}) => {
  const incidentId = String(feedback?.incidentId ?? '').trim();
  return incidentId || null;
};
