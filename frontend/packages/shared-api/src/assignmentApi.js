import { axiosClient } from './axiosClient.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATOR_ROLE_NAMES = ['ServiceProvider', 'ServiceOperator'];

const getFeedbackId = (feedbackOrId) => {
  if (typeof feedbackOrId === 'string') return feedbackOrId;
  return feedbackOrId?.feedbackId || feedbackOrId?.id || feedbackOrId?.ticketId || '';
};

const normalizeOperator = (operator) => {
  const operatorName = operator.operatorName || operator.fullName || operator.userName || operator.email || '';
  const operatorId = Number.isInteger(Number(operator.operatorId))
    ? Number(operator.operatorId)
    : Number.isInteger(Number(operator.operatorId ?? operator.userId))
      ? Number(operator.operatorId ?? operator.userId)
      : operator.operatorId;

  return {
    ...operator,
    operatorId,
    operatorName,
  };
};

export const assignmentApi = {
  async getOperators(categoryId) {
    const params = {
      PageNumber: 1,
      PageSize: 100,
      IsActive: true,
    };

    const shouldSkipOperatorLookup = typeof window !== 'undefined' && window.location?.pathname?.includes('/staff/feedbacks');
    if (shouldSkipOperatorLookup) {
      return [];
    }

    const operators = [];
    let permissionError = null;

    for (const roleName of OPERATOR_ROLE_NAMES) {
      try {
        const response = await axiosClient.get('/api/admin/users', {
          params: { ...params, RoleName: roleName },
        });

        if (response?.items && Array.isArray(response.items)) {
          operators.push(...response.items);
        } else if (Array.isArray(response)) {
          operators.push(...response);
        }
      } catch (error) {
        // Capture 403 errors separately to show permission issue
        if (error.response?.status === 403) {
          permissionError = error;
          console.error(
            `⚠️ Permission denied: Your role does not have access to the operator list. ` +
            `Admin role is required to fetch operators from /api/admin/users.`,
            error
          );
        } else {
          console.warn(`Failed loading operators for role ${roleName}.`, error);
        }
      }
    }

    // If we got no operators AND encountered a permission error, don't silently fall back to mock
    if (operators.length === 0 && permissionError) {
      console.error(
        '❌ Cannot load operators: Permission denied (403). ' +
        'Ask your administrator to either:\n' +
        '  1. Grant you Admin role temporarily, or\n' +
        '  2. Use a staff account with Admin permissions for operator assignment'
      );
      // Return empty array instead of mock data to prevent bad assignments
      return [];
    }

    const normalizedOperators = operators.map(normalizeOperator);

    if (categoryId != null && categoryId !== '' && normalizedOperators.some((op) => op.categoryId !== undefined)) {
      return normalizedOperators.filter((op) => Number(op.categoryId) === Number(categoryId));
    }

    return normalizedOperators;
  },

  async assignTicket(feedbackOrId, operatorId, staffUserId, note = '') {
    const source = typeof feedbackOrId === 'object' && feedbackOrId !== null ? feedbackOrId : {};
    const feedbackId = getFeedbackId(feedbackOrId);
    const payload = {
      feedbackId,
      operatorId: Number(source.operatorId ?? operatorId),
      staffUserId: source.staffUserId ?? staffUserId,
      note: source.note ?? note,
    };

    if (!payload.feedbackId) {
      throw new Error('Không thể phân công vì thiếu mã phản ánh.');
    }

    if (!UUID_PATTERN.test(payload.feedbackId)) {
      throw new Error('Mã phản ánh không hợp lệ. Vui lòng tải lại danh sách và thử lại.');
    }

    if (!Number.isInteger(payload.operatorId) || payload.operatorId <= 0) {
      throw new Error(
        '❌ OperatorId không hợp lệ hoặc không tồn tại. ' +
        'Vui lòng kiểm tra quyền Admin hoặc chọn operator từ danh sách hợp lệ.'
      );
    }

    if (!payload.staffUserId) {
      throw new Error('Không thể phân công vì thiếu thông tin nhân viên.');
    }

    console.debug('Assign feedback payload', payload);
    try {
      return await axiosClient.post('/api/management/feedbacks/assign', payload);
    } catch (error) {
      if (error.response?.status === 400) {
        console.error(
          '❌ Assignment failed (400 Bad Request). Possible causes:\n' +
          `  - OperatorId ${payload.operatorId} does not exist on backend\n` +
          `  - Operator is inactive\n` +
          `  - Feedback is in invalid status for assignment\n` +
          'Check browser console for full error details.'
        );
      }
      throw error;
    }
  },
};
