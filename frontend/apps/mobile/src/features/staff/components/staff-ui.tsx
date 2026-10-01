import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { Stack, Link, type Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { getStatusIntent } from '@urbanmind/shared-types';
import { rawColors } from '@/theme/colors';
import { staffError } from '../staff-api';
import { getStaffLineHeight, STAFF_FIXED_CHROME_MAX_FONT_SCALE } from '../staff-layout';
import { formatDate, priorityLabel, recordCode, severityLabel, statusLabel, type StaffPage, type StaffRecord } from '../staff-models';

// Staff-only tokens: preserve UrbanMind's identity without changing Resident UI.
export const colors = {
  ...rawColors,
  background: '#F5F7FB',
  surfaceMuted: '#F8FAFD',
  muted: '#566579',
  border: '#E3E8F0',
  inkSoft: '#24344A',
};
export const contentStyle = { padding: 20, paddingBottom: 36, gap: 22, width: '100%' as const, maxWidth: 760, alignSelf: 'center' as const };
export const panelStyle = {
  padding: 18,
  gap: 14,
  backgroundColor: colors.surface,
  borderRadius: 20,
  borderCurve: 'continuous' as const,
  borderWidth: 1,
  borderColor: colors.border,
  shadowColor: '#17345F',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.055,
  shadowRadius: 12,
  elevation: 2,
};
function StaffHeaderTitle({ children, tintColor }: { children: string; tintColor?: string }) {
  return <Text
    accessibilityRole="header"
    allowFontScaling
    maxFontSizeMultiplier={STAFF_FIXED_CHROME_MAX_FONT_SCALE}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.78}
    style={{ minWidth: 0, flexShrink: 1, color: tintColor || colors.text, fontFamily: 'Geist-SemiBold', fontSize: 17 }}
  >{children}</Text>;
}

export const staffStackOptions = { headerTitle: StaffHeaderTitle, headerTitleStyle: { fontFamily: 'Geist-SemiBold', fontSize: 17 }, headerTintColor: colors.text, headerStyle: { backgroundColor: colors.surface }, statusBarStyle: 'dark' as const, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } };

export function StaffTabStack() { return <Stack screenOptions={staffStackOptions} />; }
export function Label({ children, muted = false, size = 15, bold = false, style, allowFontScaling = true, maxFontSizeMultiplier, ...props }: Omit<TextProps, 'style'> & { muted?: boolean; size?: number; bold?: boolean; style?: StyleProp<TextStyle> }) {
  const { fontScale } = useWindowDimensions();
  const lineHeight = getStaffLineHeight({ fontSize: size, fontScale, allowFontScaling, maxFontSizeMultiplier });
  return <Text selectable allowFontScaling={allowFontScaling} maxFontSizeMultiplier={maxFontSizeMultiplier} {...props} style={[{ minWidth: 0, flexShrink: 1, color: muted ? colors.muted : colors.text, fontSize: size, lineHeight, fontFamily: bold ? 'Geist-SemiBold' : 'Geist-Regular' }, style]}>{children}</Text>;
}
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 14, minWidth: 0 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 4, height: 20, borderRadius: 3, backgroundColor: colors.primary }} /><Label accessibilityRole="header" size={18} bold style={{ color: colors.inkSoft }}>{title}</Label></View>{children}</View>;
}

export function PageHeading({ eyebrow, title, description, accessory }: { eyebrow?: string; title: string; description?: string; accessory?: React.ReactNode }) {
  return <View style={{ gap: 10, minWidth: 0 }}>{eyebrow && <Label muted bold size={12} style={{ letterSpacing: 0.6 }}>{eyebrow}</Label>}
    <Label accessibilityRole="header" size={26} bold style={{ letterSpacing: -0.5 }}>{title}</Label>
    {accessory}{description && <Label muted size={14}>{description}</Label>}
  </View>;
}

export function BackLink({ href, label, forward = false }: { href: Href; label: string; forward?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return <Link href={href} asChild><Pressable accessibilityRole="link" accessibilityLabel={label} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={{ minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingVertical: 10, opacity: pressed ? 0.6 : 1 }}><Label size={14} bold style={{ color: colors.primary }}>{forward ? label + ' →' : '← ' + label}</Label></Pressable></Link>;
}

export function NavigationRow({ href, label, description, icon = 'arrow', primary = false }: { href: Href; label: string; description?: string; icon?: StaffIconName; primary?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return <Link href={href} asChild><Pressable accessibilityRole="link" accessibilityLabel={label} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={{ ...panelStyle, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: primary || pressed ? colors.primarySoft : colors.surface, borderColor: primary ? colors.primaryMuted : colors.border }}>
    {icon !== 'arrow' && <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><StaffIcon name={icon} size={21} /></View>}
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Label bold size={15} style={{ color: primary ? colors.primaryDark : colors.text }}>{label}</Label>{description && <Label muted size={13}>{description}</Label>}</View><StaffIcon name="arrow" size={18} />
  </Pressable></Link>;
}

export function Segments<T extends string>({ options, value, onChange, disabled = false }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; disabled?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  // Stack labels at accessibility sizes instead of squeezing or truncating them.
  const stacked = (width - 40) / fontScale < 260;
  return <View accessibilityRole="tablist" style={{ flexDirection: stacked ? 'column' : 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: '#E9EDF4' }}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)} android_ripple={{ color: colors.border }} style={{ flex: stacked ? undefined : 1, minWidth: 0, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: value === option.value ? colors.surface : 'transparent', borderWidth: 1, borderColor: value === option.value ? colors.border : 'transparent' }}><Label selectable={false} bold size={13} style={{ color: value === option.value ? colors.primaryDark : colors.muted, textAlign: 'center' }}>{option.label}</Label></Pressable>)}
  </View>;
}

const icons = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  incidents: 'M9 4H5v17h14V4h-4M9 3h6v4H9ZM8 12h8M8 16h5',
  feedbacks: 'M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6',
  chat: 'M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0ZM8 10h8M8 14h5',
  account: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  back: 'm15 5-7 7 7 7',
  arrow: 'm9 5 7 7-7 7',
  check: 'm4 12 5 5L20 6',
  send: 'm22 2-7 20-4-9-9-4ZM22 2 11 13',
} as const;
export type StaffIconName = keyof typeof icons;
export function StaffIcon({ name, color = colors.primary, size = 24 }: { name: StaffIconName; color?: string; size?: number }) {
  return <Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={icons[name]} /></Svg>;
}

export function StaffHeaderBackButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={4} onPress={onPress} android_ripple={{ color: colors.primarySoft, borderless: true }}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
    <StaffIcon name="back" color={colors.text} size={25} />
  </Pressable>;
}

export function Button({ label, onPress, disabled, busy, secondary, danger }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const background = secondary ? colors.surface : danger ? colors.redDark : colors.primary;
  const foreground = secondary ? colors.primary : '#FFFFFF';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    android_ripple={{ color: secondary ? colors.primarySoft : 'rgba(255,255,255,0.24)' }} style={{ minHeight: 52, minWidth: 0, flexShrink: 0, overflow: 'hidden', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: background, borderWidth: 1, borderColor: secondary ? colors.borderStrong : background, opacity: disabled && !busy ? 0.5 : 1 }}>
    {busy && <ActivityIndicator color={foreground} />}<Text style={{ flexShrink: 1, minWidth: 0, fontFamily: 'Geist-SemiBold', fontSize: 14, lineHeight: getStaffLineHeight({ fontSize: 14, fontScale }), color: foreground, textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  const { fontScale } = useWindowDimensions();
  return <View style={{ gap: 8, minWidth: 0 }}><Label bold size={13}>{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} selectionColor={colors.primary} underlineColorAndroid="transparent" {...props}
    onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
    style={[{ minWidth: 0, minHeight: props.multiline ? 112 : 52, padding: 14, fontSize: 16, lineHeight: getStaffLineHeight({ fontSize: 16, fontScale, ratio: 1.5, allowFontScaling: props.allowFontScaling, maxFontSizeMultiplier: props.maxFontSizeMultiplier }), fontFamily: 'Geist-Regular', color: colors.text, borderRadius: 12, borderWidth: 1, borderColor: focused ? colors.primary : colors.borderStrong, backgroundColor: props.editable === false ? colors.borderLight : colors.surface, textAlignVertical: props.multiline ? 'top' : 'center' }, props.style]} /></View>;
}
export function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <View accessibilityRole={error ? 'alert' : undefined} style={{ padding: 16, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: error ? colors.redDark : colors.primary, backgroundColor: error ? colors.redLight : colors.primarySoft }}><Label style={{ color: error ? colors.redDark : colors.primaryDark }} size={14}>{children}</Label></View>;
}
export function QueryState({ pending, error, empty, retry }: { pending?: boolean; error?: unknown; empty?: string | false; retry: () => void }) {
  if (pending) return <View accessibilityRole="progressbar" accessibilityLabel="Đang tải dữ liệu" style={{ ...panelStyle, padding: 18, gap: 12, backgroundColor: colors.surfaceMuted }}>
    <View style={{ width: '42%', height: 12, borderRadius: 6, backgroundColor: colors.primaryMuted }} />
    <View style={{ width: '88%', height: 10, borderRadius: 5, backgroundColor: colors.border }} />
    <View style={{ width: '68%', height: 10, borderRadius: 5, backgroundColor: colors.borderLight }} />
    <Label muted size={12}>Đang tải dữ liệu…</Label>
  </View>;
  if (error) return <View style={{ gap: 12 }}><Notice error>{staffError(error)}</Notice><Button label="Thử lại" onPress={retry} secondary /></View>;
  if (empty) return <View style={{ ...panelStyle, padding: 26, gap: 10, alignItems: 'center', backgroundColor: colors.surfaceMuted, borderStyle: 'dashed', shadowOpacity: 0, elevation: 0 }}><View style={{ width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}><StaffIcon name="incidents" size={25} color={colors.primary} /></View><Label muted style={{ textAlign: 'center' }}>{empty}</Label></View>;
  return null;
}
export function Status({ value }: { value: string }) {
  const tones: Record<string, { background: string; foreground: string }> = {
    info: { background: colors.primarySoft, foreground: colors.primaryDark },
    warning: { background: colors.amberLight, foreground: colors.amberDark },
    danger: { background: colors.redLight, foreground: colors.redDark },
    success: { background: colors.emeraldLight, foreground: colors.emeraldDark },
    neutral: { background: colors.borderLight, foreground: colors.textSecondary },
  };
  const tone = tones[getStatusIntent(value)] || tones.neutral;
  return <View style={{ alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 1, backgroundColor: tone.background, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 }}><Label size={12} bold style={{ color: tone.foreground }}>{statusLabel(value)}</Label></View>;
}
export function Severity({ value }: { value: string }) {
  return <Label size={12} bold style={{ color: ['high', 'critical'].includes(value.toLowerCase()) ? colors.redDark : colors.textSecondary }}>Mức độ: {severityLabel(value)}</Label>;
}
export function RecordCard({ item, incident = false, chat = false }: { item: StaffRecord; incident?: boolean; chat?: boolean }) {
  const href = `/(staff)/staff/${incident ? 'incidents' : 'feedbacks'}/${encodeURIComponent(item.id)}${chat ? '/chat' : ''}` as Href;
  const [pressed, setPressed] = useState(false);
  const accent = ({ info: colors.primary, warning: colors.amberDark, danger: colors.redDark, success: colors.emeraldDark, neutral: colors.borderStrong } as const)[getStatusIntent(item.status)] || colors.borderStrong;
  return <Link href={href} asChild><Pressable accessibilityRole="button" accessibilityLabel={`${chat ? 'Trao đổi: ' : ''}${item.title}`} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={{ ...panelStyle, borderColor: pressed ? colors.primary : colors.border, borderLeftWidth: 4, borderLeftColor: accent, backgroundColor: pressed ? colors.primarySoft : colors.surface }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Label size={12} muted bold>{recordCode(item.id, incident)}</Label><Status value={item.status} /></View>
    <Label bold size={17}>{item.title}</Label>
    {incident && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Severity value={item.severity} /><Label muted size={12}>{item.reportCount !== null ? `${item.reportCount} phản ánh` : 'Chưa có số phản ánh'}</Label></View>}
    {item.areaName ? <Label muted size={13}>{item.areaName}{item.category ? ` · ${item.category}` : ''}</Label> : item.category ? <Label muted size={13}>{item.category}</Label> : null}
    <Label muted size={13}>{item.location || 'Chưa có vị trí'}</Label>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', borderTopWidth: 1, borderColor: colors.borderLight, paddingTop: 12 }}><View style={{ flex: 1, minWidth: 0 }}><Label muted size={12}>{chat ? item.reporter || 'Trao đổi với người dân' : `Ưu tiên: ${priorityLabel(item.priority)}`}</Label><Label muted size={12}>{formatDate(item.updatedAt || item.createdAt)}</Label></View><StaffIcon name={chat ? 'chat' : 'arrow'} size={20} /></View>
  </Pressable></Link>;
}
export function Pagination({ page, busy, onChange }: { page?: StaffPage<unknown>; busy: boolean; onChange: (page: number) => void }) {
  if (!page || page.totalPages <= 1) return null;
  return <View style={{ gap: 10 }}><Label muted size={13} style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>Trang {page.pageNumber} / {page.totalPages} · {page.totalItems} hồ sơ</Label>
    <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Button secondary label="Trang trước" disabled={busy || page.pageNumber <= 1} onPress={() => onChange(page.pageNumber - 1)} /></View><View style={{ flex: 1 }}><Button secondary label="Trang sau" disabled={busy || !page.hasNextPage} onPress={() => onChange(page.pageNumber + 1)} /></View></View>
  </View>;
}
export function Filters({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const { fontScale } = useWindowDimensions();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)} android_ripple={{ color: colors.primarySoft }} style={{ minHeight: 48, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: value === option.value ? colors.primary : colors.surface, borderWidth: 1, borderColor: value === option.value ? colors.primary : colors.border }}><Text style={{ fontSize: 13, lineHeight: getStaffLineHeight({ fontSize: 13, fontScale, ratio: 20 / 13 }), fontFamily: 'Geist-Medium', color: value === option.value ? '#FFFFFF' : colors.textSecondary }}>{option.label}</Text></Pressable>)}
  </ScrollView>;
}
