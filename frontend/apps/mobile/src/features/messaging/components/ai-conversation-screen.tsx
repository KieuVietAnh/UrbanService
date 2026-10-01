import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Icon from '@expo/vector-icons/Feather';

import { Text, AppHeader } from '@/components/ui';
import {
  AppEmptyState,
  AppErrorState,
  useToast,
} from '@/components/shared';
import { KeyboardAwareComposerLayout } from '@/components/layouts';
import { semantics } from '@/theme/semantics';

import MessageComposer from './message-composer';
import type { AiMessage } from '../types/messaging.types';
import { messagingApi, messagingKeys } from '../api';

type ApiRecord = Record<string, unknown>;

type DraftImage = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  base64?: string | null;
};

const DRAFT_STORAGE_KEY = 'urbanmind:create-ticket-draft:mobile';

const isApiRecord = (value: unknown): value is ApiRecord =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value);

const getErrorMessage = (value: unknown): string | null => {
  if (
    !isApiRecord(value) ||
    typeof value.message !== 'string'
  ) {
    return null;
  }

  return value.message;
};

const formatTime = (value: string) => {
  if (!value) return '';

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeMessage = (
  raw: unknown,
  index: number,
): AiMessage | null => {
  if (!isApiRecord(raw)) return null;

  const nestedData = isApiRecord(raw.data)
    ? raw.data
    : {};

  const id = String(
    raw.messageId ??
      raw.id ??
      raw.uuid ??
      `message-${index}`,
  );

  const content =
    raw.messageText ??
    raw.message ??
    raw.reply ??
    raw.content ??
    nestedData.message ??
    nestedData.reply ??
    nestedData.messageText ??
    '';

  const senderRaw = String(
    raw.senderType ??
      raw.sender ??
      raw.role ??
      '',
  ).toLowerCase();

  const sender: AiMessage['sender'] =
    senderRaw.includes('user')
      ? 'user'
      : 'assistant';

  return {
    id,
    content: String(content),
    sender,
    createdAt: String(
      raw.createdAt ??
        raw.createdAtUtc ??
        '',
    ),
  };
};

const normalizeChatReply = (payload: unknown) => {
  const payloadRecord = isApiRecord(payload)
    ? payload
    : {};

  const data = isApiRecord(payloadRecord.data)
    ? payloadRecord.data
    : payloadRecord;

  const nestedData = isApiRecord(data.data)
    ? data.data
    : {};

  const conversation = isApiRecord(data.conversation)
    ? data.conversation
    : {};

  const result = isApiRecord(data.result)
    ? data.result
    : {};

  const message =
    data.message ??
    data.messageText ??
    data.reply ??
    data.content ??
    nestedData.message ??
    nestedData.reply ??
    nestedData.messageText ??
    '';

  const conversationId = String(
    data.conversationId ??
      data.conversationID ??
      data.id ??
      conversation.id ??
      result.conversationId ??
      '',
  );

  const createdAt =
    data.createdAt ??
    data.createdAtUtc ??
    '';

  return {
    message: String(message),
    conversationId,
    createdAt: String(createdAt),
  };
};

export default function AiConversationDetailScreen() {
  const { conversationId } =
    useLocalSearchParams<{
      conversationId: string;
    }>();

  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draftImage, setDraftImage] = useState<DraftImage | null>(null);
  const [draftLocation, setDraftLocation] = useState<{
    label: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const listRef =
    useRef<FlatList<AiMessage> | null>(null);

  const isPlaceholderConversation =
    conversationId === 'ai-assistant';

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery<AiMessage[]>({
    queryKey: messagingKeys.aiMessages(
      conversationId ?? '',
    ),

    queryFn: async () => {
      if (!conversationId) {
        return [];
      }

      if (isPlaceholderConversation) {
        return [];
      }

      const raw =
        await messagingApi.getAiConversationMessages(
          conversationId,
        );

      if (!Array.isArray(raw)) {
        return [];
      }

      return raw
        .map(normalizeMessage)
        .filter(
          (
            message,
          ): message is AiMessage =>
            Boolean(message?.content),
        );
    },

    enabled: Boolean(conversationId),
    retry: false,
    staleTime: 1000 * 60 * 3,
  });

  const messages = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data],
  );

  const scrollToBottom = useCallback(
    (animated = true) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated,
        });
      });
    },
    [],
  );

  useEffect(() => {
    if (!messages.length) {
      return undefined;
    }

    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [messages.length, scrollToBottom]);

  const sendMutation = useMutation({
    mutationFn: async (
      messageText: string,
    ) => {
      if (isPlaceholderConversation) {
        return messagingApi.sendAiMessage({
          message: messageText,
        });
      }

      return messagingApi.sendAiMessage({
        conversationId,
        message: messageText,
      });
    },

    onMutate: async (
      messageText: string,
    ) => {
      const queryKey =
        messagingKeys.aiMessages(
          conversationId ?? '',
        );

      await queryClient.cancelQueries({
        queryKey,
      });

      const tempId = `temp-${Date.now()}`;

      const optimistic: AiMessage = {
        id: tempId,
        content: messageText,
        sender: 'user',
        createdAt:
          new Date().toISOString(),
      };

      queryClient.setQueryData<AiMessage[]>(
        queryKey,
        (old) => {
          const arr = Array.isArray(old)
            ? old
            : [];

          return [...arr, optimistic];
        },
      );

      setTimeout(() => {
        scrollToBottom(true);
      }, 80);

      return { tempId };
    },

    onSuccess: (response) => {
      const reply =
        normalizeChatReply(response);

      const currentQueryKey =
        messagingKeys.aiMessages(
          conversationId ?? '',
        );

      queryClient.setQueryData<AiMessage[]>(
        currentQueryKey,
        (old) => {
          const arr = Array.isArray(old)
            ? old
            : [];

          if (!reply.message) {
            return arr;
          }

          return [
            ...arr,
            {
              id: `ai-${Date.now()}`,
              content: reply.message,
              sender: 'assistant',
              createdAt: reply.createdAt,
            },
          ];
        },
      );

      void queryClient.invalidateQueries({
        queryKey:
          messagingKeys.aiConversations(),
        refetchType: 'none',
      });

      if (
        reply.conversationId &&
        reply.conversationId !==
          conversationId
      ) {
        const optimisticHistory =
          queryClient.getQueryData<
            AiMessage[]
          >(currentQueryKey);

        queryClient.setQueryData(
          messagingKeys.aiMessages(
            reply.conversationId,
          ),
          optimisticHistory,
        );

        void queryClient.invalidateQueries({
          queryKey:
            messagingKeys.aiMessages(
              reply.conversationId,
            ),
          refetchType: 'none',
        });

        router.replace(
          `/(resident)/ai/${reply.conversationId}`,
        );
      }

      scrollToBottom(true);

      setTimeout(() => {
        scrollToBottom(true);
      }, 200);
    },

    onError: () => {
      if (__DEV__) {
        console.warn(
          'AI message send failed',
        );
      }

      toast.error(
        'Gửi tin nhắn AI thất bại. Vui lòng thử lại.',
      );
    },
  });

  const chooseDraftImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Vui lòng cho phép truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setDraftImage({
      uri: asset.uri,
      name: asset.fileName || `ai-evidence-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
      base64: asset.base64,
    });
  };

  const chooseDraftLocation = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      toast.error('Vui lòng cho phép truy cập vị trí.');
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      const results = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const address = results[0];
      const label = address
        ? [address.name, address.street, address.district, address.city]
            .filter(Boolean)
            .filter((part, index, values) => values.indexOf(part) === index)
            .join(', ')
        : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      setDraftLocation({ label: label || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude });
      toast.success('Đã thêm vị trí hiện tại.');
    } catch {
      toast.error('Không thể lấy vị trí hiện tại. Vui lòng thử lại.');
    }
  };

  const draftMutation = useMutation({
    mutationFn: async () => {
      const reflection = messages
        .filter((message) => message.sender === 'user')
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join('\n');
      if (!reflection) {
        throw new Error('EMPTY_REFLECTION');
      }
      return messagingApi.createAiFeedbackDraft({
        reflection,
        location: draftLocation?.label,
        latitude: draftLocation?.latitude,
        longitude: draftLocation?.longitude,
        base64Images: draftImage?.base64 ? [draftImage.base64] : undefined,
      });
    },
    onSuccess: async (response) => {
      const outer = isApiRecord(response) ? response : {};
      const result = isApiRecord(outer.data) ? outer.data : outer;
      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
        title: String(result.title ?? ''),
        description: String(result.description ?? result.summary ?? ''),
        locationText: String(result.location ?? draftLocation?.label ?? ''),
        latitude: result.latitude ?? draftLocation?.latitude ?? null,
        longitude: result.longitude ?? draftLocation?.longitude ?? null,
        priority: String(result.urgencyLevel ?? 'Medium'),
        suggestedCategory: String(result.suggestedCategory ?? ''),
        attachments: draftImage ? [{
          uri: draftImage.uri,
          name: draftImage.name,
          type: draftImage.type,
          size: draftImage.size,
        }] : [],
        source: 'ai-assistant',
        savedAt: new Date().toISOString(),
      }));
      toast.success('AI đã tạo bản nháp. Hãy kiểm tra trước khi gửi.');
      router.push('/(resident)/create-feedback');
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'EMPTY_REFLECTION') {
        toast.error('Hãy mô tả sự việc cho AI trước khi tạo phản ánh.');
        return;
      }
      toast.error('Không thể tạo bản nháp phản ánh từ AI. Vui lòng thử lại.');
    },
  });

  const handleSend = async (
    text: string,
  ) => {
    if (
      !text.trim() ||
      !conversationId
    ) {
      return;
    }

    try {
      await sendMutation.mutateAsync(
        text,
      );
    } catch {
      // Mutation callbacks handle UI feedback.
    }
  };

  const renderMessage = ({
    item,
  }: {
    item: AiMessage;
  }) => {
    const isUser =
      item.sender === 'user';

    return (
      <View
        style={[
          styles.messageWrap,
          isUser
            ? styles.messageOwnWrap
            : styles.messageOtherWrap,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser
              ? styles.messageOwn
              : styles.messageOther,
          ]}
        >
          <Text
            style={[
              styles.messageSender,
              isUser
                ? styles.messageSenderOwn
                : styles.messageSenderOther,
            ]}
          >
            {isUser
              ? 'Bạn'
              : 'Trợ lý AI'}
          </Text>

          <Text
            style={[
              styles.messageText,
              isUser
                ? styles.messageTextOwn
                : styles.messageTextOther,
            ]}
          >
            {item.content}
          </Text>

          <Text
            style={[
              styles.messageTime,
              isUser
                ? styles.messageTimeOwn
                : styles.messageTimeOther,
            ]}
          >
            {formatTime(
              item.createdAt,
            )}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safe}>
      <SafeAreaView
        style={styles.safeArea}
        edges={['top']}
      >
        <AppHeader
          showBack
          title="Trợ lý AI"
          subtitle="Câu chuyện của bạn"
          rightAction={(
            <Pressable
              style={styles.headerAction}
              onPress={() => router.push('/(resident)/ai' as never)}
              accessibilityRole="button"
              accessibilityLabel="Mở lịch sử trò chuyện"
            >
              <Icon name="clock" size={19} color={semantics.text.primary} />
            </Pressable>
          )}
        />

        {isError &&
        messages.length === 0 ? (
          <AppErrorState
            onRetry={refetch}
          >
            {getErrorMessage(error) ||
              'Không thể tải hội thoại AI.'}
          </AppErrorState>
        ) : (
          <KeyboardAwareComposerLayout
            composer={
              <View
                style={
                  styles.composerContainer
                }
              >
                <View style={styles.draftTools}>
                  {draftImage ? (
                    <View style={styles.draftImageWrap}>
                      <Image source={{ uri: draftImage.uri }} style={styles.draftImage} />
                      <Pressable
                        style={styles.removeDraftImage}
                        onPress={() => setDraftImage(null)}
                        accessibilityLabel="Bỏ ảnh"
                      >
                        <Icon name="x" size={12} color={semantics.text.inverse} />
                      </Pressable>
                    </View>
                  ) : null}
                  <Pressable style={styles.toolButton} onPress={chooseDraftImage}>
                    <Icon name="image" size={16} color={semantics.text.brand} />
                    <Text style={styles.toolButtonText}>{draftImage ? 'Đổi ảnh' : 'Thêm ảnh'}</Text>
                  </Pressable>
                  <Pressable style={styles.toolButton} onPress={chooseDraftLocation}>
                    <Icon name="map-pin" size={16} color={semantics.text.brand} />
                    <Text style={styles.toolButtonText} numberOfLines={1}>
                      {draftLocation ? 'Đã có GPS' : 'Thêm GPS'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.createDraftButton, draftMutation.isPending && styles.disabledButton]}
                    onPress={() => draftMutation.mutate()}
                    disabled={draftMutation.isPending}
                  >
                    {draftMutation.isPending ? (
                      <ActivityIndicator size="small" color={semantics.text.inverse} />
                    ) : (
                      <Icon name="file-plus" size={16} color={semantics.text.inverse} />
                    )}
                    <Text style={styles.createDraftText}>Tạo phản ánh</Text>
                  </Pressable>
                </View>
                {draftLocation ? (
                  <Text style={styles.locationSummary} numberOfLines={1}>
                    {draftLocation.label}
                  </Text>
                ) : null}
                <View
                  style={
                    styles.composerWrap
                  }
                >
                  <Text
                    style={
                      styles.composerLabel
                    }
                  >
                    Gửi câu hỏi đến AI
                  </Text>

                  <MessageComposer
                    onSend={handleSend}
                    sending={
                      sendMutation.isPending ||
                      isLoading
                    }
                    onFocus={() =>
                      scrollToBottom(true)
                    }
                  />
                </View>
              </View>
            }
          >
            <View style={styles.container}>
              <View
                style={styles.chatBody}
              >
                <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={(item) =>
                    item.id
                  }
                  renderItem={
                    renderMessage
                  }
                  contentContainerStyle={
                    styles.listContent
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  onContentSizeChange={() => {
                    setTimeout(
                      () =>
                        scrollToBottom(
                          true,
                        ),
                      60,
                    );
                  }}
                  onLayout={() => {
                    setTimeout(
                      () =>
                        scrollToBottom(
                          true,
                        ),
                      60,
                    );
                  }}
                  style={styles.list}
                  refreshControl={
                    <RefreshControl
                      refreshing={
                        isRefetching
                      }
                      onRefresh={refetch}
                      tintColor={
                        semantics.text
                          .brand
                      }
                    />
                  }
                  ListEmptyComponent={
                    isLoading ? (
                      <View
                        style={
                          styles.initialLoading
                        }
                      >
                        <ActivityIndicator
                          size="large"
                          color={
                            semantics
                              .text.brand
                          }
                        />
                      </View>
                    ) : (
                      <AppEmptyState
                        icon={
                          <Icon
                            name="cpu"
                            size={40}
                            color={
                              semantics
                                .text
                                .lightMuted
                            }
                          />
                        }
                      >
                        Chưa có tin
                        nhắn nào trong
                        hội thoại này.
                        Gửi tin nhắn để
                        bắt đầu.
                      </AppEmptyState>
                    )
                  }
                />
              </View>
            </View>
          </KeyboardAwareComposerLayout>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor:
      semantics.bg.app,
  },

  safeArea: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  composerContainer: {
    borderTopWidth: 1,
    borderTopColor:
      semantics.border.default,
    backgroundColor:
      semantics.bg.surface,
  },

  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semantics.bg.surfaceSubtle,
  },

  draftTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  toolButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: semantics.border.default,
    backgroundColor: semantics.bg.surface,
  },

  toolButtonText: {
    fontFamily: 'Geist-Medium',
    fontSize: 11,
    color: semantics.text.brand,
  },

  createDraftButton: {
    minHeight: 36,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: semantics.bg.primary,
  },

  createDraftText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    color: semantics.text.inverse,
  },

  disabledButton: { opacity: 0.6 },

  locationSummary: {
    marginTop: 6,
    paddingHorizontal: 14,
    fontSize: 11,
    color: semantics.text.muted,
  },

  draftImageWrap: { position: 'relative' },
  draftImage: { width: 36, height: 36, borderRadius: 9 },
  removeDraftImage: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },

  chatBody: {
    flex: 1,
    justifyContent: 'flex-start',
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    paddingBottom: 16,
    flexGrow: 1,
  },

  initialLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },

  composerWrap: {
    width: '100%',
    marginTop: 0,
    backgroundColor:
      semantics.bg.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'stretch',
  },

  composerLabel: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: semantics.text.muted,
    marginBottom: 8,
  },

  messageWrap: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  messageOwnWrap: {
    justifyContent: 'flex-end',
  },

  messageOtherWrap: {
    justifyContent: 'flex-start',
  },

  messageBubble: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
  },

  messageOwn: {
    backgroundColor:
      semantics.bg.primarySoft,
  },

  messageOther: {
    backgroundColor:
      semantics.bg.surface,
    borderWidth: 1,
    borderColor:
      semantics.border.default,
  },

  messageSender: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    marginBottom: 6,
  },

  messageSenderOwn: {
    color: semantics.text.brand,
  },

  messageSenderOther: {
    color: semantics.text.muted,
  },

  messageText: {
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    lineHeight: 22,
  },

  messageTextOwn: {
    color: semantics.text.primary,
  },

  messageTextOther: {
    color: semantics.text.primary,
  },

  messageTime: {
    marginTop: 8,
    fontSize: 11,
    color:
      semantics.text.lightMuted,
    textAlign: 'right',
  },

  messageTimeOwn: {
    color:
      semantics.text.lightMuted,
  },

  messageTimeOther: {
    color:
      semantics.text.lightMuted,
  },
});
