import type { FeedbackFilters } from '../types/reporting.types';

export const reportingKeys = {
  all: ['reporting'] as const,
  lists: () => [...reportingKeys.all, 'feedbacks'] as const,
  list: (filters: FeedbackFilters = {}) => [...reportingKeys.lists(), filters] as const,
  detail: (feedbackId: string) => [...reportingKeys.all, 'feedback', feedbackId] as const,
  resolutions: (feedbackId: string) => [...reportingKeys.detail(feedbackId), 'resolutions'] as const,
  comments: (feedbackId: string) => [...reportingKeys.all, 'comments', feedbackId] as const,
};
