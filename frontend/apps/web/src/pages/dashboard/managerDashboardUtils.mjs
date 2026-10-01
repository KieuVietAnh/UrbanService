const arrayOrFallback = (value, fallback) => (
  Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : [])
);

export const buildManagerDashboardStats = (baseStats = {}, managerDashboard = {}, previousStats = {}) => {
  const managerOverview = managerDashboard?.overview ?? previousStats?.managerOverview ?? null;
  const slaOverview = managerDashboard?.slaOverview ?? previousStats?.slaOverview ?? null;
  const todaySummary = managerDashboard?.todaySummary ?? previousStats?.todaySummary ?? null;

  return {
    ...baseStats,
    categoryDistribution: arrayOrFallback(
      managerDashboard?.categoryDistribution,
      previousStats?.categoryDistribution ?? baseStats?.categoryDistribution,
    ),
    statusDistribution: arrayOrFallback(
      managerDashboard?.statusDistribution,
      previousStats?.statusDistribution ?? baseStats?.statusDistribution,
    ),
    priorityDistribution: arrayOrFallback(
      managerDashboard?.priorityDistribution,
      previousStats?.priorityDistribution ?? baseStats?.priorityDistribution,
    ),
    areaDistribution: arrayOrFallback(managerDashboard?.areaDistribution, previousStats?.areaDistribution),
    monthlyTrend: arrayOrFallback(managerDashboard?.monthlyTrend, previousStats?.monthlyTrend),
    urgentOpen: arrayOrFallback(managerDashboard?.urgentOpen, previousStats?.urgentOpen),
    slaBreaches: Number.isFinite(Number(slaOverview?.breachedSla))
      ? Number(slaOverview.breachedSla)
      : (Number(previousStats?.slaBreaches) || Number(baseStats?.slaBreaches) || 0),
    processingRate: Number.isFinite(Number(managerOverview?.completionRate))
      ? Math.round(Number(managerOverview.completionRate))
      : (Number(previousStats?.processingRate) || Number(baseStats?.processingRate) || 0),
    managerOverview,
    managerOverviewAvailable: Boolean(managerOverview),
    todaySummary,
    slaOverview,
    managerDataIssues: Array.isArray(managerDashboard?.dataIssues) ? managerDashboard.dataIssues : [],
  };
};

export const managerMetricValue = (available, value) => (available ? value : '—');
