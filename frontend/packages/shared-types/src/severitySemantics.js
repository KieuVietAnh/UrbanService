const normalizeSeverityKey = (value) => `${value ?? ''}`.trim().toLowerCase();

const SEVERITY_SEMANTICS = {
  Critical: { intent: 'danger', level: 'critical' },
  High: { intent: 'warning', level: 'high' },
  Medium: { intent: 'info', level: 'medium' },
  Low: { intent: 'neutral', level: 'low' },
  Urgent: { intent: 'danger', level: 'critical' },
  Major: { intent: 'warning', level: 'high' },
  Normal: { intent: 'info', level: 'medium' },
  Minor: { intent: 'neutral', level: 'low' },
};

const SEVERITY_LOOKUP = new Map(
  Object.entries(SEVERITY_SEMANTICS).map(([severity, semantic]) => [normalizeSeverityKey(severity), semantic])
);

export function getSeverityIntent(value) {
  return SEVERITY_LOOKUP.get(normalizeSeverityKey(value))?.intent || 'neutral';
}

export function getSeveritySemantic(value) {
  return SEVERITY_LOOKUP.get(normalizeSeverityKey(value)) || { intent: 'neutral', level: 'unknown' };
}

export { SEVERITY_SEMANTICS };
