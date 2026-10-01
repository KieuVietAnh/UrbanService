import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { postCommunityIncidentComment } from '../../services/api/feedApi';

export default function CommentForm({ incidentId, onPosted }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!user) {
      const redirect = `${location.pathname}${location.search}${location.hash}`;
      const params = new URLSearchParams({
        redirect,
        intent: 'community-interaction',
      });
      navigate(`/login?${params.toString()}`);
      return;
    }

    const content = text.trim();
    if (!content) {
      setError('Vui lòng nhập nội dung.');
      return;
    }
    if (!incidentId) {
      setError('Không xác định được sự vụ để bình luận.');
      return;
    }

    setLoading(true);
    try {
      const createdComment = await postCommunityIncidentComment(incidentId, content);
      setText('');
      onPosted?.(createdComment);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.message || 'Không thể gửi bình luận.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t p-4">
      {error ? <div className="mb-2 text-sm text-red-600">{error}</div> : null}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Viết bình luận..."
          className="input input-bordered flex-1"
        />
        <button type="submit" disabled={loading || !text.trim()} className="btn btn-primary">
          {loading ? 'Đang gửi…' : 'Gửi'}
        </button>
      </div>
    </form>
  );
}
