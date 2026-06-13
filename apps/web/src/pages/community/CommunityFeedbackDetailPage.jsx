import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ticketApi } from '../../services/api/ticketApi';
import { useAuth } from '../../contexts/AuthContext';
import * as Lucide from 'lucide-react';

const normalizeDetail = (response) => {
  return response?.data || response?.item || response?.result || response;
};

const normalizeComments = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.comments)) return response.comments;
  if (Array.isArray(response?.publicComments)) return response.publicComments;
  return [];
};

const getCommentAuthorName = (comment) => {
  return (
    comment?.userName ||
    comment?.authorName ||
    comment?.createdByName ||
    comment?.fullName ||
    'Người dân'
  );
};

const getCommentContent = (comment) => {
  return comment?.content || comment?.message || comment?.text || '';
};

const getAttachmentUrl = (file) => {
  if (!file) return '';

  const raw =
    typeof file === 'string'
      ? file
      : file.fileUrl || file.url || file.path || file.attachmentUrl || '';

  if (!raw) return '';

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }

  return raw.startsWith('/') ? raw : `/${raw}`;
};
const isVideoFile = (fileUrl = '') => {
  const url = fileUrl.toLowerCase();

  return (
    url.includes('.mp4') ||
    url.includes('.webm') ||
    url.includes('.ogg') ||
    url.includes('.mov') ||
    url.includes('.m4v')
  );
};
export const CommunityFeedbackDetailPage = () => {
  const { id: feedbackId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [error, setError] = useState('');

  const [isSupported, setIsSupported] = useState(false);
  const [supportCount, setSupportCount] = useState(0);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError('');

      const detailResponse = await ticketApi.getTicketById(feedbackId);
      const detail = normalizeDetail(detailResponse);

      setTicket(detail);

      setIsSupported(
        Boolean(
          detail?.isSupported ||
          detail?.isSupportedByCurrentUser ||
          detail?.supportedByCurrentUser
        )
      );

      setSupportCount(detail?.supportCount || detail?.supportsCount || 0);

      const commentsFromDetail = normalizeComments(detail);

      if (commentsFromDetail.length > 0) {
        setComments(commentsFromDetail);
      } else {
        try {
          const commentsResponse = await ticketApi.getComments(feedbackId);
          setComments(normalizeComments(commentsResponse));
        } catch (commentErr) {
          console.warn('Không lấy được bình luận công khai:', commentErr);
          setComments([]);
        }
      }
    } catch (err) {
      console.error('Không lấy được chi tiết phản ánh cộng đồng:', err);
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể tải chi tiết phản ánh.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (feedbackId) {
      fetchDetail();
    }
  }, [feedbackId]);

  const handleSupportToggle = async () => {
    if (supportLoading) return;

    const nextSupported = !isSupported;

    try {
      setSupportLoading(true);

      if (nextSupported) {
        await ticketApi.supportTicket(feedbackId);
      } else {
        await ticketApi.unsupportTicket(feedbackId);
      }

      setIsSupported(nextSupported);
      setSupportCount((prev) => Math.max(0, prev + (nextSupported ? 1 : -1)));
    } catch (err) {
      console.error('Không thể cập nhật hỗ trợ:', err);
      alert(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể cập nhật hỗ trợ.'
      );
    } finally {
      setSupportLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();

    const content = commentInput.trim();
    if (!content || commentLoading) return;

    try {
      setCommentLoading(true);

      const userId = user?.userId || user?.id;
      const userName =
        user?.fullName ||
        user?.name ||
        user?.userName ||
        user?.email ||
        'Người dân';
      const userRole = user?.role || 'service-user';

      const response = await ticketApi.addComment(
        feedbackId,
        userId,
        userName,
        userRole,
        content
      );

      const createdComment = normalizeDetail(response);

      setComments((prev) => [
        ...prev,
        {
          commentId: createdComment?.commentId || createdComment?.id || Date.now(),
          userId,
          userName,
          userRole,
          content,
          createdAt: createdComment?.createdAt || new Date().toISOString(),
          ...createdComment,
        },
      ]);

      setCommentInput('');
    } catch (err) {
      console.error('Không gửi được bình luận:', err);
      alert(
        err?.response?.data?.message ||
        err?.message ||
        'Không thể gửi bình luận.'
      );
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 bg-white rounded-3xl border border-slate-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
        <p className="font-bold text-sm text-slate-700">
          {error || 'Không tìm thấy phản ánh.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/community/feed')}
          className="btn btn-sm btn-primary rounded-xl mt-4"
        >
          Quay lại bảng tin
        </button>
      </div>
    );
  }

  const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];

  return (
    <div className="space-y-6 text-slate-800">
      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
        <span
          className="cursor-pointer hover:text-slate-600"
          onClick={() => navigate('/community/feed')}
        >
          Bảng tin
        </span>
        <Lucide.ChevronRight size={12} />
        <span className="text-primary">Chi tiết phản ánh cộng đồng</span>
      </div>

      <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">
                {ticket.feedbackId}
              </span>

              <span className="badge bg-blue-50 text-blue-600 border border-blue-200 badge-sm font-black rounded-lg">
                {ticket.categoryName || 'Chưa có danh mục'}
              </span>

              <span className="badge bg-slate-100 text-slate-600 border border-slate-200 badge-sm font-black rounded-lg">
                {ticket.status || 'Không xác định'}
              </span>
            </div>

            <h1 className="text-xl font-black text-slate-900 leading-tight">
              {ticket.title}
            </h1>

            <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
              <Lucide.MapPin size={13} className="text-primary" />
              {ticket.locationText || 'Không có thông tin vị trí'}
            </p>

            <p className="text-[11px] text-slate-400 font-semibold">
              Đăng lúc:{' '}
              {ticket.createdAt
                ? new Date(ticket.createdAt).toLocaleString()
                : 'Không có thông tin'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSupportToggle}
            disabled={supportLoading}
            className={`btn btn-sm rounded-xl font-bold ${isSupported ? 'btn-primary' : 'btn-outline'
              }`}
          >
            {supportLoading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <Lucide.Heart
                size={15}
                fill={isSupported ? 'currentColor' : 'none'}
              />
            )}
            Hỗ trợ ({supportCount})
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-sm text-slate-900">
            Nội dung phản ánh
          </h3>
          <p className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            {ticket.description || 'Không có mô tả.'}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="font-extrabold text-sm text-slate-900">
            Hình ảnh / video đính kèm
          </h3>

          {attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attachments.map((file, index) => {
                const fileUrl = getAttachmentUrl(file);
                const isVideo = isVideoFile(fileUrl);

                return (
                  <div
                    key={index}
                    className="rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-50 shadow-sm"
                  >
                    {isVideo ? (
                      <video
                        src={fileUrl}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={fileUrl}
                          alt={`Attachment ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500 text-xs font-semibold text-center">
              Không có tệp đính kèm.
            </div>
          )}
        </div>
      </div>

      <div className="card bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-base text-slate-900">
              Bình luận cộng đồng
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              Người dân có thể trao đổi công khai giống phần bình luận bài đăng.
            </p>
          </div>

          <span className="badge badge-outline font-bold">
            {comments.length} bình luận
          </span>
        </div>

        <form onSubmit={handleSubmitComment} className="flex gap-3">
          <input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="Viết bình luận công khai..."
            className="input input-bordered flex-1 rounded-2xl text-sm"
          />

          <button
            type="submit"
            disabled={commentLoading || !commentInput.trim()}
            className="btn btn-primary rounded-2xl font-bold"
          >
            {commentLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <>
                <Lucide.Send size={15} />
                Gửi
              </>
            )}
          </button>
        </form>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="text-center text-slate-400 text-xs font-semibold py-8 bg-slate-50 border border-slate-100 rounded-2xl">
              Chưa có bình luận nào. Hãy là người đầu tiên bình luận.
            </div>
          ) : (
            comments.filter(Boolean).map((comment, index) => (
              <div
                key={comment.commentId || comment.id || index}
                className="flex gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-black text-xs shrink-0">
                  {getCommentAuthorName(comment).charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-800">
                      {getCommentAuthorName(comment)}
                    </span>

                    <span className="text-[10px] text-slate-400 font-bold">
                      {comment.createdAt
                        ? new Date(comment.createdAt).toLocaleString()
                        : 'Vừa xong'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 font-medium leading-relaxed break-words">
                    {getCommentContent(comment)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};