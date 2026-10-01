import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { LoadingSpinner, EmptyState } from '@urbanmind/shared-ui';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import * as Lucide from 'lucide-react';
import { ManagerPageHeader, ManagerSectionHeader } from '../../components/manager/ManagerPageElements';

export default function CoordinatorDetailPage() {
  const { coordinatorId } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [coverages, setCoverages] = useState([]);
  const [loadingCoverages, setLoadingCoverages] = useState(false);
  const [errorCoverages, setErrorCoverages] = useState('');

  const loadDetail = useCallback(async () => {
    if (!coordinatorId) return;
    setLoading(true);
    setError('');
    try {
      const res = await managementFeedbackApi.getServiceProviderDetail(coordinatorId);
      setItem(res ?? null);
    } catch (err) {
      console.error('Failed to load coordinator detail', err);
      setError('Không thể tải thông tin điều phối viên. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [coordinatorId]);

  const loadCoverages = useCallback(async () => {
    if (!coordinatorId) return;
    setLoadingCoverages(true);
    setErrorCoverages('');
    try {
      const res = await managementFeedbackApi.getCoordinatorCoverages(coordinatorId);
      setCoverages(Array.isArray(res) ? res : (res?.items ?? []));
    } catch (err) {
      console.error('Failed to load coverages', err);
      setErrorCoverages('Không thể tải danh sách vùng phủ. Vui lòng thử lại.');
      setCoverages([]);
    } finally {
      setLoadingCoverages(false);
    }
  }, [coordinatorId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (activeTab === 'coverages') loadCoverages();
  }, [activeTab, loadCoverages]);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  if (error) {
    return (
      <div className="space-y-4">
        <ErrorAlert title="Lỗi tải chi tiết" message={error} />
        <Button onClick={loadDetail} variant="primary" size="sm"><Lucide.RefreshCw size={16} /> Thử lại</Button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="admin-page-shell">
        <div className="admin-panel p-8 text-center">
          <Lucide.UserRoundX size={32} className="mx-auto text-slate-400" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Không tìm thấy điều phối viên</h2>
          <p className="mt-1 text-sm text-slate-500">Không có dữ liệu cho ID #{coordinatorId}.</p>
          <Button onClick={() => navigate('/staff/coordinators')} variant="outline" size="sm" className="mt-4">Quay lại danh bạ</Button>
        </div>
      </div>
    );
  }

  const name = item.coordinatorName || item.name || item.fullName || 'Điều phối viên';
  const provider = item.providerName || item.provider?.name || 'Chưa xác định đơn vị';
  const coverageCount = item.coverageCount ?? item.coverage?.length ?? 0;
  const isActive = item.isActive !== false;

  return (
    <div className="admin-page-shell space-y-6">
      <ManagerPageHeader
        title={name}
        description={`${provider} • Mã điều phối viên #${coordinatorId}`}
        icon={Lucide.ContactRound}
        statusLabel="TRẠNG THÁI"
        statusValue={isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
        actions={(
          <Button onClick={() => navigate('/staff/coordinators')} variant="ghost" size="sm">
            <Lucide.ArrowLeft size={16} /> Quay lại danh bạ
          </Button>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Điện thoại</p>
          <p className="mt-2 truncate font-semibold text-slate-900">{item.phoneNumber || item.phone || '—'}</p>
        </div>
        <div className="admin-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Email</p>
          <p className="mt-2 truncate font-semibold text-slate-900" title={item.email || ''}>{item.email || '—'}</p>
        </div>
        <div className="admin-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Vùng phủ</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{coverageCount}</p>
        </div>
        <div className="admin-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Trạng thái</p>
          <div className="mt-2">
            <Badge intent={isActive ? 'success' : 'neutral'} className="px-2.5 py-1 text-[11px] font-semibold">
              {isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
            </Badge>
          </div>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 pt-5 sm:px-6">
          <ManagerSectionHeader
            title="Thông tin điều phối"
            description="Xem thông tin liên hệ và phạm vi phụ trách của điều phối viên."
            icon={Lucide.BriefcaseBusiness}
          />
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'details' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="inline-flex items-center gap-2"><Lucide.UserRound size={16} /> Chi tiết</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('coverages')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'coverages' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="inline-flex items-center gap-2"><Lucide.MapPinned size={16} /> Vùng phủ ({coverageCount})</span>
            </button>
          </div>
        </div>

        {activeTab === 'details' ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/65 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><Lucide.Building2 size={14} /> Đơn vị cung cấp</div>
              <div className="mt-2 font-semibold text-slate-900">{provider}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/65 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><Lucide.Hash size={14} /> Mã điều phối viên</div>
              <div className="mt-2 font-semibold text-slate-900">#{coordinatorId}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/65 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><Lucide.Phone size={14} /> Số điện thoại</div>
              <div className="mt-2 font-semibold text-slate-900">{item.phoneNumber || item.phone || '—'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/65 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"><Lucide.Mail size={14} /> Email</div>
              <div className="mt-2 break-all font-semibold text-slate-900">{item.email || '—'}</div>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            {loadingCoverages ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : errorCoverages ? (
              <div className="space-y-4">
                <ErrorAlert title="Lỗi tải vùng phủ" message={errorCoverages} />
                <Button onClick={loadCoverages} variant="primary" size="sm"><Lucide.RefreshCw size={16} /> Thử lại</Button>
              </div>
            ) : coverages.length === 0 ? (
              <EmptyState title="Chưa có vùng phủ" description="Điều phối viên này chưa được gán khu vực hoặc danh mục phụ trách." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Khu vực</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Danh mục</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Ưu tiên chính</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Thứ tự</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {coverages.map((coverage) => (
                        <tr key={coverage.coverageId || coverage.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-4 font-medium text-slate-800">{coverage.areaName ?? coverage.area?.name ?? coverage.area?.areaName ?? `Khu vực #${coverage.areaId ?? coverage.area?.areaId ?? '—'}`}</td>
                          <td className="px-4 py-4 text-slate-600">{coverage.categoryName ?? coverage.category?.name ?? coverage.category?.categoryName ?? `Danh mục #${coverage.categoryId ?? coverage.category?.categoryId ?? '—'}`}</td>
                          <td className="px-4 py-4 text-center">{coverage.isPrimary ? <Lucide.CheckCircle2 size={17} className="mx-auto text-emerald-600" /> : <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-4 text-center font-medium text-slate-700">{coverage.priorityOrder ?? coverage.priority ?? '—'}</td>
                          <td className="px-4 py-4 text-right">
                            <Badge intent={coverage.isActive === false ? 'neutral' : 'success'} className="px-2.5 py-1 text-[11px] font-semibold">
                              {coverage.isActive === false ? 'Ngừng hoạt động' : 'Đang hoạt động'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
