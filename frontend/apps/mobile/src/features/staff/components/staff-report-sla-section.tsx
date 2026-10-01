import React from 'react';
import { View } from 'react-native';
import {
  formatSlaRemaining,
  slaStatusLabel,
  type StaffIncidentSlaStatus,
  type StaffSlaMetric,
} from '../staff-sla-models';
import { useStaffIncidentSlaQuery } from '../staff-sla-query';
import {
  Label,
  Notice,
  QueryState,
  Section,
  colors,
  panelStyle,
} from './staff-ui';

type StaffIncidentSlaSectionProps = {
  userId: string;
  incidentId: string;
};

const formatDueAt = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return 'Chưa có thời hạn';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function SlaBadge({ data }: { data: StaffIncidentSlaStatus }) {
  const breached = data.response.breached || data.resolution.breached;
  const warning = data.response.warning || data.resolution.warning;
  const backgroundColor = breached
    ? colors.redLight
    : warning
      ? colors.amberLight
      : colors.primarySoft;
  const color = breached
    ? colors.redDark
    : warning
      ? colors.amberDark
      : colors.primaryDark;

  return <View style={{ alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 8, backgroundColor, paddingHorizontal: 10, paddingVertical: 5 }}>
    <Label bold size={12} style={{ color }}>
      {breached ? 'Có chỉ tiêu vi phạm' : warning ? 'Có chỉ tiêu sắp đến hạn' : slaStatusLabel(data.status)}
    </Label>
  </View>;
}

function MetricProgress({ metric }: { metric: StaffSlaMetric }) {
  const percent = metric.progressPercent;
  const progress = percent ?? 0;
  const completed = ['completed', 'resolved', 'met', 'done']
    .includes(metric.status.replace(/[\s_-]/g, '').toLowerCase());
  const tone = metric.breached
    ? colors.red
    : metric.warning
      ? colors.amber
      : colors.primary;
  const stateLabel = metric.breached
    ? 'Vi phạm'
    : metric.warning
      ? 'Sắp đến hạn'
      : slaStatusLabel(metric.status);

  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Label bold size={13}>{stateLabel}</Label>
      <Label bold size={13} style={{ color: tone, fontVariant: ['tabular-nums'] }}>
        {completed
          ? metric.breached ? 'Hoàn thành quá hạn' : 'Hoàn thành đúng hạn'
          : formatSlaRemaining(metric.remainingSeconds, metric.breached)}
      </Label>
    </View>
    {percent !== null && <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Tiến độ SLA ${Math.round(percent)} phần trăm`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      style={{ height: 8, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.borderLight }}
    >
      <View style={{ height: '100%', width: `${progress}%`, borderRadius: 999, backgroundColor: tone }} />
    </View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
      <Label muted size={12}>Hạn: {formatDueAt(metric.dueAt)}</Label>
      {percent !== null && <Label muted size={12} style={{ fontVariant: ['tabular-nums'] }}>{Math.round(percent)}%</Label>}
    </View>
  </View>;
}

export function StaffIncidentSlaSection({
  userId,
  incidentId,
}: StaffIncidentSlaSectionProps) {
  const query = useStaffIncidentSlaQuery({ userId, incidentId });
  const retry = () => { void query.refetch(); };

  return <Section title="SLA của sự vụ">
    <Label muted size={13}>
      Mốc phản hồi và hoàn thành được backend tính cho toàn bộ sự vụ.
    </Label>
    {!userId.trim() ? <Notice error>Không xác định được phiên Staff để tải SLA.</Notice> : !incidentId.trim() ? <Notice>Report này chưa được liên kết với sự vụ nên chưa có SLA sự vụ.</Notice> : <>
      <QueryState pending={query.isPending} error={query.error} retry={retry} />
      {!query.isPending && !query.error && !query.data ? <Notice>Sự vụ này chưa có SLA đang áp dụng.</Notice> : null}
      {query.data ? <View style={{ ...panelStyle, gap: 16 }}>
        <SlaBadge data={query.data} />
        <View style={{ gap: 10 }}>
          <Label bold size={14}>Phản hồi lần đầu</Label>
          <MetricProgress metric={query.data.response} />
        </View>
        <View style={{ height: 1, backgroundColor: colors.borderLight }} />
        <View style={{ gap: 10 }}>
          <Label bold size={14}>Hoàn thành xử lý</Label>
          <MetricProgress metric={query.data.resolution} />
        </View>
        {query.isFetching ? <Label muted size={12}>Đang cập nhật dữ liệu SLA…</Label> : null}
      </View> : null}
    </>}
  </Section>;
}
