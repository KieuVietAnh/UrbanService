export const messagingKeys = {
  all: ['messaging'] as const,
  aiConversations: () => [...messagingKeys.all, 'ai', 'conversations'] as const,
  aiMessages: (conversationId: string) =>
    [...messagingKeys.all, 'ai', 'messages', conversationId] as const,
  inboxConversation: (conversationId: string) =>
    [...messagingKeys.all, 'inbox', 'conversation', conversationId] as const,
  supportThreads: () => [...messagingKeys.all, 'support', 'threads'] as const,
  feedbackMessages: (feedbackId: string) =>
    [...messagingKeys.all, 'support', 'messages', feedbackId] as const,
};
