import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeProviderReportStatus } from '@urbanmind/shared-api';
import { APP_ROLES } from '@urbanmind/shared-types';
import { useAuthStore } from '@/features/auth';
import { canAccessMobileWorkspace } from '@/features/auth/mobile-access';
import { staffApi, staffError, staffKeys } from '../staff-api';
import { executionApi, executionKeys } from '../staff-execution-api';
import {
  buildExecutionSteps, currentExecutionStep, emptyExecutionDraft, executionDraftKey,
  firstRouteParam, parseExecutionDraft, resolveExecutionMode, type ExecutionDraft, type ExecutionMode,
  type ExecutionStepId,
} from '../staff-execution-flow-models';
import {
  canEditIncidentExecution, canStartIncidentProcessing, incidentResolutionSubmissionMode,
  sameIncident, type CompletionEvidence, type EvidenceUploadAsset, type ProviderCandidate,
} from '../staff-execution-models';
import { formatDate, normalizeKey, recordCode } from '../staff-models';
import { StaffExecutionProgress } from './staff-execution-progress';
import {
  BackLink, Button, colors, Field, Label, Notice, PageHeading, panelStyle, QueryState,
  Section, Status,
} from './staff-ui';
import { StaffScrollView } from './staff-scroll-view';

const isImage = (file: CompletionEvidence) => /^image(?:\/|$)/i.test(file.fileType)
  || /\.(jpe?g|png|webp|heic)(?:[?#]|$)/i.test(file.fileUrl);
const isSelectedImage = (file: EvidenceUploadAsset) => /^image(?:\/|$)/i.test(file.mimeType || '')
  || /\.(jpe?g|png|webp|heic)$/i.test(file.name);

function localContactTime(value: string): string | null {
  if (!value.trim()) return '';
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    && date.getHours() === hour && date.getMinutes() === minute ? date.toISOString() : null;
}

const messageFor = (value: unknown) => value instanceof Error && !('response' in value) && !('status' in value)
  ? value.message : staffError(value);

function ChoiceCard({ title, description, details, selected, disabled, onPress }: {
  title: string; description: string; details: string; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={title}
    accessibilityState={{ checked: selected, disabled }}
    disabled={disabled}
    onPress={onPress}
    android_ripple={{ color: colors.primarySoft }}
    style={{ ...panelStyle, minHeight: 122, overflow: 'hidden', borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface, opacity: disabled ? 0.55 : 1 }}
  >
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.primary : colors.muted, alignItems: 'center', justifyContent: 'center' }}>
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Label bold size={17}>{title}</Label>
        <Label size={14}>{description}</Label>
        <Label muted size={12}>{details}</Label>
      </View>
    </View>
  </Pressable>;
}

function CandidateCard({ item, selected, disabled, onPress }: {
  item: ProviderCandidate; selected: boolean; disabled: boolean; onPress: () => void;
}) {
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={`Chọn đơn vị: ${item.providerName || item.coordinatorName}`}
    accessibilityState={{ checked: selected, disabled }}
    disabled={disabled}
    onPress={onPress}
    android_ripple={{ color: colors.primarySoft }}
    style={{ ...panelStyle, minHeight: 72, overflow: 'hidden', flexDirection: 'row', gap: 12, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.surface, opacity: disabled ? 0.55 : 1 }}
  >
    <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.primary : colors.muted, alignItems: 'center', justifyContent: 'center' }}>
      {selected && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary }} />}
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Label bold>{item.providerName || 'Đơn vị chưa có tên'}</Label>
      <Label muted size={13}>{item.coordinatorName || 'Chưa có đầu mối'}{item.phoneNumber ? ` · ${item.phoneNumber}` : ''}</Label>
      {!!item.address && <Label muted size={12}>{item.address}</Label>}
      {item.isPrimary && <Label bold size={12} style={{ color: colors.primary }}>Đầu mối chính</Label>}
    </View>
  </Pressable>;
}

function EvidenceCard({ file }: { file: CompletionEvidence }) {
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const safeUrl = /^https?:\/\//i.test(file.fileUrl);
  const open = async () => {
    if (!safeUrl) return;
    try { setError(''); await Linking.openURL(file.fileUrl); }
    catch { setError('Không mở được minh chứng. Vui lòng thử lại.'); }
  };
  return <View style={panelStyle}>
    {safeUrl && isImage(file) && !failed && <Image accessibilityLabel={file.description || 'Ảnh minh chứng'} source={{ uri: file.fileUrl }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1.5, borderRadius: 12, backgroundColor: colors.borderLight }} onError={() => setFailed(true)} />}
    <Label bold size={14}>{file.description || `Minh chứng #${file.completionDocumentId}`}</Label>
    <Label muted size={12}>{file.uploadedByUserName || 'Nhân viên'} · {formatDate(file.receivedAt)}</Label>
    {error ? <Notice error>{error}</Notice> : null}
    {safeUrl ? <Button secondary label={`Mở minh chứng #${file.completionDocumentId}`} onPress={() => { void open(); }} /> : <Label muted size={12}>Liên kết tệp chưa khả dụng.</Label>}
  </View>;
}

function FlowWorkspace({ id, userId, initialStep }: { id: string; userId: string; initialStep?: ExecutionStepId }) {
  const cache = useQueryClient();
  const scroll = useRef<ScrollView>(null);
  const operation = useRef(false);
  const [draft, setDraft] = useState<ExecutionDraft>(emptyExecutionDraft);
  const [hydrated, setHydrated] = useState(false);
  const [viewStep, setViewStep] = useState<ExecutionStepId | null>(initialStep || null);
  const [assets, setAssets] = useState<EvidenceUploadAsset[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState('');
  const bootstrapReady = Boolean(id && userId);
  const bootstrapError = !id
    ? new Error('Không đọc được mã sự vụ từ liên kết. Hãy quay lại chi tiết sự vụ và mở lại flow xử lý.')
    : !userId
      ? new Error('Không xác định được phiên nhân viên. Vui lòng đăng nhập lại.')
      : null;

  const incidentKey = staffKeys.incident(userId, id);
  const assignmentKey = executionKeys.assignment(userId, id);
  const incident = useQuery({ queryKey: incidentKey, queryFn: ({ signal }) => staffApi.incident(id, signal), enabled: bootstrapReady, retry: 1 });
  const readable = incident.isSuccess && !incident.error;
  const assignment = useQuery({ queryKey: assignmentKey, queryFn: ({ signal }) => executionApi.assignment(id, signal), enabled: readable, retry: 1 });
  const assignmentId = assignment.data?.providerAssignmentId || 0;
  const routeMode: ExecutionMode | null = initialStep === 'provider'
    ? 'provider'
    : initialStep === 'start'
      ? 'direct'
      : null;
  const mode = resolveExecutionMode({
    hasAssignment: !!assignment.data,
    status: incident.data?.status || '',
    draftMode: draft.mode || routeMode,
  });
  const canEdit = !!incident.data && canEditIncidentExecution(incident.data, userId);
  const candidates = useQuery({
    queryKey: executionKeys.candidates(userId, id),
    queryFn: ({ signal }) => executionApi.candidates(id, signal),
    enabled: readable && assignment.isSuccess && !assignment.data && canEdit && mode === 'provider', retry: 1,
  });
  const contacts = useQuery({
    queryKey: executionKeys.contacts(userId, id, assignmentId),
    queryFn: ({ signal }) => executionApi.contacts(assignmentId, signal),
    enabled: readable && assignmentId > 0, retry: 1,
  });
  const evidence = useQuery({
    queryKey: executionKeys.evidence(userId, id, assignmentId),
    queryFn: ({ signal }) => executionApi.evidence(assignmentId, signal),
    enabled: readable && assignmentId > 0, retry: 1,
  });
  const history = useQuery({
    queryKey: executionKeys.resolutions(userId, id),
    queryFn: ({ signal }) => executionApi.resolutions(id, signal),
    enabled: readable, retry: 1,
  });

  const steps = useMemo(() => mode ? buildExecutionSteps({
    mode,
    status: incident.data?.status || '',
    hasAssignment: !!assignment.data,
    contactCount: contacts.data?.length || 0,
    evidenceCount: evidence.data?.length || 0,
    resolutionCount: history.data?.length || 0,
    activeStep: draft.activeStep,
    evidenceSkipped: draft.evidenceSkipped,
  }) : [], [mode, incident.data?.status, assignment.data, contacts.data?.length, evidence.data?.length, history.data?.length, draft.activeStep, draft.evidenceSkipped]);
  const inferredStep = currentExecutionStep(steps);
  const activeStep = viewStep && steps.some((step) => step.id === viewStep) ? viewStep : inferredStep;
  const currentStatus = normalizeKey(incident.data?.status);
  const submissionMode = incident.data && history.isSuccess
    ? incidentResolutionSubmissionMode(incident.data, userId, history.data.length) : null;
  const submittedForCurrentStatus = !!currentStatus && submittedStatus === currentStatus;
  const canSubmit = !!submissionMode && !submittedForCurrentStatus && assignment.isSuccess
    && (!assignmentId || evidence.isSuccess);
  const storageKey = executionDraftKey(userId, id);

  useEffect(() => {
    let active = true;
    let settled = false;
    setHydrated(false);
    setDraft(emptyExecutionDraft());
    setViewStep(initialStep || null);
    const timeout = setTimeout(() => {
      if (!active || settled) return;
      settled = true;
      setDraft(emptyExecutionDraft());
      setHydrated(true);
    }, 1800);
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!active || settled) return;
      settled = true;
      clearTimeout(timeout);
      setDraft(parseExecutionDraft(value));
      setHydrated(true);
    }).catch(() => {
      if (!active || settled) return;
      settled = true;
      clearTimeout(timeout);
      setDraft(emptyExecutionDraft());
      setHydrated(true);
    });
    return () => { active = false; clearTimeout(timeout); };
  }, [storageKey, initialStep]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      void AsyncStorage.setItem(storageKey, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
    }, 350);
    return () => clearTimeout(timeout);
  }, [draft, hydrated, storageKey]);

  const refresh = useCallback(async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: incidentKey }),
      cache.invalidateQueries({ queryKey: executionKeys.all(userId, id) }),
      cache.invalidateQueries({ queryKey: ['staff', userId, 'incidents'] }),
      cache.invalidateQueries({ queryKey: ['staff', userId, 'timeline', id] }),
    ]);
  }, [cache, id, incidentKey, userId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const isCurrentSession = () => {
    const current = useAuthStore.getState().user;
    return !!current && sameIncident(current.id, userId)
      && canAccessMobileWorkspace(current, APP_ROLES.SYSTEM_STAFF);
  };
  const requireSession = () => {
    if (!isCurrentSession()) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại sự vụ bằng tài khoản nhân viên phụ trách.');
  };
  const freshState = async () => {
    requireSession();
    const latest = await staffApi.incident(id);
    requireSession();
    cache.setQueryData(incidentKey, latest);
    if (!canEditIncidentExecution(latest, userId)) throw new Error('Sự vụ không còn thuộc phạm vi hoặc trạng thái cho phép bạn cập nhật.');
    const latestAssignment = await executionApi.assignment(id);
    requireSession();
    cache.setQueryData(assignmentKey, latestAssignment);
    return { latest, latestAssignment };
  };
  const run = async (name: string, action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(name); setError(''); setSuccess('');
    try { await action(); }
    catch (value) { if (isCurrentSession()) { setError(`${messageFor(value)} Nội dung đang nhập vẫn được giữ.`); void refresh(); } }
    finally { operation.current = false; setBusy(null); }
  };
  const advance = (step: ExecutionStepId, message: string) => {
    setDraft((current) => ({ ...current, activeStep: step }));
    setViewStep(step);
    setSuccess(message);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const selectMode = (nextMode: ExecutionMode) => {
    if (currentStatus !== 'assigned' || assignment.data) return;
    const nextStep: ExecutionStepId = nextMode === 'provider' ? 'provider' : 'start';
    setDraft((current) => ({ ...current, mode: nextMode, activeStep: nextStep, evidenceSkipped: false }));
    setViewStep(nextStep); setError(''); setSuccess('');
  };

  const startProvider = () => run('provider', async () => {
    const initial = await freshState();
    if (!canStartIncidentProcessing(initial.latest, userId) && normalizeKey(initial.latest.status) !== 'inprogress') {
      throw new Error('Sự vụ không còn ở trạng thái cho phép bắt đầu xử lý.');
    }
    let current = initial.latestAssignment;
    if (!current) {
      if (!draft.selectedCoordinator) throw new Error('Vui lòng chọn đơn vị xử lý.');
      const available = await executionApi.candidates(id);
      requireSession();
      if (!available.some((item) => item.coordinatorId === draft.selectedCoordinator)) {
        cache.setQueryData(executionKeys.candidates(userId, id), available);
        throw new Error('Đơn vị đã chọn không còn phù hợp. Vui lòng chọn lại.');
      }
      current = await executionApi.assign(id, { coordinatorId: draft.selectedCoordinator, note: draft.assignNote.trim() || undefined });
      cache.setQueryData(assignmentKey, current);
    }
    if (normalizeKey(initial.latest.status) === 'assigned') {
      if (normalizeProviderReportStatus(current.reportStatus) !== 'Reported') throw new Error('Trạng thái phân công không cho phép bắt đầu xử lý.');
      current = await executionApi.startProcessing(current.providerAssignmentId, { note: 'Staff bắt đầu xử lý theo flow hướng dẫn.' });
      cache.setQueryData(assignmentKey, current);
    }
    await refresh();
    advance('contact', 'Đã phân công và bắt đầu xử lý. Tiếp theo, hãy liên hệ đơn vị.');
  });

  const startDirect = () => run('direct', async () => {
    const { latest, latestAssignment } = await freshState();
    if (latestAssignment) throw new Error('Sự vụ đã có đơn vị xử lý; hãy tiếp tục theo nhánh phối hợp đơn vị.');
    if (!canStartIncidentProcessing(latest, userId)) throw new Error('Sự vụ không còn ở trạng thái Được giao hoặc không còn thuộc bạn.');
    const updated = await executionApi.startIncidentDirectly(id, { note: 'Staff xác nhận tự xử lý sự vụ.' });
    requireSession();
    cache.setQueryData(incidentKey, updated);
    await refresh();
    advance('evidence', 'Đã bắt đầu tự xử lý. Bạn có thể xem bước minh chứng rồi tiếp tục gửi kết quả.');
  });

  const saveContact = () => run('contact', async () => {
    if (!draft.contactMethod.trim() || !draft.contactResult.trim()) throw new Error('Vui lòng nhập phương thức và kết quả liên hệ.');
    const contactedAt = localContactTime(draft.contactedAt);
    if (contactedAt === null) throw new Error('Thời gian liên hệ cần đúng định dạng ngày/tháng/năm giờ:phút.');
    const { latestAssignment } = await freshState();
    if (!latestAssignment || latestAssignment.providerAssignmentId !== assignmentId) throw new Error('Phân công đơn vị đã thay đổi. Hãy tải lại dữ liệu.');
    await executionApi.addContact(latestAssignment.providerAssignmentId, {
      contactMethod: draft.contactMethod.trim(), contactResult: draft.contactResult.trim(),
      contactNote: draft.contactNote.trim() || undefined, contactedAt: contactedAt || new Date().toISOString(),
    });
    setDraft((current) => ({ ...current, activeStep: 'evidence', contactMethod: '', contactResult: '', contactNote: '', contactedAt: '' }));
    await refresh();
    setViewStep('evidence'); setSuccess('Đã lưu liên hệ. Tiếp theo, thêm minh chứng hoặc chọn bỏ qua.');
    scroll.current?.scrollTo({ y: 0, animated: true });
  });

  const pickImages = () => run('picker', async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (!isCurrentSession() || result.canceled) return;
    setAssets((current) => [...current, ...result.assets.map((asset, index) => ({
      uri: asset.uri, name: asset.fileName || `minh-chung-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg', file: asset.file,
    }))].filter((asset, index, all) => all.findIndex((other) => other.uri === asset.uri) === index));
  });
  const pickDocuments = () => run('picker', async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (!isCurrentSession() || result.canceled) return;
    setAssets((current) => [...current, ...result.assets.map((asset) => ({
      uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined, file: asset.file,
    }))].filter((asset, index, all) => all.findIndex((other) => other.uri === asset.uri) === index));
  });
  const uploadEvidence = () => run('upload', async () => {
    if (!assignmentId || !assets.length) throw new Error('Vui lòng chọn ít nhất một tệp minh chứng.');
    const { latestAssignment } = await freshState();
    if (!latestAssignment || latestAssignment.providerAssignmentId !== assignmentId) throw new Error('Phân công đơn vị đã thay đổi.');
    const uploaded = await executionApi.uploadEvidence(assignmentId, assets, draft.evidenceDescription);
    if (!uploaded.length) throw new Error('Máy chủ chưa xác nhận tệp đã lưu. Hãy kiểm tra danh sách trước khi tải lại.');
    setAssets([]);
    setDraft((current) => ({ ...current, evidenceDescription: '', evidenceSkipped: false, activeStep: 'resolution' }));
    await refresh();
    setViewStep('resolution'); setSuccess('Đã tải minh chứng. Bây giờ hãy hoàn tất kết quả xử lý.');
    scroll.current?.scrollTo({ y: 0, animated: true });
  });
  const clearEvidence = () => run('clear', async () => {
    const { latest, latestAssignment } = await freshState();
    if (normalizeKey(latest.status) !== 'needrework' || !latestAssignment || latestAssignment.providerAssignmentId !== assignmentId) {
      throw new Error('Chỉ được xóa minh chứng của phân công hiện tại khi Manager yêu cầu xử lý lại.');
    }
    await executionApi.clearEvidence(assignmentId);
    cache.setQueryData(executionKeys.evidence(userId, id, assignmentId), []);
    setConfirmClear(false); setSuccess('Đã xóa toàn bộ minh chứng cũ.');
    await refresh();
  });
  const skipEvidence = () => {
    setAssets([]);
    setDraft((current) => ({ ...current, evidenceSkipped: true, activeStep: 'resolution' }));
    setViewStep('resolution'); setError('');
    setSuccess('Đã bỏ qua minh chứng. Bạn vẫn có thể quay lại bước này trước khi gửi kết quả.');
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const submitResolution = () => run('submit', async () => {
    if (!draft.resolutionSummary.trim() || !draft.actionTaken.trim()) throw new Error('Vui lòng nhập tóm tắt kết quả và công việc đã thực hiện.');
    if (assets.length) throw new Error('Bạn còn tệp chưa tải lên. Hãy tải lên hoặc bỏ tệp trước khi gửi.');
    const { latest, latestAssignment } = await freshState();
    const existing = await executionApi.resolutions(id);
    requireSession();
    cache.setQueryData(executionKeys.resolutions(userId, id), existing);
    const latestMode = incidentResolutionSubmissionMode(latest, userId, existing.length);
    if (!latestMode) throw new Error('Sự vụ không còn ở trạng thái cho phép gửi kết quả.');
    if (mode === 'provider' && !latestAssignment) throw new Error('Không tìm thấy phân công đơn vị của flow hiện tại.');
    const files = latestAssignment ? await executionApi.evidence(latestAssignment.providerAssignmentId) : [];
    requireSession();
    await executionApi.submitResolution(id, {
      ...(latestAssignment ? { providerAssignmentId: latestAssignment.providerAssignmentId } : {}),
      resolutionSummary: draft.resolutionSummary.trim(), actionTaken: draft.actionTaken.trim(),
      resultNote: draft.resultNote.trim() || undefined,
      imageUrls: files.filter(isImage).map((file) => file.fileUrl).filter((url) => /^https?:\/\//i.test(url)),
    });
    setSubmittedStatus(normalizeKey(latest.status));
    setConfirmSubmit(false);
    setDraft(emptyExecutionDraft());
    await AsyncStorage.removeItem(storageKey);
    setSuccess(latestMode === 'resubmit' ? 'Đã gửi lại kết quả cho Manager duyệt.' : 'Đã gửi kết quả cho Manager duyệt.');
    await refresh();
    setViewStep('resolution'); scroll.current?.scrollTo({ y: 0, animated: true });
  });

  const filteredCandidates = candidates.data?.filter((item) => (
    `${item.providerName} ${item.coordinatorName} ${item.address}`.toLocaleLowerCase('vi-VN')
      .includes(search.trim().toLocaleLowerCase('vi-VN'))
  )) || [];
  const selectedCandidate = candidates.data?.find((item) => item.coordinatorId === draft.selectedCoordinator);
  const validContactTime = localContactTime(draft.contactedAt) !== null;
  const readonly = readable && !canEdit;
  const queryPending = bootstrapReady && (incident.isPending || (readable && assignment.isPending) || !hydrated);

  return <>
    <Stack.Screen options={{ title: currentStatus === 'needrework' ? 'Xử lý lại sự vụ' : 'Xử lý sự vụ' }} />
    <StaffScrollView ref={scroll} refreshControl={<RefreshControl refreshing={incident.isRefetching || assignment.isRefetching || contacts.isRefetching || evidence.isRefetching || history.isRefetching} onRefresh={() => { if (!operation.current) void refresh(); }} />}>
      <BackLink href={(`/(staff)/staff/incidents/${encodeURIComponent(id)}`) as Href} label="Chi tiết sự vụ" />
      <QueryState pending={queryPending} error={bootstrapError || incident.error || assignment.error} retry={() => { void refresh(); }} />
      {readable && hydrated && incident.data && <>
        <PageHeading eyebrow={recordCode(id, true)} title={incident.data.title} accessory={<Status value={incident.data.status} />} description={currentStatus === 'needrework' ? 'Bổ sung phần Manager yêu cầu và gửi lại trong cùng một luồng.' : 'Hoàn thành lần lượt từng bước; tiến độ được lưu khi bạn rời màn hình.'} />
        {error ? <Notice error>{error}</Notice> : null}
        {success ? <Notice>{success}</Notice> : null}
        {readonly && <Notice>{sameIncident(incident.data.assignedStaffUserId, userId) ? 'Sự vụ đang ở chế độ chỉ xem. Bạn vẫn có thể xem tiến độ và lịch sử đã gửi.' : 'Chỉ nhân viên đang phụ trách mới được cập nhật flow xử lý.'}</Notice>}

        {!mode && canEdit && currentStatus === 'assigned' && <Section title="Bạn sẽ xử lý theo cách nào?">
          <Label muted size={14}>Chọn một cách để hệ thống dẫn bạn đi đúng thứ tự. Bạn có thể đổi lựa chọn trước khi bắt đầu.</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel="Cách xử lý sự vụ" style={{ gap: 12 }}>
            <ChoiceCard title="Phối hợp đơn vị" description="Dành cho công việc cần nhà thầu hoặc đầu mối chuyên trách." details="Phân công → Bắt đầu → Liên hệ → Minh chứng → Kết quả" selected={draft.mode === 'provider'} onPress={() => selectMode('provider')} />
            <ChoiceCard title="Tự xử lý" description="Dành cho việc Staff có thể xử lý trực tiếp tại hiện trường hoặc trên hệ thống." details="Bắt đầu → Minh chứng tùy chọn → Kết quả" selected={draft.mode === 'direct'} onPress={() => selectMode('direct')} />
          </View>
        </Section>}

        {mode && <>
          <Section title={currentStatus === 'needrework' ? 'Tiến độ xử lý lại' : 'Tiến độ xử lý'}>
            <View style={{ ...panelStyle, paddingBottom: 4 }}><StaffExecutionProgress steps={steps} onSelect={(step) => { setViewStep(step); setError(''); setSuccess(''); }} /></View>
            {currentStatus === 'assigned' && !assignment.data && <Button secondary label="Đổi cách xử lý" disabled={!!busy} onPress={() => { setDraft((current) => ({ ...current, mode: null, activeStep: null })); setViewStep(null); }} />}
          </Section>

          {activeStep === 'provider' && <Section title="1. Phân công và bắt đầu">
            {assignment.data ? <View style={panelStyle}>
              <Label bold size={18}>{assignment.data.providerName || 'Đơn vị xử lý'}</Label>
              <Label muted>{assignment.data.coordinatorName || 'Chưa có tên đầu mối'}</Label>
              {!!assignment.data.phoneNumber && <Label size={13}>Điện thoại: {assignment.data.phoneNumber}</Label>}
              <Label muted size={12}>Trạng thái đơn vị: {normalizeProviderReportStatus(assignment.data.reportStatus)}</Label>
            </View> : <>
              <Label muted size={13}>Danh sách do backend lọc theo khu vực và danh mục của sự vụ. Mỗi sự vụ chỉ được phân công một đơn vị.</Label>
              <Field label="Tìm đơn vị" placeholder="Tên đơn vị, đầu mối hoặc địa chỉ…" value={search} onChangeText={setSearch} editable={!busy} />
              <QueryState pending={candidates.isPending} error={candidates.error} empty={candidates.isSuccess && !filteredCandidates.length && (search.trim() ? 'Không có đơn vị khớp từ khóa.' : 'Chưa có đơn vị phù hợp với sự vụ.')} retry={() => { void candidates.refetch(); }} />
              <View accessibilityRole="radiogroup" accessibilityLabel="Đơn vị xử lý" style={{ gap: 10 }}>
                {filteredCandidates.map((item) => <CandidateCard key={item.coordinatorId} item={item} selected={draft.selectedCoordinator === item.coordinatorId} disabled={!!busy} onPress={() => setDraft((current) => ({ ...current, selectedCoordinator: item.coordinatorId }))} />)}
              </View>
              {!!selectedCandidate && <Field label="Ghi chú phân công" multiline placeholder="Thông tin cần lưu ý cho đơn vị…" value={draft.assignNote} onChangeText={(assignNote) => setDraft((current) => ({ ...current, assignNote }))} editable={!busy} />}
            </>}
            {!readonly && <Button label={assignment.data ? 'Bắt đầu xử lý với đơn vị này' : 'Phân công và bắt đầu xử lý'} busy={busy === 'provider'} disabled={!!busy || (!assignment.data && !draft.selectedCoordinator)} onPress={() => { void startProvider(); }} />}
          </Section>}

          {activeStep === 'start' && <Section title="1. Xác nhận tự xử lý">
            <Notice>Chọn cách này khi bạn có thể tự kiểm tra, cập nhật dữ liệu, hướng dẫn hoặc khắc phục công việc nhỏ mà không cần đơn vị phối hợp.</Notice>
            <View style={panelStyle}>
              <Label bold>Flow tự xử lý</Label>
              <Label size={14}>Sự vụ sẽ chuyển sang “Đang xử lý”. Sau đó bạn ghi kết quả và gửi Manager duyệt.</Label>
              <Label muted size={12}>Nếu cần tải ảnh hoặc PDF lên kho minh chứng của backend, hãy dùng nhánh Phối hợp đơn vị vì endpoint tệp hiện thuộc phân công đơn vị.</Label>
            </View>
            {!readonly && <Button label="Xác nhận bắt đầu tự xử lý" busy={busy === 'direct'} disabled={!!busy} onPress={() => { void startDirect(); }} />}
          </Section>}

          {activeStep === 'contact' && <Section title="2. Liên hệ đơn vị">
            {assignment.data && <View style={panelStyle}>
              <Label bold size={17}>{assignment.data.providerName || 'Đơn vị xử lý'}</Label>
              <Label>{assignment.data.coordinatorName || 'Chưa có tên đầu mối'}</Label>
              {!!assignment.data.phoneNumber && <Button secondary label="Gọi đầu mối" onPress={() => { void Linking.openURL(`tel:${assignment.data!.phoneNumber.replace(/[^\d+]/g, '')}`).catch(() => setError('Không mở được ứng dụng gọi điện.')); }} />}
              {!!assignment.data.email && <Button secondary label="Gửi email" onPress={() => { void Linking.openURL(`mailto:${encodeURIComponent(assignment.data!.email)}`).catch(() => setError('Không mở được ứng dụng email.')); }} />}
            </View>}
            <Label muted size={13}>Sau khi trao đổi, lưu lại kết quả để flow chuyển sang bước minh chứng.</Label>
            <Field label="Phương thức liên hệ" placeholder="Gọi điện, email, gặp trực tiếp…" value={draft.contactMethod} onChangeText={(contactMethod) => setDraft((current) => ({ ...current, contactMethod }))} editable={!busy && !readonly} />
            <Field label="Kết quả liên hệ" placeholder="Ví dụ: đã thống nhất lịch kiểm tra" value={draft.contactResult} onChangeText={(contactResult) => setDraft((current) => ({ ...current, contactResult }))} editable={!busy && !readonly} />
            <Field label="Nội dung trao đổi" multiline placeholder="Thông tin đã trao đổi và bước tiếp theo…" value={draft.contactNote} onChangeText={(contactNote) => setDraft((current) => ({ ...current, contactNote }))} editable={!busy && !readonly} />
            <Field label="Thời gian liên hệ" placeholder="dd/MM/yyyy HH:mm" maxLength={16} value={draft.contactedAt} onChangeText={(contactedAt) => setDraft((current) => ({ ...current, contactedAt }))} editable={!busy && !readonly} />
            <Label muted size={12}>Để trống để ghi nhận thời điểm bạn bấm lưu.</Label>
            {!validContactTime && <Notice error>Thời gian chưa hợp lệ. Ví dụ: 16/09/2026 14:30.</Notice>}
            {!readonly && <Button label="Lưu liên hệ và tiếp tục" busy={busy === 'contact'} disabled={!!busy || !draft.contactMethod.trim() || !draft.contactResult.trim() || !validContactTime} onPress={() => { void saveContact(); }} />}
            {!!contacts.data?.length && <View style={{ gap: 10 }}><Label bold>Lịch sử đã lưu</Label>{contacts.data.map((item) => <View key={item.contactLogId} style={panelStyle}><Label muted size={12}>{formatDate(item.contactedAt)}</Label><Label bold>{item.contactMethod}</Label><Label size={14}>{item.contactResult}</Label>{item.contactNote ? <Label muted size={13}>{item.contactNote}</Label> : null}</View>)}</View>}
          </Section>}

          {activeStep === 'evidence' && <Section title={mode === 'provider' ? '3. Minh chứng xử lý' : '2. Minh chứng xử lý'}>
            {mode === 'direct' ? <>
              <Notice>Minh chứng là tùy chọn trong nhánh tự xử lý. Backend hiện chỉ nhận tệp theo một phân công đơn vị, nên ứng dụng không gửi đường dẫn ảnh cục bộ hoặc gắn tệp sai phạm vi.</Notice>
              <Label muted size={13}>Nếu sự vụ bắt buộc có ảnh/PDF, quay lại và chọn “Phối hợp đơn vị” trước khi bắt đầu. Nếu không, tiếp tục ghi kết quả xử lý.</Label>
              {!readonly && <Button label="Tiếp tục đến kết quả" disabled={!!busy} onPress={skipEvidence} />}
            </> : <>
              <Label muted size={13}>Ảnh và PDF được tải vào đúng phân công đơn vị của sự vụ. Tệp đã chọn trên thiết bị chỉ được giữ khi bạn còn ở màn hình này.</Label>
              <Button secondary label="Chọn ảnh minh chứng" busy={busy === 'picker'} disabled={!!busy || readonly} onPress={() => { void pickImages(); }} />
              <Button secondary label="Chọn ảnh hoặc PDF" disabled={!!busy || readonly} onPress={() => { void pickDocuments(); }} />
              {assets.map((asset, index) => <View key={asset.uri} style={{ gap: 8 }}>
                {isSelectedImage(asset) ? <Image accessibilityLabel={`Ảnh đã chọn ${index + 1}`} source={{ uri: asset.uri }} style={{ width: '100%', aspectRatio: 1.6, borderRadius: 12 }} /> : <View style={{ ...panelStyle, backgroundColor: colors.borderLight }}><Label bold>PDF</Label><Label muted size={12}>{asset.name}</Label></View>}
                <Button secondary label={`Bỏ tệp ${index + 1}`} disabled={!!busy} onPress={() => setAssets((current) => current.filter((_, assetIndex) => assetIndex !== index))} />
              </View>)}
              <Field label="Mô tả minh chứng" multiline placeholder="Vị trí, tình trạng sau xử lý…" value={draft.evidenceDescription} onChangeText={(evidenceDescription) => setDraft((current) => ({ ...current, evidenceDescription }))} editable={!busy && !readonly} />
              {!readonly && <Button label="Tải lên và tiếp tục" busy={busy === 'upload'} disabled={!!busy || !assets.length} onPress={() => { void uploadEvidence(); }} />}
              {!readonly && <Button secondary label="Bỏ qua minh chứng" disabled={!!busy} onPress={skipEvidence} />}
              <QueryState pending={evidence.isPending} error={evidence.error} empty={evidence.isSuccess && !evidence.data?.length && 'Chưa có minh chứng đã tải lên.'} retry={() => { void evidence.refetch(); }} />
              {evidence.data?.map((file) => <EvidenceCard key={file.completionDocumentId} file={file} />)}
              {currentStatus === 'needrework' && !!evidence.data?.length && (confirmClear ? <View style={{ ...panelStyle, borderColor: colors.redDark, backgroundColor: colors.redLight }}><Label bold style={{ color: colors.redDark }}>Xóa toàn bộ minh chứng cũ?</Label><Label size={14}>Thao tác này không thể hoàn tác.</Label><Button danger label="Xác nhận xóa" busy={busy === 'clear'} disabled={!!busy} onPress={() => { void clearEvidence(); }} /><Button secondary label="Giữ lại" disabled={!!busy} onPress={() => setConfirmClear(false)} /></View> : <Button danger label="Xóa toàn bộ minh chứng cũ" disabled={!!busy || readonly} onPress={() => setConfirmClear(true)} />)}
            </>}
          </Section>}

          {activeStep === 'resolution' && <Section title={mode === 'provider' ? '4. Gửi kết quả' : '3. Gửi kết quả'}>
            {currentStatus === 'needrework' && <Notice>Đây là lần xử lý lại. Hãy bổ sung đúng nội dung Manager yêu cầu; kết quả cũ vẫn được giữ trong lịch sử.</Notice>}
            {canSubmit && !readonly && <>
              <Field label="Tóm tắt kết quả" multiline placeholder="Kết quả cuối cùng của sự vụ…" value={draft.resolutionSummary} onChangeText={(resolutionSummary) => setDraft((current) => ({ ...current, resolutionSummary }))} editable={!busy && !confirmSubmit} />
              <Field label="Công việc đã thực hiện" multiline placeholder="Các bước kiểm tra, sửa chữa hoặc cập nhật…" value={draft.actionTaken} onChangeText={(actionTaken) => setDraft((current) => ({ ...current, actionTaken }))} editable={!busy && !confirmSubmit} />
              <Field label="Ghi chú cho Manager" multiline placeholder="Thông tin bổ sung (không bắt buộc)" value={draft.resultNote} onChangeText={(resultNote) => setDraft((current) => ({ ...current, resultNote }))} editable={!busy && !confirmSubmit} />
              <View style={panelStyle}>
                <Label bold>Tóm tắt trước khi gửi</Label>
                <Label muted size={13}>{assignment.data ? `Đơn vị: ${assignment.data.providerName || `#${assignmentId}`}` : 'Staff tự xử lý trực tiếp'}</Label>
                <Label muted size={13}>{assignment.data ? `${evidence.data?.length || 0} minh chứng đã lưu` : 'Không có kho minh chứng theo phân công đơn vị'}</Label>
              </View>
              {confirmSubmit ? <View style={{ ...panelStyle, borderColor: colors.primary }}>
              <Label bold>{submissionMode === 'resubmit' ? 'Xác nhận gửi lại kết quả?' : 'Xác nhận gửi kết quả?'}</Label>
              <Label size={14}>Sau khi gửi, kết quả sẽ chờ Manager xem xét. Kiểm tra lại nội dung trước khi xác nhận.</Label>
              <Button label={submissionMode === 'resubmit' ? 'Xác nhận gửi lại' : 'Xác nhận gửi Manager'} busy={busy === 'submit'} disabled={!!busy} onPress={() => { void submitResolution(); }} />
              <Button secondary label="Quay lại chỉnh sửa" disabled={!!busy} onPress={() => setConfirmSubmit(false)} />
              </View> : <Button label={submissionMode === 'resubmit' ? 'Gửi lại kết quả cho Manager' : 'Gửi kết quả cho Manager'} disabled={!!busy || !draft.resolutionSummary.trim() || !draft.actionTaken.trim() || !!assets.length} onPress={() => { setError(''); setConfirmSubmit(true); }} />}
            </>}
            {!canSubmit && !history.isPending && <Label muted size={13}>{currentStatus === 'assigned' ? 'Hãy hoàn thành bước bắt đầu xử lý trước.' : submittedForCurrentStatus || (currentStatus === 'inprogress' && !!history.data?.length) ? 'Kết quả đã được gửi. Hãy chờ Manager duyệt hoặc yêu cầu xử lý lại.' : 'Trạng thái hiện tại chưa cho phép gửi kết quả.'}</Label>}
          </Section>}

          {!!history.data?.length && <Section title="Kết quả đã gửi">
            {history.data.map((item) => <View key={item.resolutionId} style={panelStyle}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}><Label bold>Kết quả #{item.resolutionId}</Label><Status value={item.status} /></View>
              <Label bold size={17}>{item.resolutionSummary || 'Chưa có tóm tắt'}</Label>
              <Label muted size={12}>{item.createdByStaffUserName || 'Nhân viên'} · {formatDate(item.resolvedAt)}</Label>
              {!!item.actionTaken && <Label size={14}>{item.actionTaken}</Label>}
            </View>)}
          </Section>}
        </>}
      </>}
    </StaffScrollView>
  </>;
}

export function StaffExecutionFlowScreen({ initialStep }: { initialStep?: ExecutionStepId } = {}) {
  const params = useLocalSearchParams<{ id?: string | string[]; step?: string | string[] }>();
  const id = firstRouteParam(params.id);
  const step = firstRouteParam(params.step);
  const userId = useAuthStore((state) => state.user?.id || '');
  const routeStep = ['provider', 'start', 'contact', 'evidence', 'resolution'].includes(step)
    ? step as ExecutionStepId : undefined;
  return <FlowWorkspace key={`${userId}:${id}`} id={id} userId={userId} initialStep={routeStep || initialStep} />;
}
