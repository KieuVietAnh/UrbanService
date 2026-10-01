import { axiosClient } from './axiosClient.js';
import { normalizeTicketsResponse } from './ticketApiHelpers.js';
import {
  normalizeLinkedFeedbacksPayload,
  normalizeRelatedFeedbacksPayload,
} from './feedbackRelations.js';

const getAiReviewedPagePayload = (payload = {}) => {
  if (Array.isArray(payload)) return { items: payload };
  if (Array.isArray(payload?.items)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data;
  if (Array.isArray(payload?.result?.items)) return payload.result;
  return payload || {};
};

export const normalizeAiReviewedPayload = (payload = {}) => {
  const source = getAiReviewedPagePayload(payload);
  const items = Array.isArray(source?.items) ? source.items : [];

  return items.map((item) => {
    const feedback = item?.feedback || {};
    const analysisResult = item?.analysisResult || {};

    const normalizeStringArray = (value) => {
      if (Array.isArray(value)) {
        return value.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim());
      }
      if (typeof value === 'string' && value.trim()) {
        return value.split(/,|\n/).map((entry) => entry.trim()).filter(Boolean);
      }
      return [];
    };

    const rawResponse = analysisResult.rawResponse || '';
    let parsedRawResponse = null;
    if (typeof rawResponse === 'string' && rawResponse.trim()) {
      try {
        parsedRawResponse = JSON.parse(rawResponse);
      } catch {
        parsedRawResponse = null;
      }
    }

    const riskNotes = normalizeStringArray(parsedRawResponse?.riskNotes || analysisResult.riskNotes || []);
    const keywords = normalizeStringArray(parsedRawResponse?.keywords || analysisResult.keywords || []);
    const normalizedTitle = feedback.title || feedback.description || feedback.content || 'Chưa có dữ liệu';
    const normalizedDescription = feedback.description || feedback.content || feedback.details || feedback.message || '';

    return {
      ...feedback,
      feedbackId: feedback.feedbackId || feedback.id || item?.feedbackId || '',
      title: normalizedTitle,
      description: normalizedDescription,
      reporterName: feedback.reporterName || feedback.reporter?.name || feedback.userName || 'Chưa có dữ liệu',
      locationText: feedback.locationText || feedback.location || feedback.address || '',
      categoryId: feedback.categoryId ?? analysisResult.detectedCategoryId ?? '',
      categoryName: feedback.categoryName || analysisResult.detectedCategoryName || '',
      priority: feedback.priority || '',
      areaName: feedback.areaName || feedback.area?.name || '',
      createdAt: feedback.createdAt || analysisResult.createdAt || null,
      updatedAt: feedback.updatedAt || feedback.updatedDate || null,
      summary: analysisResult.summary || parsedRawResponse?.summary || '',
      confidenceScore: analysisResult.confidenceScore ?? parsedRawResponse?.confidenceScore ?? null,
      sentiment: analysisResult.sentiment || parsedRawResponse?.sentiment || 'Unknown',
      urgencyLevel: analysisResult.urgencyLevel || parsedRawResponse?.urgencyLevel || '',
      detectedCategoryName: analysisResult.detectedCategoryName || parsedRawResponse?.detectedCategoryName || feedback.categoryName || '',
      keywords,
      riskNotes,
      rawResponse,
      analysisResult,
    };
  });
};

export const normalizeAiReviewedPage = (payload = {}) => {
  const source = getAiReviewedPagePayload(payload);
  const items = normalizeAiReviewedPayload(source);
  const pageNumber = Number(source?.pageNumber ?? 1);
  const pageSize = Number(source?.pageSize ?? items.length ?? 0);
  const totalItems = Number(source?.totalItems ?? source?.totalCount ?? items.length);
  const calculatedTotalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const totalPages = Number(source?.totalPages ?? calculatedTotalPages);

  return {
    items,
    pageNumber: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    pageSize: Number.isFinite(pageSize) && pageSize >= 0 ? pageSize : items.length,
    totalItems: Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : items.length,
    totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : calculatedTotalPages,
    hasPreviousPage: typeof source?.hasPreviousPage === 'boolean'
      ? source.hasPreviousPage
      : pageNumber > 1,
    hasNextPage: typeof source?.hasNextPage === 'boolean'
      ? source.hasNextPage
      : pageNumber < totalPages,
  };
};

const normalizeFeedbackStatusValue = (value) => {
  if (value === undefined || value === null || value === '') return '';

  const rawValue = String(value).trim();
  if (!rawValue) return '';

  const key = rawValue.replace(/[-_\s]/g, '').toLowerCase();

  if (key === 'aireviewed' || key === 'aireview' || key === 'aiviewed' || key === 'aireview') {
    return 'AiReviewed';
  }

  return rawValue;
};

export const normalizeFeedbackListParams = (params = {}) => {
  const normalized = {};
  const pageNumber = Number(params?.PageNumber ?? params?.pageNumber ?? params?.pageIndex ?? params?.page ?? 1);
  const pageSize = Number(params?.PageSize ?? params?.pageSize ?? 10);
  const status = params?.Status ?? params?.status;
  const categoryId = params?.CategoryId ?? params?.categoryId;
  const hasPreciseLocation = params?.HasPreciseLocation ?? params?.hasPreciseLocation;
  const search = params?.Search ?? params?.search;

  if (Number.isFinite(pageNumber) && pageNumber > 0) {
    normalized.PageNumber = params?.pageIndex !== undefined && params?.pageNumber === undefined && params?.PageNumber === undefined
      ? pageNumber + 1
      : pageNumber;
  }

  if (Number.isFinite(pageSize) && pageSize > 0) {
    normalized.PageSize = pageSize;
  }

  if (status !== undefined && status !== null && status !== '') {
    normalized.Status = normalizeFeedbackStatusValue(status);
  }

  if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
    normalized.CategoryId = categoryId;
  }

  if (hasPreciseLocation !== undefined && hasPreciseLocation !== null && hasPreciseLocation !== '') {
    normalized.HasPreciseLocation = hasPreciseLocation === true || hasPreciseLocation === 'true';
  }

  if (search !== undefined && search !== null && search !== '') {
    normalized.Search = search;
  }

  return normalized;
};

export const normalizeCommentPayload = (payload = {}) => {
  const content = payload?.content ?? payload?.message ?? payload?.comment ?? '';
  return {
    content: typeof content === 'string' ? content : String(content ?? ''),
  };
};

export const normalizeStaffFeedbackUpdatePayload = (updateData = {}) => {
  const payload = {};

  const assignIfDefined = (key, transform) => {
    if (Object.prototype.hasOwnProperty.call(updateData, key)) {
      const value = transform(updateData[key]);
      if (value !== undefined && value !== null) {
        payload[key] = value;
      }
    }
  };

  assignIfDefined('categoryId', (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });

  assignIfDefined('title', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  assignIfDefined('description', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  assignIfDefined('locationText', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  assignIfDefined('latitude', (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

  assignIfDefined('longitude', (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

  assignIfDefined('priority', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  assignIfDefined('dueDate', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  assignIfDefined('status', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  assignIfDefined('statusNote', (value) => {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  });

  return payload;
};

export const normalizeProviderReportStatus = (value = '') => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';

  const normalizedValue = rawValue.toLowerCase();
  if (normalizedValue === 'reported') return 'Reported';
  if (normalizedValue === 'contacted') return 'InProgress';
  if (normalizedValue === 'accepted') return 'InProgress';
  if (['inprogress', 'in_progress', 'in progress'].includes(normalizedValue)) return 'InProgress';
  if (['done', 'completed', 'complete'].includes(normalizedValue)) return 'Done';
  if (normalizedValue === 'failed') return 'Failed';
  if (normalizedValue === 'cancelled' || normalizedValue === 'canceled') return 'Cancelled';

  return rawValue;
};

export const normalizeProviderContactLogPayload = (payload = {}) => {
  const normalizeOptionalString = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const normalizeDateTime = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const trimmed = value.trim();
    if (!trimmed) return null;

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      const fallback = new Date(`${trimmed}:00`);
      return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
    }

    return date.toISOString();
  };

  const normalized = {
    contactMethod: normalizeOptionalString(payload?.contactMethod),
    contactResult: normalizeOptionalString(payload?.contactResult),
    contactNote: normalizeOptionalString(payload?.contactNote),
    contactedAt: normalizeDateTime(payload?.contactedAt),
  };

  if (normalized.contactMethod === null) delete normalized.contactMethod;
  if (normalized.contactResult === null) delete normalized.contactResult;
  if (normalized.contactNote === null) delete normalized.contactNote;
  if (normalized.contactedAt === null) delete normalized.contactedAt;

  return normalized;
};

export const canTransitionProviderReportStatus = (currentStatus, nextStatus) => {
  const current = normalizeProviderReportStatus(currentStatus);
  const next = normalizeProviderReportStatus(nextStatus);

  const allowedTransitions = {
    Reported: ['InProgress', 'Failed', 'Cancelled'],
    InProgress: ['Done', 'Failed', 'Cancelled'],
    Done: [],
    Failed: [],
    Cancelled: [],
  };

  return Boolean(allowedTransitions[current]?.includes(next));
};

export const resolveProviderReportById = (payload, providerReportId) => {
  const targetId = Number(providerReportId);
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return candidates.find((item) => Number(item?.providerReportId ?? item?.id) === targetId) || null;
};

export const getResolutionSubmitEndpoints = (feedbackId) => {
  const normalizedFeedbackId = String(feedbackId ?? '').trim();
  const endpoints = [];

  if (normalizedFeedbackId) {
    endpoints.push(`/api/management/feedbacks/${normalizedFeedbackId}/resolutions`);
  }

  endpoints.push('/api/management/feedbacks/submit-resolution');
  return endpoints;
};

const normalizeResolutionItems = (payload = {}) => {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.resolutions)
          ? payload.resolutions
          : [];

  if (candidates.length > 0) {
    return candidates;
  }

  if (payload && typeof payload === 'object') {
    const directResolution = payload.resolution || payload.result || payload.item || payload.data || payload.resultData || null;
    if (directResolution && typeof directResolution === 'object') {
      return [directResolution];
    }
  }

  return [];
};

const normalizeInteractionMessagesPayload = (payload = {}) => {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.messages)
          ? payload.messages
          : [];

  return candidates.filter(Boolean);
};


const normalizeFeedbackPagePayload = (response, fallbackPageSize = 10) => {
  const payload = response?.data ?? response ?? {};
  const source = payload?.data ?? payload;
  const rawItems = Array.isArray(source)
    ? source
    : Array.isArray(source?.items)
      ? source.items
      : [];
  const items = normalizeTicketsResponse(rawItems);
  const pageNumber = Number(source?.pageNumber ?? 1);
  const pageSize = Number(source?.pageSize ?? fallbackPageSize);
  const totalItems = Number(source?.totalItems ?? source?.totalCount ?? items.length);
  const calculatedTotalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const totalPages = Number(source?.totalPages ?? calculatedTotalPages);

  return {
    items,
    pageNumber: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : fallbackPageSize,
    totalItems: Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : items.length,
    totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : calculatedTotalPages,
    hasPreviousPage: typeof source?.hasPreviousPage === 'boolean' ? source.hasPreviousPage : pageNumber > 1,
    hasNextPage: typeof source?.hasNextPage === 'boolean' ? source.hasNextPage : pageNumber < totalPages,
  };
};

const ADMIN_FEEDBACK_SUMMARY_GROUPS = {
  pending: ['Submitted', 'AiReviewed', 'Verified'],
  inProgress: ['Assigned', 'InProgress', 'SubmittedForApproval', 'NeedRework'],
  completed: ['Resolved', 'Approved', 'Rejected', 'Closed', 'Cancelled'],
};

const getFeedbackCountByStatus = async (status) => {
  const response = await axiosClient.get('/api/management/feedbacks', {
    params: normalizeFeedbackListParams({ PageNumber: 1, PageSize: 1, Status: status }),
  });
  return normalizeFeedbackPagePayload(response, 1).totalItems;
};

export const managementFeedbackApi = {
  // Get all feedbacks with pagination and filters
  async getFeedbacks(params = {}) {
    const response = await axiosClient.get('/api/management/feedbacks', {
      params: normalizeFeedbackListParams(params),
    });
    return response;
  },

  async getFeedbackPage(params = {}) {
    const normalizedParams = normalizeFeedbackListParams(params);
    const response = await axiosClient.get('/api/management/feedbacks', {
      params: normalizedParams,
    });
    return normalizeFeedbackPagePayload(response, Number(normalizedParams.PageSize) || 10);
  },

  async getFeedbackSummary() {
    const statuses = [...new Set(Object.values(ADMIN_FEEDBACK_SUMMARY_GROUPS).flat())];
    const [totalCount, ...statusCounts] = await Promise.all([
      getFeedbackCountByStatus(),
      ...statuses.map((status) => getFeedbackCountByStatus(status)),
    ]);
    const countsByStatus = Object.fromEntries(statuses.map((status, index) => [status, statusCounts[index] || 0]));
    const sumGroup = (group) => ADMIN_FEEDBACK_SUMMARY_GROUPS[group]
      .reduce((sum, status) => sum + Number(countsByStatus[status] || 0), 0);

    return {
      total: Number(totalCount) || 0,
      pending: sumGroup('pending'),
      inProgress: sumGroup('inProgress'),
      completed: sumGroup('completed'),
    };
  },

  // Get specific feedback by ID
  async getFeedbackById(feedbackId) {
    const response = await axiosClient.get(`/api/management/feedbacks/${feedbackId}`);
    const payload = response?.data ?? response?.item ?? response?.result ?? response;
    return normalizeTicketsResponse([payload])[0] || payload;
  },

  async getFeedbackMessages(feedbackId, options = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) return [];

    const response = await axiosClient.get(`/api/feedbacks/${normalizedFeedbackId}/messages`, {
      params: {
        includeInternal: options?.includeInternal ?? true,
      },
    });

    return normalizeInteractionMessagesPayload(response?.data ?? response?.result ?? response);
  },

  async createFeedbackMessage(feedbackId, payload = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) return null;

    const response = await axiosClient.post(`/api/feedbacks/${normalizedFeedbackId}/messages`, payload);
    return response?.data ?? response?.result ?? response;
  },

  // Step 19: get the resolution history submitted for this feedback.
  async getResolutions(feedbackId) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) return [];

    const response = await axiosClient.get(`/api/management/feedbacks/${normalizedFeedbackId}/resolutions`);
    return normalizeResolutionItems(response);
  },

  // Update feedback details
  async updateFeedback(feedbackId, updateData) {
    const normalizedPayload = normalizeStaffFeedbackUpdatePayload(updateData);
    const response = await axiosClient.put(`/api/management/feedbacks/${feedbackId}`, normalizedPayload);
    return response;
  },

  async deleteFeedback(feedbackId) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) {
      throw new Error('Thiếu feedbackId để xóa phản ánh.');
    }

    const response = await axiosClient.delete(`/api/management/feedbacks/${normalizedFeedbackId}`);
    return response;
  },

  // Swagger contract: PATCH /api/management/feedbacks/{feedbackId}/status with { status, note }.
  // Using PUT on this route is not allowed by the backend and returns 405 Method Not Allowed.
  async updateStatus(feedbackId, statusData) {
    const response = await axiosClient.patch(`/api/management/feedbacks/${feedbackId}/status`, statusData);
    return response;
  },

  async updateProviderReportStatus(providerReportId, payload = {}) {
    const response = await axiosClient.patch(`/api/management/provider-reports/${providerReportId}/status`, payload);
    return response;
  },

  async createAreaAlert(payload = {}) {
    const response = await axiosClient.post('/api/management/area-alerts', payload);
    return response;
  },

  async getAreaAlerts(params = {}) {
    const response = await axiosClient.get('/api/management/area-alerts', { params });
    return response;
  },

  async getProviderReports(feedbackId) {
    const candidates = [
      `/api/management/feedbacks/${feedbackId}/provider-reports`,
      `/api/management/feedbacks/${feedbackId}/provider-report`,
      `/api/management/feedbacks/${feedbackId}/provider`,
    ];

    for (const endpoint of candidates) {
      try {
        return await axiosClient.get(endpoint);
      } catch (error) {
        if (endpoint === candidates[candidates.length - 1]) {
          return [];
        }
      }
    }

    return [];
  },

  // Get provider candidates for a feedback (Swagger: /api/management/feedbacks/{feedbackId}/provider-candidates)
  async getProviderCandidates(feedbackId) {
    const candidates = [
      `/api/management/feedbacks/${feedbackId}/provider-candidates`,
      `/api/feedbacks/${feedbackId}/provider-candidates`,
      `/api/management/feedbacks/${feedbackId}/provider-candidate`,
      `/api/feedbacks/${feedbackId}/provider-candidate`,
    ];

    for (const endpoint of candidates) {
      try {
        return await axiosClient.get(endpoint);
      } catch (error) {
        // try next
        if (endpoint === candidates[candidates.length - 1]) {
          // last candidate failed — return empty array to callers
          return [];
        }
      }
    }

    return [];
  },

  async getLinkedFeedbacks(feedbackId, options = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) return [];

    const response = await axiosClient.get(
      `/api/management/feedbacks/${normalizedFeedbackId}/linked-feedbacks`,
      { signal: options?.signal },
    );
    return normalizeLinkedFeedbacksPayload(response);
  },

  async getRelatedFeedbacks(feedbackId, options = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) return [];

    const scope = options?.scope || 'management';
    const endpoint = scope === 'community'
      ? `/api/user/feedbacks/feed/${normalizedFeedbackId}/related`
      : scope === 'user'
        ? `/api/user/feedbacks/${normalizedFeedbackId}/related`
        : `/api/management/feedbacks/${normalizedFeedbackId}/related`;

    const response = await axiosClient.get(endpoint, { signal: options?.signal });
    return normalizeRelatedFeedbacksPayload(response, normalizedFeedbackId);
  },

  // Get a single provider report by its id.
  // The backend currently exposes provider report data through the feedback-level list endpoint,
  // so we prefer that shape and can scan feedbacks when the page is opened without navigation state.
  async getProviderReportById(providerReportId, feedbackId = null) {
    const normalizedId = String(providerReportId ?? '').trim();
    if (!normalizedId) {
      return null;
    }

    if (feedbackId) {
      try {
        const listResponse = await axiosClient.get(`/api/management/feedbacks/${feedbackId}/provider-reports`);
        const matchedReport = resolveProviderReportById(listResponse, normalizedId);
        if (matchedReport) {
          return matchedReport;
        }
      } catch (error) {
        if (error?.response?.status !== 404) {
          throw error;
        }
      }
    }

    try {
      const feedbacksResponse = await axiosClient.get('/api/management/feedbacks', {
        params: {
          PageNumber: 1,
          PageSize: 100,
        },
      });

      const feedbackItems = Array.isArray(feedbacksResponse)
        ? feedbacksResponse
        : Array.isArray(feedbacksResponse?.items)
          ? feedbacksResponse.items
          : Array.isArray(feedbacksResponse?.data)
            ? feedbacksResponse.data
            : [];

      for (const feedback of feedbackItems) {
        const currentFeedbackId = feedback?.feedbackId || feedback?.id;
        if (!currentFeedbackId) continue;

        try {
          const listResponse = await axiosClient.get(`/api/management/feedbacks/${currentFeedbackId}/provider-reports`);
          const matchedReport = resolveProviderReportById(listResponse, normalizedId);
          if (matchedReport) {
            return matchedReport;
          }
        } catch (error) {
          if (error?.response?.status === 404) {
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }

    try {
      return await axiosClient.get(`/api/management/provider-reports/${normalizedId}`);
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
      return null;
    }
  },

  async getProviderReportContactLogs(providerReportId) {
    const response = await axiosClient.get(`/api/management/provider-reports/${providerReportId}/contact-logs`);
    return response;
  },

  // Get service providers / coordinators directory with filters and pagination
  async getServiceProviders(params = {}) {
    try {
      const response = await axiosClient.get('/api/management/service-providers', { params });
      return response;
    } catch (error) {
      // Return an empty paged response shape on failure to keep callers simple
      console.warn('managementFeedbackApi.getServiceProviders failed', error);
      return { items: [], totalCount: 0, page: params?.page || params?.PageNumber || 1, pageSize: params?.pageSize || params?.PageSize || 10 };
    }
  },

  // Get a single service provider / coordinator detail
  async getServiceProviderDetail(coordinatorId) {
    if (!coordinatorId) return null;
    try {
      const response = await axiosClient.get(`/api/management/service-providers/${coordinatorId}`);
      const payload = response?.data ?? response?.item ?? response?.result ?? response ?? null;
      return payload;
    } catch (error) {
      console.warn('managementFeedbackApi.getServiceProviderDetail failed', error);
      throw error;
    }
  },

  async createServiceProvider(payload) {
    return axiosClient.post('/api/management/service-providers', payload);
  },

  async updateServiceProvider(coordinatorId, payload) {
    return axiosClient.put(`/api/management/service-providers/${coordinatorId}`, payload);
  },

  async setServiceProviderActive(coordinatorId, isActive) {
    return axiosClient.patch(`/api/management/service-providers/${coordinatorId}/active`, { isActive });
  },

  // Get coverages for a coordinator
  async getCoordinatorCoverages(coordinatorId) {
    if (!coordinatorId) return [];
    try {
      const response = await axiosClient.get(`/api/management/service-providers/${coordinatorId}/coverages`);
      const payload = response?.data ?? response?.items ?? response ?? [];

      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;

      return [];
    } catch (error) {
      if (error?.response?.status === 404) return [];
      console.warn('managementFeedbackApi.getCoordinatorCoverages failed', error);
      throw error;
    }
  },

  async createCoordinatorCoverage(coordinatorId, payload) {
    return axiosClient.post(`/api/management/service-providers/${coordinatorId}/coverages`, payload);
  },

  async updateCoordinatorCoverage(coordinatorId, coverageId, payload) {
    return axiosClient.put(
      `/api/management/service-providers/${coordinatorId}/coverages/${coverageId}`,
      payload
    );
  },

  async createProviderReportContactLog(providerReportId, payload) {
    const normalizedPayload = normalizeProviderContactLogPayload(payload);
    const response = await axiosClient.post(
      `/api/management/provider-reports/${providerReportId}/contact-logs`,
      normalizedPayload
    );
    return response;
  },

  async createAreaAlertFromFeedback(feedbackId, payload = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) {
      throw new Error('Thiếu feedbackId để tạo cảnh báo.');
    }

    const endpoints = [
      `/api/management/feedbacks/${normalizedFeedbackId}/area-alert`,
      '/api/management/area-alerts',
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        return await axiosClient.post(endpoint, payload);
      } catch (error) {
        const status = error?.response?.status;
        if (endpoint === endpoints[0] && (status === 404 || status === 405)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Không thể tạo cảnh báo.');
  },

  async getCompletionDocuments(feedbackId) {
    const candidates = [
      `/api/management/feedbacks/${feedbackId}/completion-documents`,
      `/api/management/feedbacks/${feedbackId}/documents`,
      `/api/management/feedbacks/${feedbackId}/provider-reports/documents`,
    ];

    for (const endpoint of candidates) {
      try {
        return await axiosClient.get(endpoint);
      } catch (error) {
        if (endpoint === candidates[candidates.length - 1]) {
          return [];
        }
      }
    }

    return [];
  },

  async getProviderReportCompletionDocuments(providerReportId) {
    const candidates = [
      `/api/management/provider-reports/${providerReportId}/completion-documents`,
      `/api/management/provider-reports/${providerReportId}/documents`,
    ];

    for (const endpoint of candidates) {
      try {
        return await axiosClient.get(endpoint);
      } catch (error) {
        if (endpoint === candidates[candidates.length - 1]) {
          return [];
        }
      }
    }

    return [];
  },

  async uploadCompletionDocument(providerReportId, file, metadata = {}) {
    const formData = new FormData();
    formData.append('Files', file, file?.name || 'completion-document');

    const description = typeof metadata?.description === 'string' ? metadata.description.trim() : '';
    if (description) {
      formData.append('Description', description);
    }

    const response = await axiosClient.post(
      `/api/management/provider-reports/${providerReportId}/completion-documents`,
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );

    return response;
  },

  async clearProviderReportCompletionDocuments(providerReportId) {
  const normalizedId = Number(providerReportId);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('providerReportId không hợp lệ.');
  }

  return axiosClient.delete(
    `/api/management/provider-reports/${normalizedId}/completion-documents`
  );
},

  // Verify feedback
  async verifyFeedback(feedbackId, verifyData = null) {
    const hasPayload = verifyData
      && typeof verifyData === 'object'
      && Object.keys(verifyData).length > 0;
    const response = hasPayload
      ? await axiosClient.put(`/api/management/feedbacks/${feedbackId}/verify`, verifyData)
      : await axiosClient.put(`/api/management/feedbacks/${feedbackId}/verify`);
    return response;
  },

  // Assign feedback to operator
  async assignToOperator(assignmentData) {
    const response = await axiosClient.post('/api/management/feedbacks/assign', assignmentData);
    return response;
  },

  // Submit a resolution from an operator
  async submitResolution(feedbackId, resolutionData = {}) {
    const normalizedFeedbackId = String(feedbackId ?? '').trim();
    if (!normalizedFeedbackId) {
      throw new Error('Thiếu feedbackId để gửi resolution.');
    }

    const payload = {
      ...resolutionData,
      feedbackId: normalizedFeedbackId,
    };

    const endpoints = getResolutionSubmitEndpoints(normalizedFeedbackId);

    for (const endpoint of endpoints) {
      try {
        return await axiosClient.post(endpoint, payload);
      } catch (error) {
        const status = error?.response?.status;
        if (status !== 404 && status !== 405) {
          throw error;
        }
      }
    }

    return null;
  },

  // Get feedbacks that have already been reviewed by AI
  async getAiReviewedFeedbacks(params = {}) {
    const response = await axiosClient.get('/api/management/feedbacks/ai-reviewed', {
      params: normalizeFeedbackListParams(params),
    });
    return normalizeAiReviewedPayload(response);
  },

  // Keep the backend pagination contract for Manager review queues.
  async getAiReviewedFeedbackPage(params = {}) {
    const response = await axiosClient.get('/api/management/feedbacks/ai-reviewed', {
      params: normalizeFeedbackListParams(params),
    });
    return normalizeAiReviewedPage(response);
  },

  // Approve an operator's resolution
  async approveFeedback(feedbackId, note = '') {
    const normalizedNote = typeof note === 'string' ? note.trim() : '';
    const config = normalizedNote ? { params: { note: normalizedNote } } : {};
    const response = await axiosClient.put(
      `/api/management/feedbacks/${feedbackId}/approve`,
      null,
      config
    );
    return response;
  },

  // Request rework on a resolved feedback
  async requestRework(feedbackId, note = '') {
    const response = await axiosClient.put(
      `/api/management/feedbacks/${feedbackId}/need-rework`,
      JSON.stringify(note),
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response;
  },
};
