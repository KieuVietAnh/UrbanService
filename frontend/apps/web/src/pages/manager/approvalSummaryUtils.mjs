export const fetchAllApprovalSummaryPages = async (
  fetchPage,
  { pageSize = 500, signal } = {},
) => {
  const first = await fetchPage({
    pageNumber: 1,
    pageSize,
    status: 'SubmittedForApproval',
    includeMerged: false,
  }, { signal });

  const firstItems = Array.isArray(first?.items) ? first.items : [];
  const totalItems = Number.isFinite(Number(first?.totalItems))
    ? Number(first.totalItems)
    : firstItems.length;
  const totalPages = Math.max(
    1,
    Number.isFinite(Number(first?.totalPages))
      ? Number(first.totalPages)
      : Math.ceil(totalItems / pageSize),
  );

  if (totalPages === 1) {
    return { items: firstItems, totalItems, partial: false };
  }

  const settled = await Promise.allSettled(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage({
      pageNumber: index + 2,
      pageSize,
      status: 'SubmittedForApproval',
      includeMerged: false,
    }, { signal })),
  );

  const fulfilled = settled.filter((result) => result.status === 'fulfilled');
  return {
    items: [
      ...firstItems,
      ...fulfilled.flatMap((result) => (
        Array.isArray(result.value?.items) ? result.value.items : []
      )),
    ],
    totalItems,
    partial: fulfilled.length !== settled.length,
  };
};
