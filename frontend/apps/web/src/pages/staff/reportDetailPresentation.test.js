import test from 'node:test';
import assert from 'node:assert/strict';

import { getRelatedIncidentId } from './reportDetailPresentation.js';

test('dùng incidentId từ hợp đồng chi tiết phản ánh làm quan hệ sự vụ chính thức', () => {
  assert.equal(getRelatedIncidentId({ incidentId: ' incident-01 ' }), 'incident-01');
  assert.equal(getRelatedIncidentId({ incidentId: null }), null);
});

test('không suy luận sự vụ từ quan hệ phản ánh trùng hoặc phản ánh cha', () => {
  assert.equal(getRelatedIncidentId({ parentFeedbackId: 'feedback-parent' }), null);
  assert.equal(getRelatedIncidentId({ parentTicketId: 'feedback-parent' }), null);
  assert.equal(getRelatedIncidentId({ currentIncidentId: 'legacy-incident' }), null);
});
