import { useState, useMemo, useCallback } from 'react';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { EmptyState, LoadingSpinner } from '@urbanmind/shared-ui';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import Badge from '../../components/design-system/Badge';
import Button from '../../components/design-system/Button';
import * as Lucide from 'lucide-react';

export default function ProviderCandidateCheckerPage() {
  const [feedbackId, setFeedbackId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');

  const runCheck = async () => {
    if (!feedbackId) return setError('Vui lòng nhập Feedback ID');
    setLoading(true); setError(''); setCandidates([]);
    try {
      const resp = await managementFeedbackApi.getProviderCandidates(feedbackId);
      const items = Array.isArray(resp) ? resp : (resp?.items ?? resp?.data ?? resp ?? []);
      setCandidates(items);
    } catch (err) {
      console.error('Failed to load provider candidates', err);
      setError('Không thể tải danh sách ứng viên. Vui lòng thử lại.');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  const firstCoverage = useCallback((c) => {
    if (!c) return null;
    if (Array.isArray(c.coverages) && c.coverages.length) return c.coverages[0];
    if (Array.isArray(c.coverage) && c.coverage.length) return c.coverage[0];
    if (Array.isArray(c.coverageList) && c.coverageList.length) return c.coverageList[0];
    if (c.coverage && typeof c.coverage === 'object') return c.coverage;
    return null;
  }, []);


  const isPrimaryFlag = useCallback((c) => {
    const cov = firstCoverage(c);
    return Boolean(c?.isPrimary ?? c?.primary ?? c?.is_primary ?? c?.primaryFlag ?? cov?.isPrimary ?? cov?.is_primary ?? false);
  }, [firstCoverage]);

  const isActiveFlag = useCallback((c) => {
    const cov = firstCoverage(c);
    return Boolean(c?.isActive ?? c?.active ?? c?.is_active ?? cov?.isActive ?? cov?.is_active ?? false);
  }, [firstCoverage]);

  const filtered = useMemo(() => {
    if (!search) return candidates;
    const q = String(search).toLowerCase();
    return candidates.filter((c) => {
      return [c.coordinatorId, c.providerName, c.coordinatorName, c.phoneNumber, c.email]
        .some((v) => v !== undefined && String(v).toLowerCase().includes(q));
    });
  }, [candidates, search]);

  const summary = useMemo(() => {
    const total = candidates.length;
    const primary = candidates.filter((c) => isPrimaryFlag(c)).length;
    const active = candidates.filter((c) => isActiveFlag(c)).length;
    return { total, primary, active };
  }, [candidates, isPrimaryFlag, isActiveFlag]);

  return (
    <div className="space-y-6 p-4">
      <div className="admin-page-hero">
        <div className="flex items-center justify-between">
          <div>
            <Badge intent="info" className="gap-2 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em]">
              <Lucide.Search size={14} />
              Kiểm tra ứng viên nhà cung cấp
            </Badge>
            <h1 className="admin-hero-title mt-3">Kiểm tra ứng viên nhà cung cấp</h1>
            <p className="admin-hero-description mt-2">Kiểm tra các điều phối viên ứng viên cho một phản ánh dựa trên coverage.</p>
          </div>
          <div className="text-sm text-slate-600">Tổng: <span className="font-black">{summary.total}</span></div>
        </div>
      </div>

      <div className="admin-panel p-4 sm:p-5">
        <div className="flex gap-2 items-center">
            <label className="input input-bordered flex items-center gap-2 rounded-[1rem] border-slate-200/80 bg-[rgba(248,250,252,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <Lucide.Hash size={16} className="text-slate-400" />
            <input value={feedbackId} onChange={(e) => setFeedbackId(e.target.value)} placeholder="ID phản ánh" className="grow bg-transparent text-sm" />
          </label>
          <Button onClick={runCheck} variant="primary">{loading ? <LoadingSpinner /> : 'Kiểm tra ứng viên'}</Button>
          <label className="input input-bordered flex items-center gap-2 rounded-[1rem] border-slate-200/80 bg-[rgba(248,250,252,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] ml-auto">
            <Lucide.Search size={16} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm trong kết quả" className="grow bg-transparent text-sm" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="admin-inset-panel p-3">
            <div className="text-xs text-slate-500">Tổng ứng viên</div>
            <div className="font-black text-xl">{summary.total}</div>
          </div>
          <div className="admin-inset-panel p-3">
            <div className="text-xs text-slate-500">Ứng viên chính</div>
            <div className="font-black text-xl text-blue-600">{summary.primary}</div>
          </div>
          <div className="admin-inset-panel p-3">
            <div className="text-xs text-slate-500">Ứng viên hoạt động</div>
            <div className="font-black text-xl text-green-600">{summary.active}</div>
          </div>
        </div>

        <div className="mt-4">
          {error && (
            <div className="mb-3">
              <ErrorAlert title="Lỗi" message={error} />
            </div>
          )}

          {loading && candidates.length === 0 ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : (!loading && candidates.length === 0) ? (
            <EmptyState title="Chưa có ứng viên" description="Chưa có kết quả cho Feedback ID này." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full text-sm">
                <thead>
                  <tr>
                    <th>ID Điều phối viên</th>
                    <th>Nhà cung cấp</th>
                    <th>Điều phối viên</th>
                    <th>Điện thoại</th>
                    <th>Email</th>
                    <th>Chính</th>
                    <th>Ưu tiên</th>
                    <th>Hoạt động</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.coordinatorId || c.id}>
                      <td className="font-semibold">{c.coordinatorId || c.id || '—'}</td>
                      <td>{c.providerName || c.provider?.name || '—'}</td>
                      <td>{c.coordinatorName || c.name || c.fullName || '—'}</td>
                      <td>{c.phoneNumber || c.phone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      
                      <td>{isPrimaryFlag(c) ? <Badge intent="info" className="px-3 py-1 text-xs font-semibold">Chính</Badge> : ''}</td>
                      <td>{c.priorityOrder ?? c.priority ?? '—'}</td>
                      <td>{isActiveFlag(c) ? <Badge intent="success" className="px-3 py-1 text-xs font-semibold">Hoạt động</Badge> : <Badge intent="neutral" className="px-3 py-1 text-xs font-semibold">Không hoạt động</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
