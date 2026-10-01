import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';

import { AppHeader, Text } from '@/components/ui';
import { AppEmptyState, AppErrorState, useToast } from '@/components/shared';
import { semantics } from '@/theme/semantics';
import { messagingApi, messagingKeys } from '../api';
import { useAiConversationsQuery } from '../hooks';
import type { AiConversationItem } from '../types/messaging.types';

const formatUpdatedAt = (value: string) => {
  if (!value) return 'Chưa có thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

export default function AiConversationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useAiConversationsQuery();
  const conversations = Array.isArray(query.data) ? query.data : [];

  const deleteMutation = useMutation({
    mutationFn: messagingApi.deleteAiConversation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: messagingKeys.aiConversations() });
      toast.success('Đã xoá cuộc trò chuyện.');
    },
    onError: () => toast.error('Không thể xoá cuộc trò chuyện. Vui lòng thử lại.'),
  });

  const confirmDelete = (item: AiConversationItem) => {
    Alert.alert(
      'Xoá cuộc trò chuyện?',
      `Lịch sử “${item.title}” sẽ bị xoá khỏi tài khoản của bạn.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(item.id),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        showBack
        title="Lịch sử trợ lý AI"
        subtitle={`${conversations.length} cuộc trò chuyện`}
        rightAction={(
          <Pressable
            style={styles.newButton}
            onPress={() => router.push('/(resident)/ai/ai-assistant' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Tạo cuộc trò chuyện mới"
          >
            <Icon name="plus" size={20} color={semantics.text.inverse} />
          </Pressable>
        )}
      />

      {query.isError ? (
        <AppErrorState onRetry={query.refetch}>
          Không thể tải lịch sử trò chuyện AI.
        </AppErrorState>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={(
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              tintColor={semantics.text.brand}
            />
          )}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => router.push(`/(resident)/ai/${item.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`Mở ${item.title}`}
            >
              <View style={styles.iconWrap}>
                <Icon name="message-circle" size={20} color={semantics.text.brand} />
              </View>
              <View style={styles.itemBody}>
                <View style={styles.itemTopRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemTime}>{formatUpdatedAt(item.updatedAt)}</Text>
                </View>
                <Text style={styles.itemPreview} numberOfLines={2}>{item.preview}</Text>
              </View>
              <Pressable
                hitSlop={10}
                style={styles.deleteButton}
                onPress={() => confirmDelete(item)}
                disabled={deleteMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Xoá ${item.title}`}
              >
                <Icon name="trash-2" size={18} color={semantics.text.muted} />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={query.isLoading ? null : (
            <AppEmptyState
              icon={<Icon name="message-circle" size={40} color={semantics.text.lightMuted} />}
            >
              Bạn chưa có cuộc trò chuyện nào. Nhấn dấu cộng để bắt đầu với trợ lý AI.
            </AppEmptyState>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: semantics.bg.app },
  listContent: { padding: 16, gap: 10, flexGrow: 1 },
  newButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantics.bg.primary,
  },
  item: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: semantics.border.default,
    borderRadius: 16,
    backgroundColor: semantics.bg.surface,
  },
  itemPressed: { opacity: 0.72 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantics.bg.primarySoft,
  },
  itemBody: { flex: 1, gap: 5 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: {
    flex: 1,
    fontFamily: 'Geist-SemiBold',
    fontSize: 15,
    color: semantics.text.primary,
  },
  itemTime: { fontSize: 11, color: semantics.text.lightMuted },
  itemPreview: { fontSize: 13, lineHeight: 19, color: semantics.text.muted },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
