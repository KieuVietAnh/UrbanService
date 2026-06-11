// src/services/socket/signalrService.js
import { ticketApi } from '../api/ticketApi';

class MockSignalRService {
  constructor() {
    this.listeners = {};
    this.isConnected = false;
  }

  async start() {
    if (this.isConnected) return;
    // Simulate connection lag
    await new Promise(r => setTimeout(r, 300));
    this.isConnected = true;
    console.log('[SignalR] Connected to hub.');
  }

  stop() {
    this.isConnected = false;
    console.log('[SignalR] Disconnected from hub.');
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
    
    // Save to DB
    const newComment = await ticketApi.addComment(feedbackId, user.userId, user.fullName, user.role, messageText);
    
    // Emit event locally so active listeners get the message
    this.emit('ReceiveChatMessage', feedbackId, newComment);

    // AI Auto Reply Simulation if Resident messages Staff in a ticket and it asks for AI
    if (user.role === 'service-user' && messageText.includes('@ai')) {
      setTimeout(async () => {
        const aiResponse = 'Tôi là Trợ lý AI giám sát: Đã ghi nhận phản hồi của bạn. Đội kỹ thuật đã được thông báo để đẩy nhanh tiến trình khắc phục sự cố.';
        const aiUser = { userId: 'ai-system', fullName: 'UrbanMind Copilot (AI)', role: 'system-staff' };
        const aiComment = await ticketApi.addComment(feedbackId, aiUser.userId, aiUser.fullName, aiUser.role, aiResponse);
        this.emit('ReceiveChatMessage', feedbackId, aiComment);
      }, 1000);
    }
  }
}

export const signalrService = new MockSignalRService();
