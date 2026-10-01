import React, { forwardRef, useContext } from 'react';
import { ScrollView, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { HeaderShownContext } from '@react-navigation/elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStaffContentLayout, type StaffContentOptions } from '../staff-layout';
import { colors, contentStyle } from './staff-ui';

/** Also usable by FlatList without nesting a virtualized list in a ScrollView. */
export function useStaffContentInsets(options: StaffContentOptions = {}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const headerShown = useContext(HeaderShownContext);
  const layout = getStaffContentLayout({
    ...options, width, insets, bottomInsetConsumed: (tabBarHeight ?? 0) > 0,
    headerShown, platform: process.env.EXPO_OS,
  });
  return {
    contentContainerStyle: {
      width: '100%' as const,
      maxWidth: undefined,
      alignSelf: 'stretch' as const,
      paddingTop: layout.paddingTop,
      paddingLeft: layout.paddingLeft,
      paddingRight: layout.paddingRight,
      paddingBottom: layout.paddingBottom,
    },
    scrollIndicatorInsets: { top: 0, left: insets.left, right: insets.right, bottom: layout.bottomInset },
    contentInsetAdjustmentBehavior: layout.contentInsetAdjustmentBehavior,
  };
}

export type StaffScrollViewProps = ScrollViewProps & StaffContentOptions & {
  /** Native forms use the existing KeyboardProvider, not a second avoidance layer. */
  keyboardAware?: boolean;
};

export const StaffScrollView = forwardRef<ScrollView, StaffScrollViewProps>(function StaffScrollView({
  keyboardAware = true, bottomSafeArea, contentMaxWidth, contentGutter, extraBottomSpace,
  contentContainerStyle, style, children, ...props
}, ref) {
  const layout = useStaffContentInsets({ bottomSafeArea, contentMaxWidth, contentGutter, extraBottomSpace });
  const commonProps: ScrollViewProps = {
    keyboardShouldPersistTaps: 'handled',
    keyboardDismissMode: process.env.EXPO_OS === 'ios' ? 'interactive' : 'on-drag',
    ...layout,
    ...props,
    style: [{ flex: 1, backgroundColor: colors.background }, style],
    contentContainerStyle: [contentStyle, contentContainerStyle, layout.contentContainerStyle],
  };
  // Web already scrolls the focused field into the visual viewport. Native
  // keyboard-controller measures the caret in window coordinates, which already
  // includes the native header: adding useHeaderHeight() here would count it twice.
  if (process.env.EXPO_OS === 'web' || !keyboardAware) {
    return <ScrollView ref={ref} {...commonProps}>{children}</ScrollView>;
  }
  return <KeyboardAwareScrollView ref={ref} bottomOffset={16} {...commonProps}>{children}</KeyboardAwareScrollView>;
});
