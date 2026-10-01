import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { semantics } from '@/theme/semantics';

export default function MessageComposer({
  onSend,
  sending,
  onFocus,
  onHeightChange,
  containerStyle,
}: {
  onSend: (text: string) => Promise<void> | void;
  sending?: boolean;
  onFocus?: () => void;
  onHeightChange?: (h: number) => void;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [text, setText] = useState('');

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setText('');
    await onSend(trimmed);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height || 0;
    onHeightChange?.(h);
  };

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={handleLayout}
    >
      <TextInput
        style={styles.input}
        placeholder="Viết tin nhắn..."
        placeholderTextColor={semantics.text.lightMuted}
        value={text}
        onChangeText={setText}
        onFocus={onFocus}
        multiline
      />

      <Pressable
        onPress={handleSend}
        disabled={!text.trim() || sending}
        style={[
          styles.sendBtn,
          (!text.trim() || sending) && styles.sendBtnDisabled,
        ]}
      >
        <Icon name="send" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: semantics.bg.surface,
  },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: semantics.bg.surfaceSubtle,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: 'Geist-Regular',
    color: semantics.text.primary,
    textAlignVertical: 'center',
  },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: semantics.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendBtnDisabled: {
    backgroundColor: semantics.text.lightMuted,
  },
});