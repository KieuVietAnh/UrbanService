import { isIncidentAssignedToCurrentStaff } from './staffIncidentProcessing.js';

const normalizeStatus = (value) => String(value ?? '')
  .trim()
  .replace(/[-_\s]+/g, '')
  .toLowerCase();

const normalizeIdentifier = (value) => String(value ?? '').trim().toLowerCase();

export const validateIncidentResolutions = (resolutions, incidentId) => {
  const expectedIncidentId = normalizeIdentifier(incidentId);

  if (!expectedIncidentId || !Array.isArray(resolutions)) return false;

  return resolutions.every((resolution) => (
    resolution !== null
    && typeof resolution === 'object'
    && !Array.isArray(resolution)
    && normalizeIdentifier(resolution.incidentId) === expectedIncidentId
  ));
};

export const sortIncidentResolutionsNewestFirst = (resolutions) => {
  if (
    !Array.isArray(resolutions)
    || resolutions.some((resolution) => (
      resolution === null
      || typeof resolution !== 'object'
      || Array.isArray(resolution)
    ))
  ) {
    return [];
  }

  return resolutions
    .map((resolution, sourceIndex) => {
      const timestamp = Date.parse(resolution.resolvedAt);
      return {
        resolution,
        sourceIndex,
        timestamp: Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY,
      };
    })
    .sort((left, right) => (
      right.timestamp - left.timestamp || left.sourceIndex - right.sourceIndex
    ))
    .map(({ resolution }) => resolution);
};

/**
 * Fail-closed UI guard for the Incident resolution form.
 * The backend remains responsible for enforcing assignee ownership and status
 * transitions atomically when the result is submitted.
 */
export const getIncidentResolutionSubmissionMode = (
  incident,
  currentUser,
  existingResolutionCount,
) => {
  if (
    !isIncidentAssignedToCurrentStaff(incident, currentUser)
    || !Number.isSafeInteger(existingResolutionCount)
    || existingResolutionCount < 0
  ) {
    return null;
  }

  const status = normalizeStatus(incident?.status);

  if (status === 'needrework') return 'resubmit';
  if (status === 'inprogress' && existingResolutionCount === 0) return 'initial';
  return null;
};

export const canSubmitIncidentResolution = (
  incident,
  currentUser,
  existingResolutionCount,
) => getIncidentResolutionSubmissionMode(
  incident,
  currentUser,
  existingResolutionCount,
) !== null;
