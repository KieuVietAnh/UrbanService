import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { toolsApi } from '@urbanmind/shared-api';
import { EmptyState, LoadingSpinner } from '@urbanmind/shared-ui';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import * as Lucide from 'lucide-react';
import { ManagerPageHeader, ManagerSectionHeader } from '../../components/manager/ManagerPageElements';

const PAGE_SIZE = 10;
const COORDINATOR_CACHE_KEY = 'staff-coordinator-directory-cache';

const readCoordinatorCache = () => {
  try {
    const raw = sessionStorage.getItem(COORDINATOR_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const mergeCoordinatorCache = (patch) => {
  try {
    const current = readCoordinatorCache() || {};
    sessionStorage.setItem(
      COORDINATOR_CACHE_KEY,
      JSON.stringify({ ...current, ...patch, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage failures.
  }
};

const getAreaLabel = (area) => area?.name || area?.areaName || area?.displayName || `Khu vực ${area?.id || area?.areaId || ''}`;
const getCategoryLabel = (category) => category?.name || category?.categoryName || category?.categoryType || `Danh mục ${category?.id || category?.categoryId || ''}`;

export default function CoordinatorDirectoryPage() {
  const navigate = useNavigate();

  const [initialCache] = useState(() => readCoordinatorCache());
  const [items, setItems] = useState(() => (
    Array.isArray(initialCache?.items) ? initialCache.items : []
  ));
  const [areas, setAreas] = useState(() => (
    Array.isArray(initialCache?.areas) ? initialCache.areas : []
  ));
  const [categories, setCategories] = useState(() => (
    Array.isArray(initialCache?.categories) ? initialCache.categories : []
  ));
  const [loading, setLoading] = useState(() => !Array.isArray(initialCache?.items));
  const [error, setError] = useState('');

  const [search, setSearch] = useState(() => initialCache?.search || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => initialCache?.search || '');
  const [areaId, setAreaId] = useState(() => initialCache?.areaId || '');
  const [categoryId, setCategoryId] = useState(() => initialCache?.categoryId || '');
  const [includeInactive, setIncludeInactive] = useState(() => Boolean(initialCache?.includeInactive));
  const [currentPage, setCurrentPage] = useState(() => Number(initialCache?.currentPage) || 1);

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      const hasCachedLookups =
        Array.isArray(initialCache?.areas) && initialCache.areas.length > 0
        && Array.isArray(initialCache?.categories) && initialCache.categories.length > 0;

      if (hasCachedLookups) return;

      const [aRes, cRes] = await Promise.allSettled([
        toolsApi.getAreas(),
        toolsApi.getCategories(),
      ]);

      if (!active) return;

      const resolvedAreas = aRes.status === 'fulfilled' && Array.isArray(aRes.value) ? aRes.value : [];
      const resolvedCategories = cRes.status === 'fulfilled' && Array.isArray(cRes.value) ? cRes.value : [];
      setAreas(resolvedAreas);
      setCategories(resolvedCategories);
      mergeCoordinatorCache({ areas: resolvedAreas, categories: resolvedCategories });
    };

    loadLookups();
    return () => { active = false; };
  }, [initialCache]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchCoordinators = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Swagger: endpoint này trả về toàn bộ mảng kết quả và chỉ nhận 4 filter dưới đây.
      const response = await managementFeedbackApi.getServiceProviders({
        search: debouncedSearch.trim() || undefined,
        areaId: areaId ? Number(areaId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        includeInactive,
      });

      const itemsArr = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data)
            ? response.data
            : [];

      setItems(itemsArr);
      mergeCoordinatorCache({
        items: itemsArr,
        search: debouncedSearch,
        areaId,
        categoryId,
        includeInactive,
      });
    } catch (err) {
      console.error('Failed to fetch coordinators', err);
      setError('Không thể tải danh sách điều phối viên. Vui lòng thử lại.');
      setItems((current) => (current.length > 0 ? current : []));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, areaId, categoryId, includeInactive]);

  useEffect(() => {
    fetchCoordinators();
  }, [fetchCoordinators]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, areaId, categoryId, includeInactive]);

  const totalCount = items.length;
  const activeCount = useMemo(() => items.filter((item) => item?.isActive !== false).length, [items]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedItems = useMemo(
    () => items.slice(pageStart, pageStart + PAGE_SIZE),
    [items, pageStart]
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    mergeCoordinatorCache({ currentPage });
  }, [currentPage]);

  const hasFilters = Boolean(search.trim() || areaId || categoryId || includeInactive);
  const clearFilters = () => {
    setSearch('');
    setAreaId('');
    setCategoryId('');
    setIncludeInactive(false);
  };

  if (loading && items.length === 0) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Lỗi tải danh bạ" message={error} />
        <Button onClick={fetchCoordinators} variant="primary" size="sm">
          <Lucide.RefreshCw size={16} /> Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-page-shell space-y-6">
      <ManagerPageHeader
        title="Danh bạ điều phối viên"
        description="Tra cứu đầu mối điều phối theo đơn vị cung cấp dịch vụ, khu vực và danh mục phụ trách."
        icon={Lucide.ContactRound}
        statusLabel="TỔNG ĐIỀU PHỐI VIÊN"
        statusValue={`${totalCount} người`}
      />

      {error ? <ErrorAlert title="Không thể làm mới danh bạ" message={error} /> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="admin-panel flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">Đang hoạt động</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{activeCount}</p>
            <p className="mt-2 text-sm text-slate-500">Điều phối viên đang sẵn sàng trong kết quả hiện tại.</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Lucide.UserCheck size={20} />
          </span>
        </div>

        <div className="admin-panel flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-500">Kết quả hiện tại</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{totalCount}</p>
            <p className="mt-2 text-sm text-slate-500">Số điều phối viên phù hợp với bộ lọc đang chọn.</p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Lucide.Users size={20} />
          </span>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <ManagerSectionHeader
            title="Tra cứu điều phối viên"
            description="Tìm theo tên, email hoặc số điện thoại; có thể thu hẹp theo khu vực và danh mục."
            icon={Lucide.Search}
            actions={hasFilters ? (
              <Button type="button" onClick={clearFilters} variant="ghost" size="sm">
                <Lucide.RotateCcw size={15} /> Xóa bộ lọc
              </Button>
            ) : null}
          />
        </div>

        <div className="border-b border-slate-200 bg-slate-50/55 px-5 py-4 sm:px-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_minmax(190px,0.7fr)_minmax(190px,0.7fr)_auto] xl:items-center">
            <label className="relative block">
              <Lucide.Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm tên, email hoặc số điện thoại"
                className="input h-11 w-full rounded-xl border-slate-200 bg-white pl-9 text-sm shadow-sm"
              />
            </label>

            <select
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              className="select staff-coordinator-select h-11 w-full rounded-xl text-sm shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              <option value="" style={{ backgroundColor: '#ffffff' }}>Tất cả khu vực</option>
              {areas.map((area) => (
                <option key={area.id || area.areaId} value={area.id || area.areaId} style={{ backgroundColor: '#ffffff' }}>
                  {getAreaLabel(area)}
                </option>
              ))}
            </select>

            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="select staff-coordinator-select h-11 w-full rounded-xl text-sm shadow-sm"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              <option value="" style={{ backgroundColor: '#ffffff' }}>Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category.id || category.categoryId} value={category.id || category.categoryId} style={{ backgroundColor: '#ffffff' }}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>

            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(Boolean(event.target.checked))}
                className="checkbox checkbox-sm border-slate-300"
              />
              Bao gồm đã ngừng hoạt động
            </label>
          </div>
        </div>

        {paginatedItems.length === 0 ? (
          <div className="px-6 py-12">
            <EmptyState
              title="Không có điều phối viên phù hợp"
              description="Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc để xem thêm kết quả."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[19%]" />
                  <col className="w-[16%]" />
                  <col className="w-[20%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Điều phối viên</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Đơn vị</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Điện thoại</th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Email</th>
                    <th className="px-5 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Vùng phủ</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedItems.map((item) => {
                    const id = item.coordinatorId || item.id;
                    const name = item.coordinatorName || item.name || item.fullName || 'Chưa có tên';
                    return (
                      <tr
                        key={id}
                        onClick={() => navigate(`/staff/coordinators/${id}`)}
                        className="cursor-pointer transition-colors hover:bg-blue-50/35"
                      >
                        <td className="px-5 py-4 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-700">
                              {String(name).trim().charAt(0).toUpperCase() || 'Đ'}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900" title={name}>{name}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">ID #{id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-middle text-slate-600"><div className="line-clamp-2">{item.providerName || item.provider?.name || '—'}</div></td>
                        <td className="px-5 py-4 align-middle whitespace-nowrap text-slate-600">{item.phoneNumber || item.phone || '—'}</td>
                        <td className="px-5 py-4 align-middle"><div className="truncate text-slate-600" title={item.email || ''}>{item.email || '—'}</div></td>
                        <td className="px-5 py-4 text-center align-middle"><span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.coverageCount ?? item.coverage?.length ?? 0}</span></td>
                        <td className="px-5 py-4 text-right align-middle">
                          <Badge intent={item.isActive === false ? 'neutral' : 'success'} className="whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold">
                            {item.isActive === false ? 'Ngừng hoạt động' : 'Đang hoạt động'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/55 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Hiển thị <span className="font-semibold text-slate-700">{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, totalCount)}</span> trong tổng số <span className="font-semibold text-slate-700">{totalCount}</span> điều phối viên
              </p>

              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safePage === 1} variant="outline" size="sm">Trước</Button>
                  <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{safePage}/{totalPages}</span>
                  <Button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safePage === totalPages} variant="outline" size="sm">Sau</Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
