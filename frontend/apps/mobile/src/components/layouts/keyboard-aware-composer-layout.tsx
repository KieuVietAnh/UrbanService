import React from 'react';
import {
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';

interface KeyboardAwareComposerLayoutProps {
  children: React.ReactNode;
  composer: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;

  /**
   * Khi true, vùng content sẽ co lại tương ứng
   * với vị trí thực tế của composer.
   *
   * Dùng cho chat để message cuối không bị
   * composer/keyboard che.
   */
  avoidContentOverlap?: boolean;
}

export function KeyboardAwareComposerLayout({
  children,
  composer,
  style,
  contentStyle,
  avoidContentOverlap = false,
}: KeyboardAwareComposerLayoutProps) {
  const insets = useSafeAreaInsets();

  const keyboardHeight =
    useSharedValue(0);

  const keyboardProgress =
    useSharedValue(0);

  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';

        keyboardHeight.value =
          event.height;

        keyboardProgress.value =
          event.progress;
      },

      onEnd: (event) => {
        'worklet';

        keyboardHeight.value =
          event.height;

        keyboardProgress.value =
          event.progress;
      },
    },
    [],
  );

  /**
   * Composer:
   *
   * Keyboard đóng:
   *   height = 0
   *   progress = 0
   *
   *   translateY = -insets.bottom
   *
   * Keyboard mở:
   *   height ≈ keyboard height
   *   progress = 1
   *
   *   translateY = -keyboardHeight
   */
  const composerAnimatedStyle =
    useAnimatedStyle(() => {
      const restingInset =
        (1 -
          keyboardProgress.value) *
        insets.bottom;

      const offset =
        keyboardHeight.value +
        restingInset;

      return {
        transform: [
          {
            translateY: -offset,
          },
        ],
      };
    }, [insets.bottom]);

  /**
   * Transform của composer không ảnh hưởng
   * layout của content.
   *
   * Vì vậy khi cần, thêm paddingBottom bằng
   * đúng khoảng composer đã dịch lên.
   */
  const contentAnimatedStyle =
    useAnimatedStyle(() => {
      if (!avoidContentOverlap) {
        return {
          paddingBottom: 0,
        };
      }

      const restingInset =
        (1 -
          keyboardProgress.value) *
        insets.bottom;

      const offset =
        keyboardHeight.value +
        restingInset;

      return {
        paddingBottom: offset,
      };
    }, [
      avoidContentOverlap,
      insets.bottom,
    ]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.content,
          contentStyle,
          contentAnimatedStyle,
        ]}
      >
        {children}
      </Animated.View>

      <Animated.View
        style={[
          styles.composer,
          composerAnimatedStyle,
        ]}
      >
        {composer}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    flex: 1,
  },

  composer: {
    alignSelf: 'stretch',
  },
});

export default KeyboardAwareComposerLayout;