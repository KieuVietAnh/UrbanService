import { axiosClient } from './axiosClient.js';

export const chatbotApi = {
  sendMessage(message) {
    return axiosClient.post('/api/chatbot/message', { message });
  },

  checkTicketStatus(ticketId) {
    return axiosClient.get(`/api/chatbot/ticket-status/${ticketId}`);
  },

  getUrbanServiceAnswer(question) {
    return axiosClient.get('/api/chatbot/urban-service-answer', {
      params: { question },
    });
  },
};
