// src/services/api/assignmentApi.js
import { apiClient } from './apiClient';
import { mockDb } from '../../store/mockStore';

export const assignmentApi = {
  getOperators() {
    return apiClient.request(() => {
      return mockDb.getOperators();
    });
  },

  assignTicket(feedbackId, operatorId, staffUserId, note = '') {
    return apiClient.request(() => {
      const tickets = mockDb.getTickets();
      const ticket = tickets.find(t => t.feedbackId === feedbackId);
      if (!ticket) throw new Error('Không tìm thấy phản ánh.');

      const oldStatus = ticket.status;
      const operators = mockDb.getOperators();
      const operator = operators.find(o => o.operatorId === Number(operatorId));
      if (!operator) throw new Error('Đơn vị xử lý không hợp lệ.');

      // Fetch SLA configuration for due date calculation
      const slaConfig = mockDb.getSlaConfig();
      const hours = slaConfig[ticket.priority]?.hours || 24;
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + hours);

      ticket.status = 'Assigned';
      ticket.dueDate = dueDate.toISOString();
      ticket.updatedAt = new Date().toISOString();
      ticket.assignment = {
        operatorId: Number(operatorId),
        operatorName: operator.operatorName,
        assignedBy: staffUserId,
        assignedAt: new Date().toISOString(),
        status: 'Assigned',
        note
      };

      mockDb.updateTickets(tickets);
      mockDb.addAudit(staffUserId, 'Assign Ticket to Operator', 'Feedback', feedbackId, { oldStatus }, { operatorId, dueDate });

      // Save status history
      const history = mockDb.get('urbanmind_history') || [];
      history.unshift({
        historyId: history.length + 1,
        feedbackId,
        changedByUserId: staffUserId,
        oldStatus,
        newStatus: 'Assigned',
        note: `Phân công nhiệm vụ cho đơn vị: ${operator.operatorName}. Hạn chót: ${dueDate.toLocaleString()}`,
        changedAt: new Date().toISOString()
      });
      mockDb.set('urbanmind_history', history);

      // Notify operator user
      const opUser = mockDb.getUsers().find(u => u.operatorId === Number(operatorId));
      if (opUser) {
        const notifs = mockDb.getNotifications();
        notifs.unshift({
          notificationId: notifs.length + 1,
          userId: opUser.userId,
          title: 'Yêu cầu xử lý sự cố mới',
          message: `Công việc "${ticket.title}" vừa được phân công cho đơn vị của bạn. Hạn chót: ${dueDate.toLocaleString()}`,
          type: 'Assignment',
          isRead: false,
          targetUrl: `/provider/tickets/${feedbackId}`,
          createdAt: new Date().toISOString()
        });
        mockDb.updateNotifications(notifs);
      }

      return ticket;
    });
  }
};
