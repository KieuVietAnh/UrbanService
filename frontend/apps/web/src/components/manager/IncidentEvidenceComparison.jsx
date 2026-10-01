import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';
import { ManagerSectionHeader } from './ManagerPageElements';

const EmptySide = ({ message }) => (
  <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center dark:border-slate-800 dark:bg-slate-900/60">
    <div>
      <Lucide.ImageOff size={24} className="mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
      <p className="mt-2.5 text-xs leading-5 text-slate-400">{message}</p>
    </div>
  </div>
);

const EvidenceThumb = ({ item, single, onOpen }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:border-slate-800 dark:bg-slate-900"
    >
      {!loaded && !failed ? <span className="absolute inset-0 animate-pulse bg-slate-100 dark:bg-slate-900" aria-hidden="true" /> : null}

      {failed ? (
        /*
         * Ảnh hỏng vẫn phải chiếm chỗ và nói rõ là hỏng, nếu không người duyệt
         * sẽ tưởng hiện trường tối đen chứ không biết là tệp không tải được.
         */
        <span className={`flex w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 dark:bg-slate-900 ${single ? 'h-[clamp(240px,30vw,360px)]' : 'h-56'}`}>
          <Lucide.ImageOff size={22} aria-hidden="true" />
          <span className="px-3 text-center text-[11px] leading-4">Không tải được ảnh</span>
        </span>
      ) : (
        <img
          src={item.url}
          alt={item.title || 'Ảnh minh chứng'}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(true); setFailed(true); }}
          className={`w-full object-cover transition duration-300 group-hover:scale-[1.01] ${single ? 'h-[clamp(240px,30vw,360px)]' : 'h-56'} ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      <span className="absolute inset-x-2 bottom-2 rounded-xl bg-slate-950/72 px-2.5 py-2 text-[11px] font-semibold text-white backdrop-blur-sm">
        <span className="block truncate">{item.title || 'Ảnh minh chứng'}</span>
        {item.subtitle ? <span className="mt-0.5 block truncate text-[10px] font-medium text-white/75">{item.subtitle}</span> : null}
      </span>
    </button>
  );
};

/**
 * Đối chiếu hiện trường trước và sau xử lý.
 *
 * Hai cột dùng chung một trình xem ảnh, nên bấm mũi tên là đi thẳng từ ảnh
 * người dân gửi sang ảnh hoàn thành mà không phải đóng mở lại. Số ảnh hai bên
 * thường lệch nhau nên bố cục không ghép cặp 1-1.
 */
export const IncidentEvidenceComparison = ({ beforeItems = [], afterItems = [], beforeLoading = false }) => {
  const [viewerIndex, setViewerIndex] = useState(null);

  const allItems = useMemo(() => ([
    ...beforeItems.map((item) => ({ ...item, side: 'before' })),
    ...afterItems.map((item) => ({ ...item, side: 'after' })),
  ]), [afterItems, beforeItems]);

  const openViewer = useCallback((item) => {
    const index = allItems.findIndex((candidate) => candidate.url === item.url && candidate.side === item.side);
    setViewerIndex(index >= 0 ? index : null);
  }, [allItems]);

  useEffect(() => {
    if (viewerIndex === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { setViewerIndex(null); return; }
      if (allItems.length <= 1) return;
      if (event.key === 'ArrowLeft') setViewerIndex((current) => (current - 1 + allItems.length) % allItems.length);
      if (event.key === 'ArrowRight') setViewerIndex((current) => (current + 1) % allItems.length);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allItems.length, viewerIndex]);

  useEffect(() => {
    if (viewerIndex !== null && viewerIndex >= allItems.length) {
      setViewerIndex(allItems.length > 0 ? allItems.length - 1 : null);
    }
  }, [allItems.length, viewerIndex]);

  if (allItems.length === 0 && !beforeLoading) return null;

  const activeItem = viewerIndex === null ? null : allItems[viewerIndex];

  const renderSide = (items, { label, dotClass, emptyMessage, loading = false }) => (
    <figure className="flex min-w-0 flex-col">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
          {label}
        </span>
        <span className="text-xs font-medium text-slate-400">{loading && items.length === 0 ? 'đang tải' : `${items.length} ảnh`}</span>
      </figcaption>

      {items.length > 0 ? (
        <div className={`mt-3 grid flex-1 gap-3 ${items.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {items.map((item, index) => (
            <EvidenceThumb
              key={`${item.url}-${index}`}
              item={item}
              single={items.length === 1}
              onOpen={() => openViewer(item)}
            />
          ))}
        </div>
      ) : loading ? (
        /* Chưa tải xong thì không được kết luận là không có ảnh. */
        <div className="mt-3 grid flex-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-1">
          <EmptySide message={emptyMessage} />
        </div>
      )}
    </figure>
  );

  return (
    <section className="admin-panel overflow-hidden" aria-labelledby="incident-evidence-comparison-title">
      <ManagerSectionHeader
        id="incident-evidence-comparison-title"
        title="Đối chiếu hình ảnh"
        description="So sánh hiện trường người dân gửi với hình ảnh hoàn thành sau xử lý."
        icon={Lucide.Images}
        actions={(
          <span className="text-xs font-medium text-slate-400">
            {beforeLoading && beforeItems.length === 0 ? 'đang tải' : `${beforeItems.length} trước`} · {afterItems.length} sau
          </span>
        )}
      />

      <div className="grid gap-5 p-5 md:grid-cols-2 sm:p-6">
        {renderSide(beforeItems, {
          label: 'Trước xử lý',
          dotClass: 'bg-slate-400',
          emptyMessage: 'Các phản ánh nguồn chưa gửi kèm hình ảnh hiện trường.',
          loading: beforeLoading,
        })}
        {renderSide(afterItems, {
          label: 'Sau xử lý',
          dotClass: 'bg-emerald-500',
          emptyMessage: 'Kết quả xử lý chưa có ảnh hoàn thành để đối chiếu.',
        })}
      </div>

      {activeItem && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed inset-0 z-[10030] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-md sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Đối chiếu hình ảnh trước và sau xử lý"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setViewerIndex(null); }}
          >
            <button
              type="button"
              onClick={() => setViewerIndex(null)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur hover:bg-slate-900"
              aria-label="Đóng ảnh"
            >
              <Lucide.X size={20} />
            </button>

            {allItems.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setViewerIndex((current) => (current - 1 + allItems.length) % allItems.length)}
                  className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur hover:bg-slate-900 sm:left-6"
                  aria-label="Ảnh trước"
                >
                  <Lucide.ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewerIndex((current) => (current + 1) % allItems.length)}
                  className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white backdrop-blur hover:bg-slate-900 sm:right-6"
                  aria-label="Ảnh tiếp theo"
                >
                  <Lucide.ChevronRight size={24} />
                </button>
              </>
            ) : null}

            <div className="flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${activeItem.side === 'after' ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30' : 'bg-white/15 text-white/90 ring-1 ring-white/20'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeItem.side === 'after' ? 'bg-emerald-400' : 'bg-white/70'}`} aria-hidden="true" />
                {activeItem.side === 'after' ? 'Sau xử lý' : 'Trước xử lý'}
              </span>

              <img
                src={activeItem.url}
                alt={activeItem.title || 'Ảnh minh chứng'}
                className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />

              <div className="max-w-[80vw] rounded-xl bg-slate-950/55 px-3 py-2 text-center text-xs font-medium text-white/90 backdrop-blur">
                <p className="truncate">{activeItem.title || 'Ảnh minh chứng'}</p>
                <p className="mt-0.5 text-white/60">
                  {activeItem.subtitle ? `${activeItem.subtitle} · ` : ''}{viewerIndex + 1}/{allItems.length}
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </section>
  );
};

export default IncidentEvidenceComparison;
