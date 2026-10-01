export type SenderType = 'ServiceUser' | 'SystemStaff' | 'InteractionManager' | 'SystemAdmin' | 'System';

export interface ChatMessage {
  id: string;
  messageId?: string | number;
  tempId?: string;
  feedbackId?: string;
  senderName?: string | null;
  senderType?: SenderType | string;
  senderRole?: string;
  sender?: string;
  messageText?: string | null;
  createdAt: string;
}

export interface AiConversationItem {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
}

export interface AiConversationListItem {
  id: string;
}

export interface AiMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant' | string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
  role: 'user' | 'assistant' | 'staff' | 'system';
}

export interface SupportThread {
  feedbackId: string;
  title: string;
  code: string;
  status: string;
  imageUris: string[];
  unreadCount: number;
  lastMessage: string;
  updatedAt: string;
}
