import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildCitizenFeedbackSubmission,
  parseCitizenAiFeedbackDraft,
} from './citizenAiFeedbackDraft.js';

test('copilot final submission path does not call the AI draft endpoint', async () => {
  const componentSource = await readFile(
    new URL('./CitizenAiCopilot.jsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(componentSource, /createAiFeedbackDraft|\/api\/ai\/feedback-draft/);
});

test('routes AI-assisted drafts through the citizen form without pre-assigning category or priority', () => {
  const description = 'Mô tả rất dài '.repeat(800);
  const attachments = [{ name: 'evidence.jpg' }];
  const plan = buildCitizenFeedbackSubmission({
    title: 'Đường hư hỏng',
    description,
    suggestedCategory: 'Bảo trì đường bộ',
    location: 'Phường 1',
    latitude: '10.75',
    longitude: '106.67',
    attachments,
  });

  assert.equal(plan.type, 'complete-in-form');
  assert.equal(plan.draft.description, description);
  assert.equal(plan.draft.suggestedCategory, 'Bảo trì đường bộ');
  assert.equal(plan.draft.latitude, 10.75);
  assert.equal(plan.draft.longitude, 106.67);
  assert.equal('priority' in plan.draft, false);
  assert.equal('categoryId' in plan.draft, false);
  assert.equal(plan.attachments, attachments);
});

test('routes missing location IDs to the form with content and files intact', () => {
  const attachments = [{ name: 'evidence.jpg' }];
  const plan = buildCitizenFeedbackSubmission({
    title: 'Ngập nước',
    description: 'Nước ngập sâu trước nhà',
    suggestedCategory: 'Cấp thoát nước',
    location: 'Hẻm 12',
    latitude: '',
    longitude: '',
    attachments,
  });

  assert.equal(plan.type, 'complete-in-form');
  assert.equal(plan.draft.description, 'Nước ngập sâu trước nhà');
  assert.equal(plan.draft.suggestedCategory, 'Cấp thoát nước');
  assert.equal(plan.attachments, attachments);
});

test('restores valid persisted fields and safely rejects malformed storage', () => {
  const restored = parseCitizenAiFeedbackDraft(JSON.stringify({
    draftStep: 'location',
    title: 'Rác tồn đọng',
    description: 'Đã nhiều ngày chưa thu gom',
    latitude: 10.7,
    hadImages: true,
    imageNames: ['rac.jpg'],
  }), ['idle', 'title', 'description', 'category', 'location', 'evidence', 'ready']);

  assert.equal(restored.draftStep, 'location');
  assert.equal(restored.title, 'Rác tồn đọng');
  assert.equal(restored.latitude, '10.7');
  assert.deepEqual(restored.imageNames, ['rac.jpg']);
  assert.equal(parseCitizenAiFeedbackDraft('{not-json', ['idle']), null);
});
