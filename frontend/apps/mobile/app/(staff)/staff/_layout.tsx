import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { StaffHeaderBackButton, staffStackOptions } from '@/features/staff/components/staff-ui';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function StaffWorkspaceLayout() {
  const router = useRouter();
  // Native Stack owns the top system inset. Staff content only adds top safe
  // area when no header is present; do not wrap this navigator in SafeAreaView.
  // Use an app-owned vector instead of the platform font glyph so the back
  // affordance remains visible on Android OEM fonts and React Native Web.
  return <Stack screenOptions={{ ...staffStackOptions, headerBackVisible: false, headerLeft: () => <StaffHeaderBackButton onPress={() => router.back()} /> }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="incidents/[id]" options={{ title: 'Chi tiết sự vụ' }} />
    <Stack.Screen name="incidents/[id]/execution" options={{ title: 'Xử lý sự vụ' }} />
    <Stack.Screen name="incidents/[id]/provider" options={{ title: 'Đơn vị xử lý & liên hệ' }} />
    <Stack.Screen name="incidents/[id]/resolution" options={{ title: 'Minh chứng & kết quả' }} />
    <Stack.Screen name="feedbacks/[id]" options={{ title: 'Chi tiết Report' }} />
    <Stack.Screen name="feedbacks/[id]/chat" options={{ title: 'Trao đổi phản ánh' }} />
    <Stack.Screen name="notifications" options={{ title: 'Thông báo' }} />
  </Stack>;
}
