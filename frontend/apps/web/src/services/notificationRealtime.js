// src/services/notificationRealtime.js

class NotificationRealtimeService {
  constructor() {
    this.listeners = {};
    this.connected = false;
  }

  async start() {
    if (this.connected) return;
    this.connected = true;
  }

  stop() {
    this.connected = false;
  }

  on(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (!this.listeners[eventName]) return;
    if (callback) {
      this.listeners[eventName] = this.listeners[eventName].filter((cb) => cb !== callback);
    } else {
      delete this.listeners[eventName];
    }
  }

  emit(eventName, payload) {
    const handlers = this.listeners[eventName] || [];
    handlers.forEach((handler) => handler(payload));
  }

  triggerNotificationReceived(payload) {
    this.emit('NotificationReceived', payload);
  }
}

export const notificationRealtimeService = new NotificationRealtimeService();
