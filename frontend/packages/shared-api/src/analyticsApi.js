import { axiosClient } from './axiosClient.js';
import { managementTypes } from '@urbanmind/shared-types';
import { getFeedbackBasePath, normalizeTicketsResponse } from './ticketApiHelpers.js';

const normalizeRole = (role) => {
  if (!role) return null;
  const normalized = String(role).trim().replace(/[-_\s]/g, '').toLowerCase();
  switch (normalized) {
    case 'serviceuser':
      return 'service-user';
    case 'systemstaff':
      return 'system-staff';
    case 'serviceprovider':
    case 'serviceoperator':
    case 'serviceproviderstaff':
    case 'serviceoperatorstaff':
      return 'service-provider';
    case 'interactionmanager':
      return 'interaction-manager';
    case 'systemadmin':
    case 'administrator':
    case 'admin':
      return 'administrator';
    default:
      return role;
  }
};


const unwrapPagedItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
};

const readPagedTotal = (response, fallback = 0) => {
  const candidates = [
    response?.totalCount,
    response?.totalItems,
    response?.data?.totalCount,
    response?.data?.totalItems,
  ];
  const total = candidates.map(Number).find((value) => Number.isFinite(value) && value >= 0);
  return total ?? fallback;
};

const getAllAiReviewedFeedbacks = async () => {
  const pageSize = 500;
  const first = await axiosClient.get('/api/management/feedbacks/ai-reviewed', {
    params: { PageNumber: 1, PageSize: pageSize },
  });
  const firstItems = unwrapPagedItems(first);
  const total = readPagedTotal(first, firstItems.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages === 1) return firstItems;

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      axiosClient.get('/api/management/feedbacks/ai-reviewed', {
        params: { PageNumber: index + 2, PageSize: pageSize },
      })
    )
  );

  return [
    ...firstItems,
    ...remaining.flatMap((response) => unwrapPagedItems(response)),
  ];
};

export const analyticsApi = {

  async getManagerSentimentStats() {
    try {
      const [aiReviewedItems, aiHealthResponse] = await Promise.all([
        getAllAiReviewedFeedbacks(),
        axiosClient.get('/api/ai/health').catch((error) => {
          console.warn('Unable to load AI health for sentiment analytics', error);
          return null;
        }),
      ]);

      const aiHealth = aiHealthResponse?.data ?? aiHealthResponse;
      const aiAvailability = aiHealth
        ? (aiHealth.isAvailable ? 'available' : 'unavailable')
        : 'unknown';

      return {
        items: aiReviewedItems,
        reviewedCount: aiReviewedItems.length,
        aiAvailability,
      };
    } catch (error) {
      console.warn('analyticsApi.getManagerSentimentStats failed', error);
      throw error;
    }
  },
  async getSystemDashboardStats(role) {
    try {
      const normalizedRole = normalizeRole(role);
      const feedbackBasePath = getFeedbackBasePath(normalizedRole);
      const fetchUsers = normalizedRole === 'administrator';
      const fetchManagerAiData = normalizedRole === 'interaction-manager';
      const [ticketsResponse, usersResponse, aiReviewedResponse, aiHealthResponse] = await Promise.all([
        axiosClient.get(feedbackBasePath, { params: { pageSize: 1000 } }),
        fetchUsers
          ? axiosClient.get('/api/admin/users', { params: { pageSize: 1000 } })
          : Promise.resolve(null),
        fetchManagerAiData
          ? axiosClient.get('/api/management/feedbacks/ai-reviewed', {
              params: { PageNumber: 1, PageSize: 1000 },
            }).catch((error) => {
              console.warn('Unable to load AI-reviewed feedbacks for dashboard sentiment', error);
              return null;
            })
          : Promise.resolve(null),
        fetchManagerAiData
          ? axiosClient.get('/api/ai/health').catch((error) => {
              console.warn('Unable to load AI health for dashboard', error);
              return null;
            })
          : Promise.resolve(null),
      ]);

      const tickets = normalizeTicketsResponse(ticketsResponse);
      const users = fetchUsers
        ? (Array.isArray(usersResponse?.items) ? usersResponse.items : Array.isArray(usersResponse) ? usersResponse : [])
        : [];
      const now = new Date();

      const totalTickets = tickets.length;
      const totalUsers = users.length;
      const activeTickets = tickets.filter((t) => t.status !== managementTypes.feedbackStatus.CLOSED).length;
      const resolvedTickets = tickets.filter((t) => t.status === managementTypes.feedbackStatus.RESOLVED || t.status === managementTypes.feedbackStatus.CLOSED).length;
      const processingRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

      const slaBreaches = tickets.filter((t) => {
        if (t.status === managementTypes.feedbackStatus.CLOSED || t.status === managementTypes.feedbackStatus.RESOLVED) return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < now;
      }).length;

      const categories = Array.isArray(usersResponse?.categories) ? usersResponse.categories : [];
      const categoryDistribution = categories.map((cat) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        count: tickets.filter((t) => t.categoryId === cat.categoryId).length,
      }));

      const aiReviewedItems = Array.isArray(aiReviewedResponse?.items)
        ? aiReviewedResponse.items
        : Array.isArray(aiReviewedResponse?.data?.items)
          ? aiReviewedResponse.data.items
          : [];
      const sentimentSource = fetchManagerAiData ? aiReviewedItems : tickets;
      const sentimentTrend = sentimentSource.reduce((counts, item) => {
        const rawSentiment = fetchManagerAiData
          ? item?.analysisResult?.sentiment
          : item?.sentiment;
        const sentiment = String(rawSentiment || '').trim().toLowerCase();

        if (sentiment === 'positive') counts.Positive += 1;
        if (sentiment === 'neutral') counts.Neutral += 1;
        if (sentiment === 'negative') counts.Negative += 1;
        return counts;
      }, { Positive: 0, Neutral: 0, Negative: 0 });

      const ratedTickets = tickets.filter((t) => t.reviews && t.reviews.length > 0);
      const avgCsat = ratedTickets.length > 0
        ? Number((ratedTickets.reduce((acc, t) => acc + t.reviews[0].rating, 0) / ratedTickets.length).toFixed(1))
        : 0;

      const resolvedWithDuration = tickets.filter((t) => t.resolution && t.resolution.resolvedAt);
      const avgResolutionTimeHours = resolvedWithDuration.length > 0
        ? Math.round(resolvedWithDuration.reduce((acc, t) => {
            const created = new Date(t.createdAt);
            const resolved = new Date(t.resolution.resolvedAt);
            return acc + (resolved - created) / (1000 * 60 * 60);
          }, 0) / resolvedWithDuration.length)
        : 0;

      const aiHealth = aiHealthResponse?.data ?? aiHealthResponse;
      const aiStatus = fetchManagerAiData
        ? (aiHealth
          ? (aiHealth.isAvailable
            ? `Đang hoạt động${aiHealth.model ? ` · ${aiHealth.model}` : ''}`
            : 'Không khả dụng')
          : 'Chưa xác định')
        : 'Chưa xác định';

      return {
        totalTickets,
        totalUsers,
        activeTickets,
        resolvedTickets,
        processingRate,
        slaBreaches,
        categoryDistribution,
        sentimentTrend,
        csatScore: avgCsat,
        avgResolutionTimeHours,
        storageUsage: '12.4 KB / 5 MB',
        apiStatus: 'Healthy',
        aiStatus,
      };
    } catch (error) {
      console.warn('analyticsApi.getSystemDashboardStats failed, returning safe defaults', error);
      return {
        totalTickets: 0,
        totalUsers: 0,
        activeTickets: 0,
        resolvedTickets: 0,
        processingRate: 0,
        slaBreaches: 0,
        categoryDistribution: [],
        sentimentTrend: { Positive: 0, Neutral: 0, Negative: 0 },
        csatScore: 0,
        avgResolutionTimeHours: 0,
        storageUsage: '0 KB / 0 MB',
        apiStatus: 'Unavailable',
        aiStatus: 'Unavailable',
      };
    }
  }
};
