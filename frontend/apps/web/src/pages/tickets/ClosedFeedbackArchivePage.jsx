import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ticketApi } from '../../services/api/ticketApi';
import { toolsApi } from '@urbanmind/shared-api';
import { getStatusLabel, managementTypes } from '@urbanmind/shared-types';
import PageTransition from '../../components/motion/PageTransition';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';

const normalizeList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.result)) return value.result;
  return [];
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const getSatisfactionText = (score) => {
  if (score === null || score === undefined || score === '') return 'Chưa chấm';
  if (score >= 4) return 'Rất hài lòng';
  if (score >= 3) return 'Hài lòng';
  if (score >= 2) return 'Trung bình';
  return 'Cần cải thiện';
};

const getSatisfactionTone = (score) => {
  if (score === null || score === undefined || score === '') return 'bg-slate-100 text-slate-600';
  if (score >= 4) return 'bg-emerald-100 text-emerald-700';
  if (score >= 3) return 'bg-sky-100 text-sky-700';
  if (score >= 2) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

export const ClosedFeedbackArchivePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      if (!user?.userId) {
        setTickets([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const [ticketResponse, categoryResponse] = await Promise.all([
          ticketApi.getTickets({ userId: user.userId }, { role: 'service-user' }),
          toolsApi.getCategories(),
        ]);

        const archivedTickets = normalizeList(ticketResponse).filter((ticket) => {
          const status = ticket?.status;
          return status === managementTypes.feedbackStatus.RESOLVED || status === managementTypes.feedbackStatus.CLOSED;
        });

        setTickets(archivedTickets);
        setCategories(normalizeList(categoryResponse));
      } catch (err) {
        console.error('Failed to load archive data', err);
        setError(err?.message || 'Không thể tải kho lưu trữ phản ánh đã đóng.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.userId]);

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.categoryId] = category.categoryName;
      return acc;
    }, {});
  }, [categories]);

  const filteredTickets = useMemo(() => {
    const now = new Date();

    return tickets.filter((ticket) => {
      const categoryMatch = categoryFilter === 'all' || String(ticket.categoryId) === String(categoryFilter);
      const dateValue = ticket.resolutionDate || ticket.updatedAt || ticket.createdAt;
      let dateMatch = true;

      if (dateFilter === '30') {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
        dateMatch = new Date(dateValue) >= cutoff;
      } else if (dateFilter === '90') {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 90);
        dateMatch = new Date(dateValue) >= cutoff;
      } else if (dateFilter === '365') {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 365);
        dateMatch = new Date(dateValue) >= cutoff;
      }

      const satisfactionScore = ticket?.reviews?.[0]?.rating ?? ticket?.rating ?? ticket?.satisfactionScore ?? ticket?.reviewRating ?? null;
      let ratingMatch = true;
      if (ratingFilter === '5') ratingMatch = Number(satisfactionScore) >= 5;
      else if (ratingFilter === '4') ratingMatch = Number(satisfactionScore) >= 4 && Number(satisfactionScore) < 5;
      else if (ratingFilter === '3') ratingMatch = Number(satisfactionScore) >= 3 && Number(satisfactionScore) < 4;
      else if (ratingFilter === '2') ratingMatch = Number(satisfactionScore) >= 2 && Number(satisfactionScore) < 3;
      else if (ratingFilter === '1') ratingMatch = Number(satisfactionScore) >= 1 && Number(satisfactionScore) < 2;
      else if (ratingFilter === 'unrated') ratingMatch = satisfactionScore === null || satisfactionScore === undefined || satisfactionScore === '';

      return categoryMatch && dateMatch && ratingMatch;
    });
  }, [categoryFilter, dateFilter, ratingFilter, tickets]);

  return (
    <PageTransition>
      <div className="space-y-5 text-slate-800">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.75)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] backdrop-blur">
                <Lucide.Archive size={14} />
                Closed Feedback Archive
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Kho lưu trữ các phản ánh đã hoàn tất</h1>
                <p className="mt-2 text-sm leading-7 text-slate-300 sm:text-base">
                  Duyệt lại các hồ sơ đã được xử lý, theo dõi trạng thái cuối cùng và xem mức độ hài lòng sau khi hoàn tất.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/tickets')} className="btn btn-sm rounded-full border-white/20 bg-white/15 text-white hover:bg-white/25">
              <Lucide.ArrowLeft size={14} />
              Quay lại danh sách
            </button>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span>Danh mục</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="select select-bordered rounded-[1rem] border-slate-200 bg-slate-50 text-sm">
                <option value="all">Tất cả danh mục</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span>Thời gian</span>
              <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="select select-bordered rounded-[1rem] border-slate-200 bg-slate-50 text-sm">
                <option value="all">Tất cả thời gian</option>
                <option value="30">30 ngày gần đây</option>
                <option value="90">90 ngày gần đây</option>
                <option value="365">1 năm gần đây</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span>Đánh giá</span>
              <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} className="select select-bordered rounded-[1rem] border-slate-200 bg-slate-50 text-sm">
                <option value="all">Tất cả mức độ</option>
                <option value="5">5 sao</option>
                <option value="4">4 sao</option>
                <option value="3">3 sao</option>
                <option value="2">2 sao</option>
                <option value="1">1 sao</option>
                <option value="unrated">Chưa chấm</option>
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Đang tải kho lưu trữ...
          </div>
        ) : error ? (
          <ErrorAlert message={error} />
        ) : filteredTickets.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Chưa có phản ánh nào đã đóng phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredTickets.map((ticket) => {
              const statusLabel = getStatusLabel(ticket.status, 'Đã đóng');
              const resolutionDate = ticket.resolutionDate || ticket.updatedAt || ticket.createdAt;
              const satisfactionScore = ticket?.reviews?.[0]?.rating ?? ticket?.rating ?? ticket?.satisfactionScore ?? ticket?.reviewRating ?? null;
              const categoryName = categoryMap[ticket.categoryId] || 'Không rõ';

              return (
                <article key={ticket.feedbackId || ticket.id} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Case archive</div>
                      <h2 className="mt-1 text-lg font-black text-slate-900">{ticket.title || 'Phản ánh đã hoàn tất'}</h2>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${satisfactionScore !== null ? getSatisfactionTone(Number(satisfactionScore)) : 'bg-slate-100 text-slate-600'}`}>
                      {satisfactionScore !== null ? `${satisfactionScore}/5` : 'Chưa chấm'}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-slate-600">{ticket.description || 'Không có mô tả chi tiết.'}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Trạng thái xử lý</div>
                      <div className="mt-2 font-semibold text-slate-700">{statusLabel}</div>
                    </div>
                    <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ngày xử lý</div>
                      <div className="mt-2 font-semibold text-slate-700">{formatDate(resolutionDate)}</div>
                    </div>
                    <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Danh mục</div>
                      <div className="mt-2 font-semibold text-slate-700">{categoryName}</div>
                    </div>
                    <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mức độ hài lòng</div>
                      <div className="mt-2 font-semibold text-slate-700">{satisfactionScore !== null ? `${satisfactionScore}/5 · ${getSatisfactionText(Number(satisfactionScore))}` : 'Chưa có đánh giá'}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-500">#{ticket.feedbackId || ticket.id}</div>
                    <button type="button" onClick={() => navigate(`/tickets/${ticket.feedbackId || ticket.id}`)} className="btn btn-sm rounded-full border-slate-200 bg-slate-900 text-white hover:bg-slate-700">
                      <Lucide.ExternalLink size={14} />
                      Xem chi tiết
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default ClosedFeedbackArchivePage;
