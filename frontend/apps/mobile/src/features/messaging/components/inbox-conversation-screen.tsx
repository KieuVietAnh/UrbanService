import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Compatibility route for links created by older mobile versions.
 * Conversation content is never synthesized here: each legacy link is routed
 * to the production AI or feedback conversation flow.
 */
export default function InboxConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const id = typeof conversationId === 'string' ? conversationId.trim() : '';

  if (id === 'staff-support') {
    return <Redirect href="/(resident)/support/select-feedback" />;
  }

  if (!id) {
    return <Redirect href="/(resident)/inbox" />;
  }

  return <Redirect href={`/(resident)/ai/${encodeURIComponent(id)}`} />;
}
