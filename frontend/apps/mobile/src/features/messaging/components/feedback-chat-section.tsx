import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { KeyboardAwareComposerLayout } from '@/components/layouts';
import {
  AppErrorState,
  useToast,
} from '@/components/shared';
import { semantics } from '@/theme/semantics';

import MessageBubble, {
  ChatMessage,
} from './feedback-message-bubble';
import MessageComposer from './message-composer';
import {
  messagingApi,
  messagingKeys,
} from '../api';

const MESSAGE_POLL_INTERVAL_MS = 2000;

const getPersistedMessageId = (
  message: ChatMessage | null | undefined,
) => {
  const record = message as
    | (ChatMessage & {
        interactionMessageId?:
          | string
          | number;
      })
    | null
    | undefined;

  const value =
    record?.messageId ??
    record?.interactionMessageId ??
    record?.id;

  if (
    !value ||
    String(value).startsWith('temp-')
  ) {
    return null;
  }

  return String(value);
};

const dedupeMessages = (
  items: ChatMessage[],
) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const persistedId =
      getPersistedMessageId(item);

    if (!persistedId) {
      return true;
    }

    if (seen.has(persistedId)) {
      return false;
    }

    seen.add(persistedId);
    return true;
  });
};

export default function FeedbackChatSection({
  feedbackId,
}: {
  feedbackId: string;
}) {
  const queryClient =
    useQueryClient();

  const toast = useToast();

  const [isAppActive, setIsAppActive] =
    useState(
      AppState.currentState === 'active',
    );

  const [
    isScreenFocused,
    setIsScreenFocused,
  ] = useState(true);

  const listRef =
    useRef<FlatList<ChatMessage> | null>(
      null,
    );

  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);

      return () => {
        setIsScreenFocused(false);
      };
    }, []),
  );

  const {
    data: messages = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<ChatMessage[]>({
    queryKey:
      messagingKeys.feedbackMessages(
        feedbackId,
      ),

    queryFn: async () => {
      const remoteMessages =
        await messagingApi.getFeedbackMessages(
          feedbackId,
        );

      const cachedMessages =
        queryClient.getQueryData<
          ChatMessage[]
        >(
          messagingKeys.feedbackMessages(
            feedbackId,
          ),
        );

      const optimisticMessages =
        Array.isArray(cachedMessages)
          ? cachedMessages.filter(
              (message) =>
                String(
                  message.id,
                ).startsWith('temp-'),
            )
          : [];

      return dedupeMessages([
        ...remoteMessages,
        ...optimisticMessages,
      ]);
    },

    enabled:
      Boolean(feedbackId) &&
      isAppActive &&
      isScreenFocused,

    refetchInterval:
      isAppActive && isScreenFocused
        ? MESSAGE_POLL_INTERVAL_MS
        : false,

    refetchIntervalInBackground:
      false,

    staleTime: 1000,
  });

  /**
   * Theo dõi trạng thái foreground/background.
   *
   * Khi app background:
   * - dừng polling.
   *
   * Khi quay lại foreground:
   * - query được enable lại.
   * - effect phía dưới sẽ refetch ngay.
   */
  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        'change',
        (nextState) => {
          setIsAppActive(
            nextState === 'active',
          );
        },
      );

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Khi app quay lại foreground hoặc
   * route được focus lại:
   *
   * refetch ngay thay vì chờ 2 giây.
   */
  useEffect(() => {
    if (
      !isAppActive ||
      !isScreenFocused ||
      !feedbackId
    ) {
      return;
    }

    void queryClient.refetchQueries({
      queryKey:
        messagingKeys.feedbackMessages(
          feedbackId,
        ),
      type: 'active',
    });
  }, [
    feedbackId,
    isAppActive,
    isScreenFocused,
    queryClient,
  ]);

  const scrollToBottom = (
    animated = true,
  ) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({
        animated,
      });
    });
  };

  /**
   * Khi có message mới do polling,
   * scroll xuống message cuối.
   */
  useEffect(() => {
    if (!messages.length) {
      return undefined;
    }

    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (
      messageText: string,
    ) =>
      messagingApi.sendFeedbackMessage(
        feedbackId,
        messageText,
      ),

    /**
     * Optimistic message.
     */
    onMutate: async (
      text: string,
    ) => {
      const queryKey =
        messagingKeys.feedbackMessages(
          feedbackId,
        );

      await queryClient.cancelQueries({
        queryKey,
      });

      const tempId =
        `temp-${Date.now()}`;

      const optimistic: ChatMessage = {
        id: tempId,
        feedbackId,
        senderName: 'Bạn',
        senderType: 'ServiceUser',
        messageText: text,
        createdAt:
          new Date().toISOString(),
      };

      queryClient.setQueryData<
        ChatMessage[]
      >(queryKey, (old) => {
        const current =
          Array.isArray(old)
            ? old
            : [];

        return dedupeMessages([
          ...current,
          optimistic,
        ]);
      });

      setTimeout(() => {
        scrollToBottom(true);
      }, 80);

      return {
        tempId,
      };
    },

    /**
     * Khi POST thành công:
     * - bỏ temp message
     * - thêm persisted message
     * - dedupe
     * - invalidate chat/inbox cache
     */
    onSuccess: (
      serverMessage,
      _text,
      context,
    ) => {
      const persistedMessage =
        serverMessage as
          | ChatMessage
          | null;

      const persistedId =
        getPersistedMessageId(
          persistedMessage,
        );

      queryClient.setQueryData<
        ChatMessage[]
      >(
        messagingKeys.feedbackMessages(
          feedbackId,
        ),
        (old) => {
          const current =
            Array.isArray(old)
              ? old
              : [];

          const withoutOptimistic =
            current.filter(
              (message) =>
                message.id !==
                context?.tempId,
            );

          if (
            persistedMessage &&
            persistedId
          ) {
            return dedupeMessages([
              ...withoutOptimistic,
              persistedMessage,
            ]);
          }

          return withoutOptimistic;
        },
      );

      void queryClient.invalidateQueries({
        queryKey:
          messagingKeys.feedbackMessages(
            feedbackId,
          ),
      });

      void queryClient.invalidateQueries({
        queryKey:
          messagingKeys.supportThreads(),
        refetchType: 'none',
      });

      setTimeout(() => {
        scrollToBottom(true);
      }, 200);
    },

    onError: () => {
      if (__DEV__) {
        console.warn(
          'Feedback message send failed',
        );
      }

      toast.error(
        'Không thể gửi tin nhắn',
      );
    },
  });

  const handleSend = async (
    text: string,
  ) => {
    if (
      !text.trim() ||
      !feedbackId
    ) {
      return;
    }

    try {
      await sendMutation.mutateAsync(
        text,
      );
    } catch {
      // Mutation callback handles toast.
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <KeyboardAwareComposerLayout
        /**
         * Quan trọng:
         *
         * Khi keyboard mở, composer được
         * translate lên.
         *
         * avoidContentOverlap đồng thời
         * điều chỉnh vùng content để
         * message cuối không nằm phía sau
         * composer.
         */
        avoidContentOverlap
        composer={
          <View
            style={
              styles.composerContainer
            }
          >
            <View
              style={
                styles.composerWrap
              }
            >
              <MessageComposer
                onSend={handleSend}
                sending={
                  !feedbackId ||
                  sendMutation.isPending ||
                  isLoading
                }
                onFocus={() => {
                  setTimeout(() => {
                    scrollToBottom(true);
                  }, 80);
                }}
                containerStyle={
                  styles.feedbackComposer
                }
              />
            </View>
          </View>
        }
      >
        <View style={styles.wrap}>
          <View
            style={styles.headerRow}
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Trao đổi
            </Text>
          </View>

          <View
            style={styles.chatBody}
          >
            <View
              style={styles.listWrap}
            >
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(
                  message,
                  index,
                ) =>
                  String(
                    message?.id ??
                      message?.messageId ??
                      message?.tempId ??
                      `${
                        message?.createdAt ??
                        ''
                      }-${index}`,
                  )
                }
                renderItem={({
                  item,
                }) => (
                  <MessageBubble
                    msg={item}
                  />
                )}
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
                  ) : isError ? (
                    <AppErrorState
                      onRetry={
                        refetch
                      }
                    >
                      Không thể tải cuộc
                      hội thoại này.
                    </AppErrorState>
                  ) : (
                    <View
                      style={
                        styles.empty
                      }
                    >
                      <Text
                        style={
                          styles.emptyTitle
                        }
                      >
                        Chưa có trao đổi
                      </Text>

                      <Text
                        style={
                          styles.emptySub
                        }
                      >
                        Bạn có thể hỏi
                        nhân viên hỗ trợ
                        về phản ánh này.
                      </Text>
                    </View>
                  )
                }
                contentContainerStyle={
                  styles.listContent
                }
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onContentSizeChange={() => {
                  setTimeout(() => {
                    scrollToBottom(true);
                  }, 50);
                }}
                style={styles.list}
              />
            </View>
          </View>
        </View>
      </KeyboardAwareComposerLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      semantics.bg.surface,
  },

  wrap: {
    flex: 1,
    marginTop: 8,
    backgroundColor:
      semantics.bg.surface,
    borderTopWidth: 1,
    borderTopColor:
      semantics.border.default,
    position: 'relative',
  },

  composerContainer: {
    borderTopWidth: 1,
    borderTopColor:
      semantics.border.default,
    backgroundColor:
      semantics.bg.surface,
  },

  composerWrap: {
    width: '100%',
    backgroundColor:
      semantics.bg.surface,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'stretch',
  },

  /**
   * Riêng Feedback Chat.
   *
   * MessageComposer mặc định:
   * paddingTop: 8
   * paddingBottom: 8
   *
   * Feedback dùng 5/5 để thanh
   * composer gọn hơn.
   */
  feedbackComposer: {
    paddingTop: 5,
    paddingBottom: 5,
  },

  chatBody: {
    flex: 1,
  },

  listWrap: {
    flex: 1,
  },

  list: {
    flex: 1,
  },

  listContent: {
    paddingVertical: 10,

    /**
     * Khoảng cách message cuối với
     * đáy list khi keyboard đóng.
     */
    paddingBottom: 16,

    flexGrow: 1,
  },

  initialLoading: {
    flex: 1,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },

  sectionTitle: {
    fontSize: 12,
    fontFamily:
      'Geist-SemiBold',
    color:
      semantics.text.lightMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  empty: {
    padding: 20,
    alignItems: 'center',
  },

  emptyTitle: {
    fontFamily:
      'Geist-SemiBold',
    fontSize: 14,
    color:
      semantics.text.primary,
    marginBottom: 6,
  },

  emptySub: {
    fontFamily:
      'Geist-Regular',
    fontSize: 13,
    color:
      semantics.text.muted,
    textAlign: 'center',
  },
});