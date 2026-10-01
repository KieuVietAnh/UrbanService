import { ticketApi, toolsApi } from '@urbanmind/shared-api';
import type { CreateFeedbackPayload, FeedbackFilters } from '../types/reporting.types';

export type { CreateFeedbackPayload, FeedbackFilters } from '../types/reporting.types';

const CITIZEN_OPTS = { role: 'service-user' };

/**
 * feedbackApi — mobile wrapper over shared-api ticketApi.
 * All citizen calls use role: 'service-user'.
 */
export const feedbackApi = {
  /** Reporting form reference data */
  getAreas: () => toolsApi.getAreas(),
  getCategories: () => toolsApi.getCategories(),

  /** List feedbacks with filters, search, pagination */
  async list(filters: FeedbackFilters = {}) {
    const params: Record<string, string | number> = {
      pageNumber: filters.pageNumber ?? 1,
      pageSize: filters.pageSize ?? 15,
    };
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;

    return ticketApi.getTickets(params, CITIZEN_OPTS);
  },

  /** Get a single feedback by ID with full details + attachments */
  async getById(feedbackId: string) {
    return ticketApi.getTicketById(feedbackId, CITIZEN_OPTS);
  },

  /** Approved/public resolution history for the current resident's feedback. */
  async getResolutions(feedbackId: string) {
    return ticketApi.getResolutions(feedbackId, CITIZEN_OPTS);
  },

  /** Create new feedback (multipart with images) */
  async create(payload: CreateFeedbackPayload) {
    // Build attachments as RN-compatible blob descriptors
    const attachments = (payload.attachments ?? []).map((f) => ({
      uri: f.uri,
      name: f.name,
      type: f.type,
    }));

    return ticketApi.createTicket(
      null,
      null,
      {
        categoryId: payload.categoryId,
        title: payload.title,
        description: payload.description,
        locationText: payload.locationText,
        latitude: payload.latitude,
        longitude: payload.longitude,
        locationAccuracyMeters: payload.locationAccuracyMeters,
        geoSource: payload.geoSource ?? 'GPS',
        areaId: payload.areaId,
        priority: payload.priority,
        attachments,
      },
      CITIZEN_OPTS
    );
  },

  /** Upload additional evidence to existing feedback */
  async addEvidence(feedbackId: string, files: Array<{ uri: string; name: string; type: string }>) {
    const formFiles = files.map((f) => ({ uri: f.uri, name: f.name, type: f.type }));
    return ticketApi.addAttachments(feedbackId, formFiles, CITIZEN_OPTS);
  },

  /** Support (upvote) a feedback */
  async support(feedbackId: string) {
    return ticketApi.supportTicket(feedbackId, CITIZEN_OPTS);
  },

  /** Remove support from a feedback */
  async unsupport(feedbackId: string) {
    return ticketApi.unsupportTicket(feedbackId, CITIZEN_OPTS);
  },

  /** Get resolution timeline (statusHistories) */
  async getHistory(feedbackId: string) {
    return ticketApi.getHistory(feedbackId, CITIZEN_OPTS);
  },

  /** Get comments/messages on a feedback */
  async getComments(feedbackId: string) {
    return ticketApi.getComments(feedbackId, CITIZEN_OPTS);
  },

  /** Add a comment */
  async addComment(feedbackId: string, content: string) {
    return ticketApi.addComment(feedbackId, null, null, null, content, CITIZEN_OPTS);
  },

  /** Submit post-resolution review */
  async submitReview(
    feedbackId: string,
    rating: number,
    isSatisfied: boolean,
    comment: string
  ) {
    return ticketApi.submitReview(feedbackId, null, rating, isSatisfied, comment, CITIZEN_OPTS);
  },
};
