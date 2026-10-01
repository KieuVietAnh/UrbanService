import { managementFeedbackApi } from '@urbanmind/shared-api';
import { reconcileAdminFeedbackDeletion } from '../utils/adminFeedbackMetrics.js';
import { invalidateAdminFeedbackDetail } from './cache/adminFeedbackDetailCache.js';

export const createAdminFeedbackDeleteGuard = () => {
  let running = false;

  return {
    isRunning: () => running,
    run: async (operation) => {
      if (running) return false;

      running = true;
      try {
        await operation();
        return true;
      } finally {
        running = false;
      }
    },
  };
};

export const deleteAdminFeedbackAndReconcile = async ({
  feedbackId,
  feedbacks,
  summary,
}) => {
  const normalizedFeedbackId = String(feedbackId ?? '').trim();
  if (!normalizedFeedbackId) {
    throw new Error('Thiếu feedbackId để xóa phản ánh.');
  }

  await managementFeedbackApi.deleteFeedback(normalizedFeedbackId);
  invalidateAdminFeedbackDetail(normalizedFeedbackId);

  return reconcileAdminFeedbackDeletion(
    feedbacks,
    summary,
    normalizedFeedbackId
  );
};
