import React from 'react';
import { Platform, Text, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, StaffIcon } from '@/features/staff/components/staff-ui';
import { getStaffTabLayout } from '@/features/staff/staff-layout';

const labels: Record<string, string> = {
  home: 'Tổng quan',
  incidents: 'Sự vụ',
  feedbacks: 'Tra cứu',
  conversations: 'Trao đổi',
  account: 'Tài khoản',
};

export default function StaffTabs() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const layout = getStaffTabLayout({ width, fontScale, insets });
  // The browser compatibility harness enlarges text through CSS, which does
  // not update React Native Web's fontScale. Reserve the two-line label box on
  // web; native Android continues to use its measured fontScale and safe area.
  const height = (Platform.OS === 'web' ? Math.max(100, layout.controlHeight) : layout.controlHeight) + insets.bottom;

  return <Tabs initialRouteName="home" screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarActiveBackgroundColor: colors.primarySoft,
    tabBarAllowFontScaling: true,
    tabBarLabelPosition: 'below-icon',
    tabBarHideOnKeyboard: true,
    tabBarItemStyle: { minWidth: 48, minHeight: 48, marginHorizontal: 2, marginVertical: 4, paddingHorizontal: 2, paddingTop: 3, borderRadius: 14, overflow: 'hidden' },
    tabBarStyle: { height, paddingTop: 3, paddingBottom: insets.bottom + 3, paddingHorizontal: 4, borderTopColor: colors.border, backgroundColor: colors.surface, shadowColor: '#17345F', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
    tabBarLabel: ({ color }) => <Text allowFontScaling maxFontSizeMultiplier={layout.labelFontScale} numberOfLines={2} style={{ width: '100%', minWidth: 0, textAlign: 'center', color, fontFamily: 'Geist-Medium', fontSize: 11, lineHeight: layout.labelLineHeight }}>{labels[route.name] || route.name}</Text>,
  })}>
    <Tabs.Screen name="home" options={{ title: labels.home, tabBarAccessibilityLabel: labels.home, tabBarIcon: ({ color, size }) => <StaffIcon name="home" color={color} size={size} /> }} />
    <Tabs.Screen name="incidents" options={{ title: labels.incidents, tabBarAccessibilityLabel: labels.incidents, tabBarIcon: ({ color, size }) => <StaffIcon name="incidents" color={color} size={size} /> }} />
    <Tabs.Screen name="feedbacks" options={{ title: labels.feedbacks, tabBarAccessibilityLabel: labels.feedbacks, tabBarIcon: ({ color, size }) => <StaffIcon name="feedbacks" color={color} size={size} /> }} />
    <Tabs.Screen name="conversations" options={{ title: labels.conversations, tabBarAccessibilityLabel: labels.conversations, tabBarIcon: ({ color, size }) => <StaffIcon name="chat" color={color} size={size} /> }} />
    <Tabs.Screen name="account" options={{ title: labels.account, tabBarAccessibilityLabel: labels.account, tabBarIcon: ({ color, size }) => <StaffIcon name="account" color={color} size={size} /> }} />
  </Tabs>;
}
