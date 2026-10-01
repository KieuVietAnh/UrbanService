import { useEffect, useState } from 'react';
import CommentList from './CommentList';
import CommentForm from './CommentForm';

export default function CommentDrawer({ open, onClose, incidentId }) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const comments = (
    <>
      <CommentList incidentId={incidentId} refreshKey={refreshKey} />
      <CommentForm incidentId={incidentId} onPosted={() => setRefreshKey((value) => value + 1)} />
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="hidden w-96 overflow-auto border-l bg-white p-4 shadow-xl lg:block">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Bình luận sự vụ</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Đóng</button>
        </div>
        {comments}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-h-[70vh] overflow-auto rounded-t-2xl bg-white p-3 shadow-xl lg:hidden">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">Bình luận sự vụ</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Đóng</button>
        </div>
        {comments}
      </div>

      <button type="button" className="flex-1" aria-label="Đóng bình luận" onClick={onClose} />
    </div>
  );
}
