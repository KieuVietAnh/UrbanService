const normalizePriorityKey = (value) => `${value ?? ''}`.trim().toLowerCase();

const PRIORITY_SEMANTICS = {
  Urgent: { intent: 'danger', urgency: 'critical' },
  Critical: { intent: 'danger', urgency: 'critical' },
  High: { intent: 'warning', urgency: 'high' },
  Medium: { intent: 'info', urgency: 'medium' },
  Low: { intent: 'neutral', urgency: 'low' },
};

const PRIORITY_LOOKUP = new Map(
  Object.entries(PRIORITY_SEMANTICS).map(([priority, semantic]) => [normalizePriorityKey(priority), semantic])
);

export function getPriorityIntent(value) {
  return PRIORITY_LOOKUP.get(normalizePriorityKey(value))?.intent || 'neutral';
}

export function getPrioritySemantic(value) {
  return PRIORITY_LOOKUP.get(normalizePriorityKey(value)) || { intent: 'neutral', urgency: 'unknown' };
}

export { PRIORITY_SEMANTICS };
