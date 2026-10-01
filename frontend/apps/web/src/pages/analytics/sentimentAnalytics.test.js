import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSentimentViewModel } from './sentimentAnalytics.js';

const makeItem = ({ id, sentiment, createdAt, areaId = 1, categoryId = 10, incidentId = null, priority = 'Medium', severity = 'Medium' }) => ({
  feedback: { feedbackId: id, title: `Phản ánh ${id}`, createdAt, areaId, areaName: `Phường ${areaId}`, categoryId, categoryName: `Danh mục ${categoryId}`, incidentId, priority, severity },
  analysisResult: { sentiment, confidenceScore: 0.9, createdAt, summary: `Tóm tắt ${id}` },
});

test('counts only valid sentiment while preserving reviewed and unclassified totals', () => {
  const model = buildSentimentViewModel({
    items: [
      makeItem({ id: '1', sentiment: 'positive', createdAt: '2026-09-10T00:00:00Z' }),
      makeItem({ id: '2', sentiment: 'negative', createdAt: '2026-09-10T00:00:00Z' }),
      makeItem({ id: '3', sentiment: null, createdAt: '2026-09-10T00:00:00Z' }),
    ],
    filters: { range: 'all', areaId: 'all', categoryId: 'all' },
    now: new Date('2026-09-11T00:00:00Z'),
  });
  assert.equal(model.reviewedCount, 3);
  assert.equal(model.classifiedCount, 2);
  assert.equal(model.unclassifiedCount, 1);
  assert.deepEqual(model.counts, { positive: 1, neutral: 0, negative: 1 });
  assert.deepEqual(model.rates, { positive: 50, neutral: 0, negative: 50 });
});

test('does not invent a dominant sentiment when top groups are tied', () => {
  const model = buildSentimentViewModel({
    items: [
      makeItem({ id: '1', sentiment: 'positive', createdAt: '2026-09-10T00:00:00Z' }),
      makeItem({ id: '2', sentiment: 'negative', createdAt: '2026-09-10T00:00:00Z' }),
    ],
    filters: { range: 'all', areaId: 'all', categoryId: 'all' },
    now: new Date('2026-09-11T00:00:00Z'),
  });
  assert.equal(model.dominantLabel, 'Phân bố cân bằng');
  assert.equal(model.dominantRate, 50);
});

test('applies time area and category filters before calculating metrics', () => {
  const model = buildSentimentViewModel({
    items: [
      makeItem({ id: '1', sentiment: 'negative', createdAt: '2026-09-10T00:00:00Z', areaId: 2, categoryId: 20 }),
      makeItem({ id: '2', sentiment: 'positive', createdAt: '2026-08-01T00:00:00Z', areaId: 2, categoryId: 20 }),
      makeItem({ id: '3', sentiment: 'neutral', createdAt: '2026-09-10T00:00:00Z', areaId: 1, categoryId: 20 }),
    ],
    filters: { range: '30d', areaId: '2', categoryId: '20' },
    now: new Date('2026-09-11T00:00:00Z'),
  });
  assert.equal(model.reviewedCount, 1);
  assert.deepEqual(model.counts, { positive: 0, neutral: 0, negative: 1 });
});

test('ranks negative action items by severity and priority then recency', () => {
  const model = buildSentimentViewModel({
    items: [
      makeItem({ id: 'low', sentiment: 'negative', createdAt: '2026-09-11T00:00:00Z', priority: 'Low', severity: 'Low' }),
      makeItem({ id: 'urgent', sentiment: 'negative', createdAt: '2026-09-09T00:00:00Z', priority: 'Urgent', severity: 'Critical', incidentId: 'incident-1' }),
    ],
    filters: { range: 'all', areaId: 'all', categoryId: 'all' },
    now: new Date('2026-09-11T00:00:00Z'),
  });
  assert.equal(model.negativeItems[0].feedback.feedbackId, 'urgent');
  assert.equal(model.negativeItems[0].feedback.incidentId, 'incident-1');
});

test('all-time trend includes older filtered data instead of silently limiting to 30 days', () => {
  const model = buildSentimentViewModel({
    items: [
      makeItem({ id: 'old', sentiment: 'negative', createdAt: '2026-01-10T00:00:00Z' }),
      makeItem({ id: 'new', sentiment: 'positive', createdAt: '2026-09-10T00:00:00Z' }),
    ],
    filters: { range: 'all', areaId: 'all', categoryId: 'all' },
    now: new Date('2026-09-11T00:00:00Z'),
  });
  const trendTotal = model.trend.reduce((sum, point) => sum + point.positive + point.neutral + point.negative, 0);
  assert.equal(trendTotal, 2);
});


test('shows four negative items by default and caps expanded dashboard list at six', async () => {
  const { getNegativeListDisplay } = await import('./sentimentAnalytics.js');
  assert.deepEqual(getNegativeListDisplay(14, false), {
    visibleCount: 4,
    cappedCount: 6,
    hasMore: true,
    hiddenCount: 2,
  });
  assert.deepEqual(getNegativeListDisplay(14, true), {
    visibleCount: 6,
    cappedCount: 6,
    hasMore: false,
    hiddenCount: 0,
  });
});

test('filters negative items by search severity priority and incident state', async () => {
  const { filterNegativeItems } = await import('./sentimentAnalytics.js');
  const items = [
    makeItem({ id: 'a', sentiment: 'negative', createdAt: '2026-09-10T00:00:00Z', priority: 'High', severity: 'Critical', incidentId: 'incident-a' }),
    makeItem({ id: 'b', sentiment: 'negative', createdAt: '2026-09-09T00:00:00Z', priority: 'Urgent', severity: 'Medium' }),
  ];
  items[0].feedback.title = 'Chó thả rông trên đường';
  items[1].feedback.title = 'Đèn đường hư';

  const filtered = filterNegativeItems(items, {
    search: 'chó',
    severity: 'Critical',
    priority: 'High',
    incidentState: 'linked',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].feedback.feedbackId, 'a');
});

test('paginates long negative lists without rendering every row', async () => {
  const { paginateItems } = await import('./sentimentAnalytics.js');
  const items = Array.from({ length: 45 }, (_, index) => makeItem({
    id: String(index + 1),
    sentiment: 'negative',
    createdAt: '2026-09-10T00:00:00Z',
  }));

  const page = paginateItems(items, 2, 20);
  assert.equal(page.totalItems, 45);
  assert.equal(page.totalPages, 3);
  assert.equal(page.currentPage, 2);
  assert.equal(page.items.length, 20);
  assert.equal(page.items[0].feedback.feedbackId, '21');
});

test('describes empty sentiment state when no AI-reviewed feedback matches filters', async () => {
  const { getSentimentContentState } = await import('./sentimentAnalytics.js');
  assert.deepEqual(getSentimentContentState(0, 0), {
    kind: 'no-reviewed',
    title: 'Không có phản ánh đã được AI phân tích',
    description: 'Thử đổi khoảng thời gian, khu vực hoặc danh mục để mở rộng phạm vi phân tích.',
  });
});

test('distinguishes AI-reviewed feedback that still has no valid sentiment label', async () => {
  const { getSentimentContentState } = await import('./sentimentAnalytics.js');
  assert.deepEqual(getSentimentContentState(3, 0), {
    kind: 'no-classified',
    title: 'Chưa có nhãn cảm xúc hợp lệ',
    description: 'Có 3 phản ánh đã được AI phân tích trong phạm vi này nhưng chưa có nhãn cảm xúc hợp lệ.',
  });
});
