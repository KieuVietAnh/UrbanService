import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { staffError } from '../staff-api';
import { Button, colors, contentStyle, Label, NavigationRow, Notice, panelStyle, Section, StaffIcon } from './staff-ui';
import { StaffScrollView } from './staff-scroll-view';

export function StaffAccountScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const fullName = user?.fullName?.trim() || 'Nhân viên hệ thống';
  const email = user?.email?.trim() || 'Chưa có email';
  const signOut = useMutation({ mutationFn: logout });

  return <><Stack.Screen options={{ title: 'Tài khoản' }} />
    <StaffScrollView contentContainerStyle={contentStyle}>
      <View style={{ ...panelStyle, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors.primarySoft }}><StaffIcon name="account" size={27} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Label size={23} bold style={{ letterSpacing: -0.5 }}>{fullName}</Label><Label size={12} style={{ color: colors.primary }}>Nhân viên hệ thống · System Staff</Label></View>
        </View>
        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, gap: 16 }}>
          <View style={{ gap: 4 }}><Label muted size={12}>Email đăng nhập</Label><Label size={14}>{email}</Label></View>
          {user?.id ? <View style={{ gap: 4 }}><Label muted size={12}>Mã tài khoản</Label><Label size={13} style={{ fontVariant: ['tabular-nums'] }}>{user.id}</Label></View> : null}
        </View>
      </View>
      <Notice>Thông tin tài khoản nhân viên được quản trị tập trung. Vui lòng liên hệ quản trị viên khi cần thay đổi họ tên hoặc số điện thoại.</Notice>
      <NavigationRow href="/(staff)/staff/notifications" label="Thông báo công việc" icon="bell" />
      <Section title="Phiên đăng nhập">
        {confirmLogout ? <View style={panelStyle}><Label>Bạn muốn đăng xuất khỏi ứng dụng?</Label><Button label="Xác nhận đăng xuất" danger busy={signOut.isPending} onPress={() => signOut.mutate()} /><Button label="Ở lại" secondary disabled={signOut.isPending} onPress={() => setConfirmLogout(false)} /></View> : <Button label="Đăng xuất" danger onPress={() => setConfirmLogout(true)} />}
        {signOut.error && <Notice error>{staffError(signOut.error)}</Notice>}
      </Section>
    </StaffScrollView>
  </>;
}
