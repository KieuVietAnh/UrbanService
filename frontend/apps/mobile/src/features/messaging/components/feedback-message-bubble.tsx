import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { semantics } from '@/theme/semantics';
import type { ChatMessage } from '../types/messaging.types';

export type { ChatMessage, SenderType } from '../types/messaging.types';

const formatTime = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const sender = msg.senderType ?? msg.senderRole ?? msg.sender ?? 'System';
  const senderRaw = String(sender ?? msg.senderName ?? '').toLowerCase();
  const senderNorm = senderRaw.replace(/[^a-z0-9]/g, '');
  const isResident = /service|serviceuser|service_user|service-user|resident|user/.test(senderNorm);
  const isSystem = sender === 'System' || sender === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <View style={styles.systemChip}>
          <Text style={styles.systemText}>{msg.messageText}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.row, isResident ? styles.rowRight : styles.rowLeft]}>
      {!isResident && <View style={styles.avatarPlaceholder} />}
      <View style={[styles.bubble, isResident ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={styles.sender}>{isResident ? 'Bạn' : (msg.senderName ?? 'Cán bộ')}</Text>
        <Text style={[styles.text, isResident && styles.textOwn]}>{msg.messageText}</Text>
        <Text style={[styles.time, isResident && styles.timeOwn]}>{formatTime(msg.createdAt)}</Text>
      </View>
      {isResident && <View style={styles.avatarPlaceholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6, paddingHorizontal: 12 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: semantics.bg.surfaceSubtle, marginHorizontal: 8 },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: semantics.bg.primary, alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: semantics.border.default, alignSelf: 'flex-start' },
  sender: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: semantics.text.muted, marginBottom: 4 },
  text: { fontSize: 14, fontFamily: 'Geist-Regular', color: semantics.text.primary, lineHeight: 20 },
  textOwn: { color: semantics.text.inverse },
  time: { fontSize: 10, color: semantics.text.lightMuted, marginTop: 6, alignSelf: 'flex-end' },
  timeOwn: { color: 'rgba(255,255,255,0.8)' },
  systemWrap: { alignItems: 'center', marginVertical: 8 },
  systemChip: { backgroundColor: semantics.bg.surfaceSubtle, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  systemText: { color: semantics.text.muted, fontSize: 12 },
});

export default memo(MessageBubble);
