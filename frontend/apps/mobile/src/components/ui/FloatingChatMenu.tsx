import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Icon from '@expo/vector-icons/Feather';
import { Text } from './Text';
import { semantics } from '@/theme/semantics';
import { useToast } from '@/components/shared/toast';

export interface FloatingChatMenuProps {
  bottomOffset?: number;
  onSelectOption?: (optionId: 'ai' | 'staff' | 'inbox') => void;
  /** mode: 'default' shows AI + Staff; 'home' shows AI + Inbox */
  mode?: 'default' | 'home';
}

const CHAT_OPTIONS = (mode: 'default' | 'home' = 'default') => [
  mode === 'home'
    ? {
        id: 'inbox' as const,
        label: 'Hộp thư',
        sub: 'Hộp thư',
        icon: 'inbox' as const,
        color: '#2563EB',
        bg: '#EFF6FF',
      }
    : {
        id: 'staff' as const,
        label: 'Chat với nhân viên',
        sub: 'Kết nối cán bộ trực tiếp',
        icon: 'headphones' as const,
        color: '#2563EB',
        bg: '#EFF6FF',
      },
  {
    id: 'ai' as const,
    label: 'Chat Trợ lý AI',
    sub: 'Trợ lý đô thị thông minh',
    icon: 'cpu' as const,
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
];

export function FloatingChatMenu({ bottomOffset = 90, onSelectOption, mode = 'default' }: FloatingChatMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const toast = useToast();
  const mainScale = useSharedValue(1);
  const progress = useSharedValue(0);
  const options = CHAT_OPTIONS(mode);

  const toggleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !expanded;
    setExpanded(next);
    progress.value = withSpring(next ? 1 : 0, { damping: 18, stiffness: 260 });
  };

  const closeMenu = () => {
    setExpanded(false);
    progress.value = withSpring(0, { damping: 18, stiffness: 260 });
  };

  const handleSelect = (id: 'ai' | 'staff' | 'inbox') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeMenu();
    if (onSelectOption) {
      onSelectOption(id);
      return;
    }
    if (id === 'ai') toast.info('Đang kết nối Trợ lý AI...');
    else if (id === 'inbox') toast.info('Mở hộp thư...');
    else toast.info('Đang kết nối Cán bộ hỗ trợ...');
  };

  const mainButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mainScale.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 0,
    pointerEvents: expanded ? 'auto' : 'none',
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [20, -92]) },
      { translateX: interpolate(progress.value, [0, 1], [20, -8]) },
      { scale: interpolate(progress.value, [0, 1], [0.88, 1]) },
    ],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.rootContainer, { bottom: bottomOffset }]}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMenu} />
      </Animated.View>

      <Animated.View pointerEvents={expanded ? 'auto' : 'none'} style={[styles.menuPanel, panelStyle]}>
        {options.map((option, index) => (
          <ChatOption
            key={option.id}
            option={option}
            showDivider={index === 0}
            onPress={() => handleSelect(option.id as any)}
          />
        ))}
      </Animated.View>

      <Animated.View style={[styles.fabShell, mainButtonStyle]}>
        <Pressable
          onPress={toggleMenu}
          onPressIn={() => {
            mainScale.value = withSpring(0.92, { damping: 14, stiffness: 360 });
          }}
          onPressOut={() => {
            mainScale.value = withSpring(1, { damping: 14, stiffness: 360 });
          }}
          style={styles.fabButton}
          accessibilityRole="button"
          accessibilityLabel="Mở menu trợ lý đô thị"
        >
          <Icon name={expanded ? 'x' : 'message-circle'} size={24} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ChatOption({
  option,
  showDivider,
  onPress,
}: {
  option: ReturnType<typeof CHAT_OPTIONS>[number];
  showDivider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, showDivider && styles.optionDivider, pressed && styles.pressedRow]}
      accessibilityLabel={option.label}
    >
      <View style={[styles.optionIconBadge, { backgroundColor: option.bg }]}>
        <Icon name={option.icon as any} size={22} color={option.color} />
      </View>
      <View style={styles.optionTextContainer}>
        <Text style={styles.optionTitle} numberOfLines={1}>
          {option.label}
        </Text>
        <Text style={styles.optionSub} numberOfLines={1}>
          {option.sub}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  backdrop: {
    position: 'absolute',
    right: -24,
    bottom: -24,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'transparent',
  },
  menuPanel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 252,
    borderRadius: 28,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 12,
  },
  optionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 8,
  },
  optionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 4,
    paddingBottom: 13,
  },
  pressedRow: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  optionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'Geist-SemiBold',
    color: '#0F172A',
  },
  optionSub: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Geist-Regular',
    color: semantics.text.muted,
    marginTop: 2,
  },
  fabShell: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 10,
  },
  fabButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.92)',
  },
});

export default FloatingChatMenu;
