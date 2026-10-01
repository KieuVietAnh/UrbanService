import { axiosClient, toolsApi } from '@urbanmind/shared-api';
import type { AiConversationItem, ChatMessage } from '../types/messaging.types';

const unwrapItems = (response: unknown): unknown[] => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];

  const responseRecord = response as Record<string, unknown>;
  const data = responseRecord.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) return items;
  }
  return Array.isArray(responseRecord.items) ? responseRecord.items : [];
};

const normalizeAiConversation = (raw: unknown): AiConversationItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = String(item.conversationId ?? item.id ?? item.uuid ?? item.key ?? '');
  if (!id) return null;

  return {
    id,
    title: String(item.title ?? item.name ?? 'Cuộc trò chuyện AI'),
    preview: String(
      item.lastMessage ?? item.preview ?? item.snippet ?? item.summary ?? item.description ??
      'Bắt đầu hội thoại với trợ lý AI.'
    ),
    updatedAt: String(
      item.lastMessageAt ?? item.lastMessageAtUtc ?? item.lastUpdatedAt ?? item.updatedAt ??
      item.lastUpdated ?? item.createdAt ?? ''
    ),
  };
};

export const messagingApi = {
  async getAiConversations(): Promise<AiConversationItem[]> {
    const response = await toolsApi.getAiConversations();
    if (!Array.isArray(response)) return [];
    return response
      .map(normalizeAiConversation)
      .filter((item): item is AiConversationItem => Boolean(item));
  },

  async getAiConversationMessages(conversationId: string) {
    return toolsApi.getAiConversationMessages(conversationId);
  },

  async sendAiMessage(payload: { message: string; conversationId?: string }) {
    return toolsApi.getAiChatReply(payload);
  },

  async deleteAiConversation(conversationId: string) {
    return toolsApi.deleteAiConversation(conversationId);
  },

  async createAiFeedbackDraft(payload: {
    reflection: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    imageUrls?: string[];
    base64Images?: string[];
  }) {
    return toolsApi.createAiFeedbackDraft(payload);
  },

  async getFeedbackMessages(feedbackId: string): Promise<ChatMessage[]> {
    const response = await axiosClient.get(`/api/feedbacks/${feedbackId}/messages`, {
      params: { includeInternal: false },
    });
    return unwrapItems(response) as ChatMessage[];
  },

  async sendFeedbackMessage(feedbackId: string, messageText: string) {
    const response = await axiosClient.post(`/api/feedbacks/${feedbackId}/messages`, {
      messageText,
      isInternal: false,
    });
    return response?.data ?? response;
  },

  async getInboxConversations(): Promise<Array<Record<string, unknown>>> {
    const response = await axiosClient.get('/api/inbox/conversations');
    return unwrapItems(response) as Array<Record<string, unknown>>;
  },

  async createInboxConversation(type: string): Promise<Record<string, unknown>> {
    const response = await axiosClient.post('/api/inbox/conversations', { type });
    const value = response?.data ?? response;
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  },
};
