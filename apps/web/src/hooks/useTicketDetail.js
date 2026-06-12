import { useState, useEffect, useRef, useCallback } from 'react';
import { ticketApi } from '../services/api/ticketApi';
import { signalrService } from '../services/socket/signalrService';

export function useTicketDetail(feedbackId, user) {
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(5);
  const [satisfied, setSatisfied] = useState(true);
  const [reviewComment, setReviewComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  const chatEndRef = useRef(null);

  const fetchDetails = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const resTicket = await ticketApi.getTicketById(feedbackId);
      const ticketData = resTicket;
      if (!ticketData) throw new Error('Empty ticket data received');
      setTicket(ticketData);
      setComments(Array.isArray(ticketData.comments) ? ticketData.comments.filter(Boolean) : []);
      setHistory(Array.isArray(ticketData.statusHistories) ? ticketData.statusHistories.filter(Boolean) : []);
    } catch (err) {
      console.error('Failed to load ticket details', err);
      setError('Unable to load feedback details.');
      setTicket(null);
      setComments([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [feedbackId]);

  useEffect(() => {
    const load = async () => await fetchDetails();
    load();

    signalrService.start();
    const handleReceiveMessage = (incomingFeedbackId, comment) => {
      if (incomingFeedbackId === feedbackId) setComments((prev) => [...prev, comment]);
    };
    signalrService.on('ReceiveChatMessage', handleReceiveMessage);

    return () => {
      signalrService.off('ReceiveChatMessage', handleReceiveMessage);
      signalrService.stop();
    };
  }, [fetchDetails, feedbackId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendChat = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!chatInput || !chatInput.trim()) return;
    const text = chatInput;
    setChatInput('');
    await signalrService.sendChatMessage(feedbackId, user, text);
    const resHist = await ticketApi.getHistory(feedbackId);
    setHistory(Array.isArray(resHist) ? resHist : []);
  };

  const handleRateSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setRatingLoading(true);
    try {
      await ticketApi.submitReview(feedbackId, user.userId, rating, satisfied, reviewComment);
      await fetchDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setRatingLoading(false);
    }
  };

  const getAttachmentUrl = (file) => {
    try {
      if (!file) return '';
      if (typeof file === 'string') return file;
      if (typeof file === 'object') {
        if (file.url) return file.url;
        if (file.path) return file.path;
        if (file.fileUrl) return file.fileUrl;
        if (file.link) return file.link;
        if (file.attributes && (file.attributes.url || file.attributes.path)) {
          return file.attributes.url || file.attributes.path;
        }
        const id = file.id || file.attachmentId || file.fileId || file.uuid;
        if (id) return `/api/attachments/${id}`;
        return String(file);
      }
    } catch (e) {
      console.warn('getAttachmentUrl error', e, file);
    }
    return String(file);
  };

  return {
    ticket,
    comments,
    history,
    chatInput,
    setChatInput,
    loading,
    error,
    chatEndRef,
    handleSendChat,
    handleRateSubmit,
    rating,
    setRating,
    satisfied,
    setSatisfied,
    reviewComment,
    setReviewComment,
    ratingLoading,
    getAttachmentUrl,
  };
}

export default useTicketDetail;
