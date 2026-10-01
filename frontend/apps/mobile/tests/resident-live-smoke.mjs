import assert from 'node:assert/strict';

const apiBaseUrl = (process.env.RESIDENT_API_URL || 'https://api.urbanservice.me').replace(/\/$/, '');
const email = process.env.RESIDENT_TEST_EMAIL;
const password = process.env.RESIDENT_TEST_PASSWORD;

if (!email || !password) {
  throw new Error('Set RESIDENT_TEST_EMAIL and RESIDENT_TEST_PASSWORD to run the read-only Resident API smoke test.');
}

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} returned HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const unwrap = (value) => value?.data ?? value?.result ?? value;
const itemsOf = (value) => {
  const payload = unwrap(value);
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.items) ? payload.items : [];
};

const loginResponse = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
const login = unwrap(loginResponse) || {};
const token = login.token || login.accessToken || login.authToken || login.access_token;
const user = login.user || login;

assert.equal(typeof token, 'string', 'Login did not return an access token.');
assert.ok(token.length > 20, 'Login returned an invalid access token.');
assert.match(String(user.role || login.role || ''), /serviceuser|service-user/i, 'The smoke account is not a Resident/ServiceUser.');

const authenticatedReads = [
  ['/api/profile', 'profile'],
  ['/api/user/feedbacks?PageNumber=1&PageSize=5', 'my feedback'],
  ['/api/notifications?pageNumber=1&pageSize=5', 'notifications'],
  ['/api/ai/conversations/me', 'AI conversations'],
  ['/api/user/area-subscriptions', 'area subscriptions'],
  ['/api/user/area-alerts?OnlySubscribedAreas=true&PageNumber=1&PageSize=5', 'area alerts'],
];

const results = new Map();
for (const [path, label] of authenticatedReads) {
  results.set(label, await request(path, { token }));
  console.log(`PASS ${label}`);
}

const feedback = itemsOf(results.get('my feedback'))[0];
const feedbackId = feedback?.feedbackId ?? feedback?.id;
if (feedbackId) {
  await request(`/api/user/feedbacks/${encodeURIComponent(String(feedbackId))}`, { token });
  await request(`/api/feedbacks/${encodeURIComponent(String(feedbackId))}/messages?includeInternal=false`, { token });
  console.log('PASS feedback detail and private conversation history');
} else {
  console.log('SKIP feedback detail: account has no feedback');
}

const publicIncidents = await request('/api/public/incidents?PageNumber=1&PageSize=5');
console.log('PASS public Incident feed');
const incident = itemsOf(publicIncidents)[0];
const incidentId = incident?.incidentId ?? incident?.id;
if (incidentId) {
  await request(`/api/public/incidents/${encodeURIComponent(String(incidentId))}`);
  console.log('PASS public Incident detail');
} else {
  console.log('SKIP public Incident detail: feed is empty');
}

console.log('Resident live API smoke passed. No mutation endpoint was called.');
