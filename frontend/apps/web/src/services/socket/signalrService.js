// src/services/socket/signalrService.js
import { ticketApi } from '../api/ticketApi';
import { managementTypes } from '@urbanmind/shared-types';

class MockSignalRService {
  constructor() {
    this.listeners = {};
    this.isConnected = false;
  }

  async start() {
    if (this.isConnected) return;
    // Simulate connection lag
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.isConnected = true;
  }

  stop() {
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      delete this.listeners[event];
    }
  }

  // Trigger event internally
  emit(event, ...args) {
    if (!this.isConnected || !this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(...args));
  }

  // Client triggers message send
  async sendChatMessage(feedbackId, user, messageText) {
    if (!messageText.trim()) return;
    
    // Save to DB (explicit role)
    const newComment = await ticketApi.addComment(feedbackId, user.userId, user.fullName, user.role, messageText, { role: user.role });

    // Emit events locally so active listeners get the message
    this.emit('ReceiveChatMessage', feedbackId, newComment);
    this.emit('CommentAdded', feedbackId, newComment);
    this.emit('NotificationReceived', { type: 'comment', feedbackId, comment: newComment });

    // AI Auto Reply Simulation if Resident messages Staff in a ticket and it asks for AI
    if (user.role === 'service-user' && messageText.includes('@ai')) {
      setTimeout(async () => {
        const aiResponse = 'Tôi là Trợ lý AI giám sát: Đã ghi nhận phản hồi của bạn. Đội kỹ thuật đã được thông báo để đẩy nhanh tiến trình khắc phục sự cố.';
        const aiUser = { userId: 'ai-system', fullName: 'UrbanMind Copilot (AI)', role: 'system-staff' };
        const aiComment = await ticketApi.addComment(feedbackId, aiUser.userId, aiUser.fullName, aiUser.role, aiResponse, { role: aiUser.role });
        this.emit('ReceiveChatMessage', feedbackId, aiComment);
        this.emit('CommentAdded', feedbackId, aiComment);
        this.emit('NotificationReceived', { type: 'comment', feedbackId, comment: aiComment });
      }, 1000);
    }
  }

  // Emit a status changed notification to listeners
  notifyStatusChanged(feedbackId, oldStatus, newStatus, changedBy) {
    const payload = {
      feedbackId,
      oldStatus,
      newStatus,
      changedBy: changedBy || null,
      timestamp: new Date().toISOString(),
    };
    // Backwards-compatible event name
    this.emit('FeedbackStatusChanged', feedbackId, payload);
    this.emit('FeedbackStatusChangedNotificationReceived', feedbackId, payload);
    this.emit('NotificationReceived', { type: 'status', feedbackId, payload });

    // Emit resolution lifecycle events
    try {
      if (newStatus === managementTypes.feedbackStatus.SUBMITTED_FOR_APPROVAL) {
        this.emit('ResolutionSubmitted', feedbackId, payload);
      }
      if (newStatus === managementTypes.feedbackStatus.APPROVED) {
        this.emit('ResolutionApproved', feedbackId, payload);
      }
      if (newStatus === managementTypes.feedbackStatus.NEED_REWORK || newStatus === managementTypes.feedbackStatus.REJECTED) {
        this.emit('ResolutionRejected', feedbackId, payload);
      }
    } catch (error) {
      console.warn('SignalR status event emit failed', error);
    }
  }

  // Emit assignment update notification
  notifyAssignmentUpdated(feedbackId, operatorId, operatorName, changedBy) {
    const payload = {
      feedbackId,
      operatorId,
      operatorName,
      changedBy: changedBy || null,
      timestamp: new Date().toISOString(),
    };
    this.emit('AssignmentUpdated', feedbackId, payload);
    this.emit('AssignmentCreated', feedbackId, payload);
    this.emit('NotificationReceived', { type: 'assignment', feedbackId, payload });
  }

  // Emit support/like added
  notifySupportAdded(feedbackId, supportCount, user) {
    const payload = { feedbackId, supportCount, addedBy: user || null, timestamp: new Date().toISOString() };
    this.emit('SupportAdded', feedbackId, payload);
    this.emit('NotificationReceived', { type: 'support', feedbackId, payload });
  }

  // Emit explicit comment add (external callers can use this instead of sendChatMessage)
  notifyCommentAdded(feedbackId, comment) {
    this.emit('CommentAdded', feedbackId, comment);
    this.emit('NotificationReceived', { type: 'comment', feedbackId, comment });
  }
}

export const signalrService = new MockSignalRService();
