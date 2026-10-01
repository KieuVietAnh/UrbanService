const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);
const SENTIMENT_LABELS = {
  positive: 'Tích cực',
  neutral: 'Trung tính',
  negative: 'Tiêu cực',
};
const SEVERITY_WEIGHT = { critical: 5, severe: 4, high: 4, medium: 3, moderate: 3, low: 1 };
const PRIORITY_WEIGHT = { urgent: 5, high: 4, medium: 3, low: 1 };

const normalizeSentiment = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_SENTIMENTS.has(normalized) ? normalized : null;
};

const getItemDate = (item) => {
  const raw = item?.analysisResult?.createdAt || item?.feedback?.createdAt;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const matchesRange = (item, range, now) => {
  if (!range || range === 'all') return true;
  const days = Number(String(range).replace('d', ''));
  if (!Number.isFinite(days) || days <= 0) return true;
  const date = getItemDate(item);
  if (!date) return false;
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - days);
  return date >= threshold && date <= now;
};

const buildTrend = (items, now, range) => {
  const datedItems = items.map(getItemDate).filter(Boolean);
  const explicitDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null;
  const bucketCount = range === '7d' ? 7 : 6;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (explicitDays) {
    start.setDate(start.getDate() - explicitDays + 1);
  } else if (datedItems.length > 0) {
    const earliest = new Date(Math.min(...datedItems.map((date) => date.getTime())));
    start.setTime(earliest.getTime());
    start.setHours(0, 0, 0, 0);
  }
  const spanDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86_400_000) + 1);
  const bucketDays = Math.max(1, Math.ceil(spanDays / bucketCount));

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + index * bucketDays);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketStart.getDate() + bucketDays);
    const counts = { positive: 0, neutral: 0, negative: 0 };
    items.forEach((item) => {
      const date = getItemDate(item);
      const sentiment = normalizeSentiment(item?.analysisResult?.sentiment);
      if (!date || !sentiment || date < bucketStart || date >= bucketEnd) return;
      counts[sentiment] += 1;
    });
    const label = range === '7d'
      ? bucketStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
      : `${bucketStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
    return { label, ...counts };
  });
};

export const buildSentimentViewModel = ({ items = [], filters = {}, now = new Date() }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const current = now instanceof Date ? now : new Date(now);
  const filteredItems = safeItems.filter((item) => {
    const feedback = item?.feedback || {};
    if (!matchesRange(item, filters.range, current)) return false;
    if (filters.areaId && filters.areaId !== 'all' && String(feedback.areaId) !== String(filters.areaId)) return false;
    if (filters.categoryId && filters.categoryId !== 'all' && String(feedback.categoryId) !== String(filters.categoryId)) return false;
    return true;
  });

  const counts = filteredItems.reduce((acc, item) => {
    const sentiment = normalizeSentiment(item?.analysisResult?.sentiment);
    if (sentiment) acc[sentiment] += 1;
    return acc;
  }, { positive: 0, neutral: 0, negative: 0 });

  const reviewedCount = filteredItems.length;
  const classifiedCount = counts.positive + counts.neutral + counts.negative;
  const unclassifiedCount = Math.max(0, reviewedCount - classifiedCount);
  const rate = (value) => classifiedCount > 0 ? Math.round((value / classifiedCount) * 100) : 0;
  const rates = { positive: rate(counts.positive), neutral: rate(counts.neutral), negative: rate(counts.negative) };

  const maxCount = Math.max(counts.positive, counts.neutral, counts.negative);
  const leaders = Object.entries(counts).filter(([, value]) => value === maxCount && value > 0);
  const dominantLabel = classifiedCount === 0
    ? 'Chưa có dữ liệu'
    : leaders.length !== 1
      ? 'Phân bố cân bằng'
      : SENTIMENT_LABELS[leaders[0][0]];
  const dominantRate = classifiedCount === 0 ? 0 : Math.round((maxCount / classifiedCount) * 100);

  const negativeItems = filteredItems
    .filter((item) => normalizeSentiment(item?.analysisResult?.sentiment) === 'negative')
    .sort((a, b) => {
      const aSeverity = SEVERITY_WEIGHT[String(a?.feedback?.severity || a?.analysisResult?.severityLevel || '').toLowerCase()] || 0;
      const bSeverity = SEVERITY_WEIGHT[String(b?.feedback?.severity || b?.analysisResult?.severityLevel || '').toLowerCase()] || 0;
      if (aSeverity !== bSeverity) return bSeverity - aSeverity;
      const aPriority = PRIORITY_WEIGHT[String(a?.feedback?.priority || a?.analysisResult?.urgencyLevel || '').toLowerCase()] || 0;
      const bPriority = PRIORITY_WEIGHT[String(b?.feedback?.priority || b?.analysisResult?.urgencyLevel || '').toLowerCase()] || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (getItemDate(b)?.getTime() || 0) - (getItemDate(a)?.getTime() || 0);
    });

  return {
    filteredItems,
    reviewedCount,
    classifiedCount,
    unclassifiedCount,
    counts,
    rates,
    dominantLabel,
    dominantRate,
    trend: buildTrend(filteredItems, current, filters.range),
    negativeItems,
  };
};

export const getSentimentContentState = (reviewedCount, classifiedCount) => {
  const reviewed = Math.max(0, Number(reviewedCount) || 0);
  const classified = Math.max(0, Number(classifiedCount) || 0);

  if (reviewed === 0) {
    return {
      kind: 'no-reviewed',
      title: 'Không có phản ánh đã được AI phân tích',
      description: 'Thử đổi khoảng thời gian, khu vực hoặc danh mục để mở rộng phạm vi phân tích.',
    };
  }

  if (classified === 0) {
    return {
      kind: 'no-classified',
      title: 'Chưa có nhãn cảm xúc hợp lệ',
      description: `Có ${reviewed} phản ánh đã được AI phân tích trong phạm vi này nhưng chưa có nhãn cảm xúc hợp lệ.`,
    };
  }

  return { kind: 'ready', title: '', description: '' };
};


export const getNegativeListDisplay = (totalCount, expanded = false) => {
  const total = Math.max(0, Number(totalCount) || 0);
  const cappedCount = Math.min(total, 6);
  const visibleCount = expanded ? cappedCount : Math.min(total, 4);
  return {
    visibleCount,
    cappedCount,
    hasMore: visibleCount < cappedCount,
    hiddenCount: Math.max(0, cappedCount - visibleCount),
  };
};

const normalizeFilterValue = (value) => String(value || '').trim().toLowerCase();

export const filterNegativeItems = (items = [], filters = {}) => {
  const search = normalizeFilterValue(filters.search);
  const severity = normalizeFilterValue(filters.severity);
  const priority = normalizeFilterValue(filters.priority);
  const incidentState = normalizeFilterValue(filters.incidentState);

  return (Array.isArray(items) ? items : []).filter((item) => {
    const feedback = item?.feedback || {};
    const analysis = item?.analysisResult || {};
    const haystack = [
      feedback.feedbackId,
      feedback.title,
      feedback.description,
      analysis.summary,
      feedback.areaName,
      feedback.categoryName,
    ].map(normalizeFilterValue).join(' ');
    const itemSeverity = normalizeFilterValue(feedback.severity || analysis.severityLevel);
    const itemPriority = normalizeFilterValue(feedback.priority || analysis.urgencyLevel);
    const hasIncident = Boolean(feedback.incidentId);

    if (search && !haystack.includes(search)) return false;
    if (severity && severity !== 'all' && itemSeverity !== severity) return false;
    if (priority && priority !== 'all' && itemPriority !== priority) return false;
    if (incidentState === 'linked' && !hasIncident) return false;
    if (incidentState === 'unlinked' && hasIncident) return false;
    return true;
  });
};

export const paginateItems = (items = [], page = 1, pageSize = 20) => {
  const safeItems = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(pageSize) || 20);
  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const currentPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const start = (currentPage - 1) * size;
  return {
    items: safeItems.slice(start, start + size),
    totalItems,
    totalPages,
    currentPage,
    pageSize: size,
  };
};
