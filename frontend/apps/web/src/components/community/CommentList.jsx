import { useEffect, useState } from 'react';
import { getCommunityIncidentComments } from '../../services/api/feedApi';

export default function CommentList({ incidentId, refreshKey = 0 }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      if (!incidentId) {
        setComments([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const page = await getCommunityIncidentComments(incidentId, {
          pageNumber: 1,
          pageSize: 50,
          signal: controller.signal,
        });
        if (active) setComments(Array.isArray(page?.items) ? page.items : []);
      } catch (loadError) {
        if (!controller.signal.aborted) console.error(loadError);
        if (active) setComments([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [incidentId, refreshKey]);

  if (loading) return <div className="p-4">Đang tải bình luận…</div>;
  if (comments.length === 0) {
    return <div className="p-4 text-sm text-slate-500">Chưa có bình luận. Hãy là người đầu tiên bình luận.</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {comments.map((comment, index) => (
        <div key={comment.commentId || comment.id || `${comment.createdAt}-${index}`} className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">
            {(comment.userName || comment.authorName || 'U').charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{comment.userName || comment.authorName || 'Người dùng'}</div>
            <div className="text-xs text-slate-400">
              {comment.createdAt ? new Date(comment.createdAt).toLocaleString('vi-VN') : ''}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.content ?? comment.message ?? ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
