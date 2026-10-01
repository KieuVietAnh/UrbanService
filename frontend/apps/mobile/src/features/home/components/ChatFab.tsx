import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from '@/components/shared';
import { styles } from '../homeStyles';
import { FloatingChatMenu } from '@/components/ui';
import { messagingApi } from '@/features/messaging/api';

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  router?: any;
};

export function ChatFab({ isOpen, onToggle }: Props) {
  const router = useRouter();
  const toast = useToast();

  const handleSelect = async (id: 'ai' | 'staff' | 'inbox') => {
    if (id === 'ai') {
      router.push('/(resident)/ai/ai-assistant');
      return;
    }

    if (id === 'inbox') {
      router.push('/(resident)/inbox');
      return;
    }

    // Staff flow: find or create a staff conversation then navigate
    if (id === 'staff') {
      toast.info('Đang kết nối Cán bộ hỗ trợ...');
      try {
        const items = await messagingApi.getInboxConversations();
        const staffConv = items.find((c: any) => c?.type === 'staff');
        let conversationId = staffConv?.id;
        if (!conversationId) {
          const created = await messagingApi.createInboxConversation('staff');
          conversationId = created?.id;
        }
        if (conversationId) {
          router.push(`/(resident)/inbox/${conversationId}` as any);
        } else {
          toast.error('Không thể tạo phiên trò chuyện với cán bộ. Vui lòng thử lại sau.');
        }
      } catch (e) {
        if (__DEV__) console.warn('Staff chat open failed');
        toast.error('Không thể kết nối tới cán bộ. Vui lòng thử lại sau.');
      }
    }
  };

  return (
    <View style={styles.chatWrap}>
      <FloatingChatMenu mode="home" bottomOffset={90} onSelectOption={handleSelect} />
    </View>
  );
}
