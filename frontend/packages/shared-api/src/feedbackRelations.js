const unwrapFeedbackRelationPayload = (response) => (
  response?.data ?? response?.item ?? response?.result ?? response ?? {}
);

const getFeedbackRelationId = (feedback) => String(
  feedback?.feedbackId ?? feedback?.id ?? ''
).trim();

const normalizeFeedbackRelationItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

export const normalizeLinkedFeedbacksPayload = (response) => {
  const payload = unwrapFeedbackRelationPayload(response);
  return normalizeFeedbackRelationItems(payload);
};

export const normalizeRelatedFeedbacksPayload = (response, feedbackId) => {
  const payload = unwrapFeedbackRelationPayload(response);

  if (Array.isArray(payload)) {
    const currentId = String(feedbackId ?? '').trim();
    return payload.filter((item) => getFeedbackRelationId(item) !== currentId);
  }

  const currentId = String(feedbackId ?? payload?.feedbackId ?? '').trim();
  const masterFeedback = payload?.masterFeedback ?? payload?.parentFeedback ?? null;
  const masterFeedbackId = String(
    payload?.masterFeedbackId ??
    payload?.parentFeedbackId ??
    getFeedbackRelationId(masterFeedback)
  ).trim();
  const relatedItems = [];

  if (masterFeedback && masterFeedbackId && masterFeedbackId !== currentId) {
    relatedItems.push({
      ...masterFeedback,
      feedbackId: getFeedbackRelationId(masterFeedback) || masterFeedbackId,
      relationType: 'master',
    });
  }

  normalizeFeedbackRelationItems(payload?.linkedFeedbacks)
    .forEach((item) => {
      const itemId = getFeedbackRelationId(item);
      if (!itemId || itemId === currentId || itemId === masterFeedbackId) return;

      relatedItems.push({
        ...item,
        feedbackId: itemId,
        relationType: 'linked',
      });
    });

  return relatedItems;
};
