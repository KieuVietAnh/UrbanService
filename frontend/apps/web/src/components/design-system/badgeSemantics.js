import { getStatusIntent, getPriorityIntent } from '@urbanmind/shared-types';

const ACTION_INTENTS = {
  delete: 'danger',
  remove: 'danger',
  create: 'success',
  add: 'success',
  update: 'warning',
  change: 'warning',
  edit: 'warning',
  login: 'info',
  auth: 'info',
};

const normalizeValue = (value) => `${value ?? ''}`.trim();

export function getBadgeIntent(value, kind = 'status') {
  const normalizedValue = normalizeValue(value);
  const loweredValue = normalizedValue.toLowerCase();

  if (kind === 'priority' || kind === 'severity') {
    return getPriorityIntent(normalizedValue);
  }

  if (kind === 'action') {
    for (const [token, intent] of Object.entries(ACTION_INTENTS)) {
      if (loweredValue.includes(token)) return intent;
    }
    return 'neutral';
  }

  return getStatusIntent(normalizedValue);
}
