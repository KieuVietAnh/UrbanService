import Icon from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppCard, Text, TicketStatusBadge } from '@/components/ui';
import { getResidentStatusLabel } from '@/features/resident-status';
import { colors } from '@/constants/theme';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
import { fontSizes, fonts } from '@/theme/typography';

export interface TicketCardProps {
  ticket: any;
  onPress: () => void;
}

export function TicketCard({ ticket, onPress }: TicketCardProps) {
  const createdAt = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('vi-VN')
    : '';

  const priority = String(ticket.priority ?? 'Medium').toLowerCase();
  const priorityMap: Record<string, { label: string; color: string; bg: string }> = {
    urgent: { label: 'Khẩn cấp', color: '#DC2626', bg: '#FEE2E2' },
    high: { label: 'Cao', color: '#EA580C', bg: '#FED7AA' },
    medium: { label: 'Trung bình', color: '#B45309', bg: '#FDE68A' },
    low: { label: 'Thấp', color: '#047857', bg: '#A7F3D0' },
  };
  const priorityInfo = priorityMap[priority] ?? {
    label: 'Trung bình',
    color: '#B45309',
    bg: '#FDE68A',
  };

  return (
    <Pressable onPress={onPress} style={styles.ticketListItem}>
      <AppCard shadow="sm">
        <View style={styles.ticketCardContent}>
          <View style={styles.ticketTopRow}>
            <Text style={styles.ticketTitle} numberOfLines={2}>
              {ticket.title ?? 'Chưa có tiêu đề'}
            </Text>
            <TicketStatusBadge status={ticket.status ?? 'PENDING'} label={getResidentStatusLabel(ticket.status)} size="sm" />
          </View>

          {ticket.categoryName && (
            <View style={styles.categoryRow}>
              <Icon name="tag" size={12} color={colors.muted} />
              <Text style={styles.categoryText}>{ticket.categoryName}</Text>
            </View>
          )}

          <View style={styles.locationRow}>
            <Icon name="map-pin" size={12} color={colors.muted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {ticket.locationText ?? 'Không có địa chỉ'}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.dateRow}>
              <Icon name="calendar" size={11} color={colors.lightMuted} />
              <Text style={styles.dateText}>{createdAt}</Text>
            </View>
            <View style={styles.priorityRow}>
              <View style={[styles.priorityDot, { backgroundColor: priorityInfo.color }]} />
              <View style={[styles.priorityPill, { backgroundColor: priorityInfo.bg }]}>
                <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                  {priorityInfo.label}
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.primary} />
            </View>
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticketListItem: {
    marginBottom: spacing['3'],
    marginHorizontal: spacing['5'],
  },
  ticketCardContent: {
    padding: spacing['3.5'],
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['2'],
  },
  ticketTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing['2'],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    marginBottom: 9,
  },
  categoryText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    marginBottom: spacing['2.5'],
  },
  locationText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing['2.5'],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
  },
  dateText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes['2xs'],
    color: colors.lightMuted,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: radius['pill'],
  },
  priorityPill: {
    borderRadius: radius['pill'],
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
  },
  priorityText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes['2xs'],
  },
});

export default TicketCard;
