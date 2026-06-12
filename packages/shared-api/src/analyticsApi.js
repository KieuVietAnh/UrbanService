import { mockDb } from './mockStore.js';

export const analyticsApi = {
  async getSystemDashboardStats() {
    const tickets = mockDb.getTickets();
    const users = mockDb.getUsers();
    const now = new Date();

    const totalTickets = tickets.length;
    const totalUsers = users.length;
    const activeTickets = tickets.filter((t) => t.status !== 'Closed').length;
    const resolvedTickets = tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed').length;
    const processingRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    const slaBreaches = tickets.filter((t) => {
      if (t.status === 'Closed' || t.status === 'Resolved') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    }).length;

    const categories = mockDb.getCategories();
    const categoryDistribution = categories.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      count: tickets.filter((t) => t.categoryId === cat.categoryId).length,
    }));

    const sentimentTrend = {
      Positive: tickets.filter((t) => t.sentiment === 'Positive').length,
      Neutral: tickets.filter((t) => t.sentiment === 'Neutral').length,
      Negative: tickets.filter((t) => t.sentiment === 'Negative').length,
    };

    const ratedTickets = tickets.filter((t) => t.reviews && t.reviews.length > 0);
    const avgCsat = ratedTickets.length > 0
      ? Number((ratedTickets.reduce((acc, t) => acc + t.reviews[0].rating, 0) / ratedTickets.length).toFixed(1))
      : 4.5;

    const resolvedWithDuration = tickets.filter((t) => t.resolution && t.resolution.resolvedAt);
    const avgResolutionTimeHours = resolvedWithDuration.length > 0
      ? Math.round(resolvedWithDuration.reduce((acc, t) => {
          const created = new Date(t.createdAt);
          const resolved = new Date(t.resolution.resolvedAt);
          return acc + (resolved - created) / (1000 * 60 * 60);
        }, 0) / resolvedWithDuration.length)
      : 18;

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
      aiStatus: 'Idle (Listening)',
    };
  }
};
