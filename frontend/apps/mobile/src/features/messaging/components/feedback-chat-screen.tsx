import React from 'react';
import { Pressable, View } from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppHeader, Text } from '@/components/ui';
import FeedbackChatSection from './feedback-chat-section';
import {
  feedbackApi,
  reportingKeys,
} from '@/features/reporting/api';
import { semantics } from '@/theme/semantics';

export default function FeedbackChatScreen() {
  const { id } =
    useLocalSearchParams<{ id: string }>();

  const router = useRouter();
  const feedbackId = id || '';

  const { data: ticket } = useQuery({
    queryKey:
      reportingKeys.detail(feedbackId),
    queryFn: () =>
      feedbackApi.getById(feedbackId),
    enabled: Boolean(feedbackId),
    staleTime: 1000 * 30,
  });

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: semantics.bg.app,
      }}
      edges={['top']}
    >
      <AppHeader
        showBack
        title="Trao đổi phản ánh"
        onBack={() => router.back()}
        rightAction={(
          <Pressable
            hitSlop={10}
            onPress={() => router.push(`/(resident)/tickets/${feedbackId}` as never)}
            accessibilityRole="button"
            accessibilityLabel="Xem chi tiết phản ánh"
          >
            <Icon name="file-text" size={20} color={semantics.text.primary} />
          </Pressable>
        )}
      />

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: semantics.text.muted,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {ticket?.title ??
            ticket?.code ??
            `#${feedbackId}`}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <FeedbackChatSection
          feedbackId={feedbackId}
        />
      </View>
    </SafeAreaView>
  );
}
