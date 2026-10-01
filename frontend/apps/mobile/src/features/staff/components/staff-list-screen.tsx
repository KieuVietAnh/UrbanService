import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { staffApi, staffKeys } from '../staff-api';
import { type StaffRecord } from '../staff-models';
import { colors, contentStyle, Field, Filters, Label, panelStyle, Pagination, QueryState, RecordCard } from './staff-ui';
import { useStaffContentInsets } from './staff-scroll-view';

type Mode = 'incidents' | 'feedbacks' | 'conversations';
type ListParams = { search: string; status: string; priority: string; severity: string; areaId: string; categoryId: string; pageNumber: number };
const emptyParams: ListParams = { search: '', status: '', priority: '', severity: '', areaId: '', categoryId: '', pageNumber: 1 };
const incidentStatuses = ['Assigned', 'InProgress', 'NeedRework', 'SubmittedForApproval', 'Resolved', 'Closed'];
const reportStatuses = ['Submitted', 'AiReviewed', 'Verified', 'Assigned', 'InProgress', 'SubmittedForApproval', 'NeedRework', 'Resolved', 'Closed', 'Rejected'];
const statusLabels: Record<string, string> = { Assigned: 'Được giao', InProgress: 'Đang xử lý', NeedRework: 'Cần làm lại', SubmittedForApproval: 'Chờ duyệt', Resolved: 'Đã xử lý', Closed: 'Đã đóng', Submitted: 'Mới gửi', AiReviewed: 'AI đã phân tích', Verified: 'Đã xác minh', Rejected: 'Từ chối' };
const priorityOptions = [{ value: '', label: 'Tất cả' }, { value: 'Critical', label: 'Khẩn cấp' }, { value: 'High', label: 'Cao' }, { value: 'Medium', label: 'Trung bình' }, { value: 'Low', label: 'Thấp' }];
const severityLabels: Record<string, string> = { Critical: 'Nghiêm trọng', High: 'Cao', Medium: 'Trung bình', Low: 'Thấp', Urgent: 'Khẩn cấp', Major: 'Lớn', Normal: 'Thông thường', Minor: 'Nhẹ' };

function FilterGroup({ title, value, options, onChange }: { title: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <View style={{ gap: 8 }} accessibilityLabel={title}><Label bold size={13}>{title}</Label><Filters value={value} options={options} onChange={onChange} /></View>;
}

export function StaffListScreen({ mode }: { mode: Mode }) {
  const layout = useStaffContentInsets();
  const userId = useAuthStore((state) => state.user?.id || '');
  const routeParams = useLocalSearchParams<{ status?: string | string[]; source?: string }>();
  const router = useRouter();
  const isIncident = mode === 'incidents';
  const allowedStatuses = isIncident ? incidentStatuses : reportStatuses;
  const rawStatus = Array.isArray(routeParams.status) ? routeParams.status[0] : routeParams.status;
  const routeStatus = rawStatus && allowedStatuses.includes(rawStatus) ? rawStatus : '';
  const [draftSearch, setDraftSearch] = useState('');
  const [params, setParams] = useState<ListParams>({ ...emptyParams, status: routeStatus });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const listRef = useRef<FlatList<StaffRecord>>(null);
  const reportParams = { search: params.search, status: params.status, pageNumber: params.pageNumber };
  const query = useQuery({
    queryKey: isIncident ? staffKeys.incidents(userId, params) : staffKeys.feedbacks(userId, reportParams),
    queryFn: ({ signal }) => isIncident ? staffApi.incidents(userId, params, signal) : staffApi.feedbacks(reportParams, signal),
    retry: 1,
  });
  const lookups = useQuery({
    queryKey: staffKeys.lookups(userId),
    queryFn: ({ signal }) => staffApi.lookups(signal),
    enabled: isIncident && advancedOpen,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  useEffect(() => {
    const timer = setTimeout(() => setParams((current) => current.search === draftSearch.trim() ? current : { ...current, search: draftSearch.trim(), pageNumber: 1 }), 350);
    return () => clearTimeout(timer);
  }, [draftSearch]);
  useEffect(() => { setParams((current) => current.status === routeStatus ? current : { ...current, status: routeStatus, pageNumber: 1 }); }, [routeStatus]);
  useEffect(() => {
    if (routeParams.source !== 'dashboard') return;
    // Dashboard totals describe a status group, not a previously filtered view.
    setDraftSearch(''); setParams({ ...emptyParams, status: routeStatus }); setAdvancedOpen(false);
    router.setParams({ source: '' });
  }, [routeParams.source, routeStatus, router]);
  useFocusEffect(useCallback(() => { void query.refetch(); }, [query.refetch]));

  const changeFilter = (key: Exclude<keyof ListParams, 'pageNumber'>, value: string) => {
    setParams((current) => ({ ...current, [key]: value, pageNumber: 1 }));
    if (key === 'status') router.setParams({ status: value });
  };
  const resetFilters = () => {
    setDraftSearch('');
    setParams({ ...emptyParams });
    router.setParams({ status: '' });
  };
  const changePage = (pageNumber: number) => { setParams((current) => ({ ...current, pageNumber })); listRef.current?.scrollToOffset({ offset: 0, animated: true }); };
  const titles: Record<Mode, string> = { incidents: 'Sự vụ của tôi', feedbacks: 'Tra cứu Report', conversations: 'Trao đổi' };
  const advancedCount = [params.priority, params.severity, params.areaId, params.categoryId].filter(Boolean).length;
  const hasFilters = Boolean(params.search || params.status || advancedCount);
  const severityValues = [...new Set(['Critical', 'High', 'Medium', 'Low', ...(query.data?.items.map((item) => item.severity).filter(Boolean) || []), params.severity].filter(Boolean))];
  return <>
    <Stack.Screen options={{ title: titles[mode] }} />
    <FlatList ref={listRef} data={query.data?.items.filter((item) => item.id) || []} keyExtractor={(item) => item.id} contentInsetAdjustmentBehavior={layout.contentInsetAdjustmentBehavior}
      style={{ backgroundColor: colors.background }} contentContainerStyle={[contentStyle, layout.contentContainerStyle, { gap: 0 }]} scrollIndicatorInsets={layout.scrollIndicatorInsets} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
      ListHeaderComponentStyle={{ paddingBottom: 18 }}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <Label muted size={13}>{isIncident ? 'Theo dõi các sự vụ được phân công cho bạn.' : mode === 'conversations' ? 'Chọn Report để trả lời người dân hoặc thêm ghi chú nội bộ.' : 'Xem thông tin phản ánh và sự vụ liên quan. Việc kiểm duyệt do Manager thực hiện.'}</Label>
        <Field label={isIncident ? 'Tìm kiếm sự vụ' : 'Tìm kiếm Report'} placeholder="Nhập tiêu đề hoặc nội dung…" value={draftSearch} onChangeText={setDraftSearch} returnKeyType="search" clearButtonMode="while-editing" />
        <Filters value={params.status} onChange={(status) => changeFilter('status', status)} options={[{ value: '', label: 'Tất cả' }, ...allowedStatuses.map((value) => ({ value, label: statusLabels[value] }))]} />
        {isIncident && <View style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Bộ lọc nâng cao" accessibilityState={{ expanded: advancedOpen }} onPress={() => setAdvancedOpen((value) => !value)} android_ripple={{ color: colors.primarySoft }} style={{ padding: 14, gap: 4, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Label bold size={14}>Bộ lọc nâng cao{advancedCount ? ` · ${advancedCount}` : ''}</Label></View><Label size={18} bold style={{ color: colors.primary }}>{advancedOpen ? '−' : '+'}</Label></View>
            <Label muted size={12}>Ưu tiên, mức độ, phường và danh mục</Label>
          </Pressable>
          {advancedOpen && <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 18 }}>
            <FilterGroup title="Mức ưu tiên" value={params.priority} options={priorityOptions} onChange={(value) => changeFilter('priority', value)} />
            <FilterGroup title="Độ nghiêm trọng" value={params.severity} options={[{ value: '', label: 'Tất cả' }, ...severityValues.map((value) => ({ value, label: severityLabels[value] || value }))]} onChange={(value) => changeFilter('severity', value)} />
            <QueryState pending={lookups.isPending} error={lookups.error} retry={() => { void lookups.refetch(); }} />
            {lookups.data && <>
              <FilterGroup title="Phường / Khu vực" value={params.areaId} options={[{ value: '', label: 'Tất cả' }, ...lookups.data.areas.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => changeFilter('areaId', value)} />
              {!lookups.data.areas.length && <Label muted size={12}>Chưa có khu vực để chọn.</Label>}
              <FilterGroup title="Danh mục" value={params.categoryId} options={[{ value: '', label: 'Tất cả' }, ...lookups.data.categories.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => changeFilter('categoryId', value)} />
              {!lookups.data.categories.length && <Label muted size={12}>Chưa có danh mục để chọn.</Label>}
            </>}
          </View>}
        </View>}
        {(query.data || hasFilters) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 12, rowGap: 4, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }}>
          {query.data && <View style={{ flexGrow: 1, flexShrink: 1, paddingVertical: 8 }}><Label muted size={13} style={{ fontVariant: ['tabular-nums'] }}>{query.data.totalItems} {isIncident ? 'sự vụ' : 'Report'}{query.isFetching ? ' · Đang cập nhật…' : ''}</Label></View>}
          {hasFilters && <Pressable accessibilityRole="button" accessibilityLabel="Xóa bộ lọc" onPress={resetFilters} android_ripple={{ color: colors.primarySoft, borderless: true }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'transparent' }}><Label bold size={13} style={{ color: colors.primary }}>Xóa bộ lọc</Label></Pressable>}
        </View>}
        <QueryState error={query.error} pending={query.isPending} retry={() => { void query.refetch(); }} />
      </View>}
      renderItem={({ item }) => <RecordCard item={item} incident={isIncident} chat={mode === 'conversations'} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={!query.isPending && !query.error ? <QueryState empty={hasFilters ? 'Không có hồ sơ phù hợp. Hãy thử bộ lọc khác hoặc xóa bộ lọc.' : isIncident ? 'Bạn chưa được phân công sự vụ nào.' : 'Chưa có Report.'} retry={() => { void query.refetch(); }} /> : null}
      ListFooterComponent={<View style={{ paddingTop: 20 }}><Pagination page={query.data} busy={query.isFetching} onChange={changePage} /></View>}
    />
  </>;
}
