export const STAFF_INCIDENT_FLOW_TARGETS = Object.freeze({
  CONTACT: 'provider-contact-log-form',
  EVIDENCE: 'incident-evidence',
  RESOLUTION: 'incident-execution-resolution',
  RESOLUTION_FORM: 'incident-resolution-submit',
});

export const getStaffFlowScrollBehavior = (windowRef) => {
  const prefersReducedMotion = windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  return prefersReducedMotion ? 'auto' : 'smooth';
};

export const scrollToStaffIncidentFlowTarget = (targetId, options = {}) => {
  const documentRef = options.documentRef ?? globalThis.document;
  const windowRef = options.windowRef ?? globalThis.window;
  const retryDelays = options.retryDelays ?? [90, 240, 520];

  if (!targetId || !documentRef || !windowRef) return false;

  let completed = false;
  const scrollTarget = () => {
    if (completed) return true;
    const target = documentRef.getElementById(targetId);
    if (!target || typeof target.scrollIntoView !== 'function') return false;

    completed = true;
    target.scrollIntoView({
      behavior: getStaffFlowScrollBehavior(windowRef),
      block: 'start',
      inline: 'nearest',
    });
    return true;
  };

  if (scrollTarget()) return true;

  retryDelays.forEach((delay) => {
    windowRef.setTimeout(scrollTarget, delay);
  });
  return false;
};
