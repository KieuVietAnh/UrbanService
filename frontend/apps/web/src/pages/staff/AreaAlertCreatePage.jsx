import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { toolsApi } from '@urbanmind/shared-api';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { ErrorAlert } from '../../components/alerts/ErrorAlert';
import { ManagerPageHeader } from '../../components/manager/ManagerPageElements';
import { LocationPicker } from '../../components/maps/LocationPicker';
import Button from '../../components/design-system/Button';
import { getCategoryLabel } from '../../utils/categoryLabels';

const AREA_ALERT_LOOKUP_CACHE_KEY = 'staff-area-alert-lookup-cache';
const AREA_ALERT_LOOKUP_TTL = 10 * 60 * 1000;

const readAreaAlertLookupCache = () => {
  try {
    const raw = sessionStorage.getItem(AREA_ALERT_LOOKUP_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed?.savedAt || Date.now() - Number(parsed.savedAt) > AREA_ALERT_LOOKUP_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeAreaAlertLookupCache = (areas, categories) => {
  try {
    sessionStorage.setItem(
      AREA_ALERT_LOOKUP_CACHE_KEY,
      JSON.stringify({ areas, categories, savedAt: Date.now() })
    );
  } catch {
    // Ignore storage failures.
  }
};

const DEFAULT_FORM = {
  title: '',
  message: '',
  severity: 'Medium',
  areaId: '',
  categoryId: '',
  latitude: '',
  longitude: '',
  radiusMeters: '',
  startAt: '',
  endAt: '',
};

const normalizeLookupList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const getAreaLabel = (area) => area?.areaName || area?.name || area?.displayName || 'Khu vực chưa xác định';

const selectClass = 'select h-11 w-full rounded-xl border-slate-200 !bg-white text-sm text-slate-900 shadow-sm [color-scheme:light]';

export default function AreaAlertCreatePage() {
  const navigate = useNavigate();
  const [initialLookupCache] = useState(() => readAreaAlertLookupCache());
  const [areas, setAreas] = useState(() => (
    Array.isArray(initialLookupCache?.areas) ? initialLookupCache.areas : []
  ));
  const [categories, setCategories] = useState(() => (
    Array.isArray(initialLookupCache?.categories) ? initialLookupCache.categories : []
  ));
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    let active = true;

    const loadLookups = async () => {
      setError('');

      if (
        Array.isArray(initialLookupCache?.areas)
        && initialLookupCache.areas.length > 0
        && Array.isArray(initialLookupCache?.categories)
        && initialLookupCache.categories.length > 0
      ) {
        return;
      }

      try {
        const [areasRes, categoriesRes] = await Promise.allSettled([
          toolsApi.getAreas(),
          toolsApi.getCategories(),
        ]);

        if (!active) return;

        const resolvedAreas = normalizeLookupList(areasRes.status === 'fulfilled' ? areasRes.value : []);
        const resolvedCategories = normalizeLookupList(categoriesRes.status === 'fulfilled' ? categoriesRes.value : []);

        setAreas(resolvedAreas);
        setCategories(resolvedCategories);

        if (areasRes.status === 'fulfilled' && categoriesRes.status === 'fulfilled') {
          writeAreaAlertLookupCache(resolvedAreas, resolvedCategories);
        }

        if (areasRes.status === 'rejected' || categoriesRes.status === 'rejected') {
          setError('Một số dữ liệu khu vực hoặc danh mục chưa tải được. Vui lòng tải lại trang.');
        }
      } catch (err) {
        if (!active) return;
        console.error('Failed to load area alert lookups', err);
        setError('Không thể tải dữ liệu khu vực và danh mục. Vui lòng thử lại.');
      }
    };

    loadLookups();

    return () => {
      active = false;
    };
  }, [initialLookupCache]);

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleLocationSelect = (latitude, longitude) => {
    setForm((current) => ({
      ...current,
      latitude: latitude != null ? String(latitude) : '',
      longitude: longitude != null ? String(longitude) : '',
    }));
    setFormErrors((current) => ({
      ...current,
      latitude: undefined,
      longitude: undefined,
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.title?.trim()) nextErrors.title = 'Vui lòng nhập tiêu đề cảnh báo.';
    if (!form.message?.trim()) nextErrors.message = 'Vui lòng nhập nội dung cảnh báo.';
    if (!form.severity?.trim()) nextErrors.severity = 'Vui lòng chọn mức độ nghiêm trọng.';
    if (!form.areaId) nextErrors.areaId = 'Vui lòng chọn khu vực nhận cảnh báo.';
    if (!form.startAt?.trim()) nextErrors.startAt = 'Vui lòng chọn thời gian bắt đầu.';

    if ((form.latitude || form.longitude) && !(form.latitude && form.longitude)) {
      nextErrors.latitude = 'Cần có cả kinh độ và vĩ độ nếu định vị chính xác.';
      nextErrors.longitude = 'Cần có cả kinh độ và vĩ độ nếu định vị chính xác.';
    }

    if (form.radiusMeters && Number(form.radiusMeters) <= 0) {
      nextErrors.radiusMeters = 'Bán kính phải lớn hơn 0.';
    }

    if (form.startAt && form.endAt && new Date(form.endAt) <= new Date(form.startAt)) {
      nextErrors.endAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setLoadingCreate(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      alertType: 'Manual',
      severity: form.severity,
      startAt: new Date(form.startAt).toISOString(),
      endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
      radiusMeters: form.radiusMeters ? Number(form.radiusMeters) : undefined,
      areaId: Number(form.areaId),
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
    };

    try {
      const createdAlert = await managementFeedbackApi.createAreaAlert(payload);
      navigate('/staff/area-alerts', {
        replace: true,
        state: { createdAlert },
      });
    } catch (err) {
      console.error('Failed to create area alert', err);
      setError(err?.message || 'Không thể tạo cảnh báo khu vực. Vui lòng thử lại.');
    } finally {
      setLoadingCreate(false);
    }
  };

  return (
    <div className="admin-page-shell space-y-6">
      <ManagerPageHeader
        title="Tạo cảnh báo"
        description="Thiết lập nội dung, phạm vi và thời gian hiệu lực trước khi phát hành."
        icon={Lucide.Megaphone}
        statusLabel="LOẠI CẢNH BÁO"
        statusValue="Thủ công"
        actions={(
          <Button
            type="button"
            onClick={() => navigate('/staff/area-alerts')}
            variant="ghost"
            disabled={loadingCreate}
          >
            <Lucide.ArrowLeft size={16} />
            Quay lại
          </Button>
        )}
      />

      {error ? (
        <ErrorAlert
          title="Không thể tiếp tục"
          message={error}
          onClose={() => setError('')}
        />
      ) : null}

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Lucide.FileText size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Thông tin cảnh báo</h2>
              <p className="mt-1 text-sm text-slate-500">
                Nội dung này sẽ được dùng để thông báo cho người dân trong phạm vi được chọn.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.6fr)]">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span>Tiêu đề <span className="text-rose-500">*</span></span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                placeholder="Ví dụ: Ngập cục bộ tại khu vực..."
                className="input h-11 w-full rounded-xl border-slate-200 bg-white text-sm shadow-sm"
              />
              {formErrors.title ? <span className="text-xs font-medium text-rose-600">{formErrors.title}</span> : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              <span>Mức độ <span className="text-rose-500">*</span></span>
              <select
                value={form.severity}
                onChange={(event) => handleFieldChange('severity', event.target.value)}
                className={selectClass}
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
              >
                <option value="Critical" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Khẩn cấp</option>
                <option value="High" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Cao</option>
                <option value="Medium" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Trung bình</option>
                <option value="Low" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Thấp</option>
              </select>
              {formErrors.severity ? <span className="text-xs font-medium text-rose-600">{formErrors.severity}</span> : null}
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            <span>Nội dung cảnh báo <span className="text-rose-500">*</span></span>
            <textarea
              rows={5}
              value={form.message}
              onChange={(event) => handleFieldChange('message', event.target.value)}
              placeholder="Mô tả ngắn gọn sự cố, phạm vi ảnh hưởng và hướng dẫn cần thiết..."
              className="textarea w-full resize-y rounded-xl border-slate-200 bg-white text-sm leading-6 shadow-sm"
            />
            {formErrors.message ? <span className="text-xs font-medium text-rose-600">{formErrors.message}</span> : null}
          </label>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Lucide.MapPinned size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Phạm vi áp dụng</h2>
              <p className="mt-1 text-sm text-slate-500">
                Khu vực là bắt buộc; danh mục và bán kính dùng khi cần thu hẹp phạm vi cảnh báo.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            <span>Khu vực <span className="text-rose-500">*</span></span>
            <select
              value={form.areaId}
              onChange={(event) => handleFieldChange('areaId', event.target.value)}
              className={selectClass}
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              <option value="" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Chọn khu vực</option>
              {areas.map((area) => (
                <option
                  key={area.areaId ?? area.id}
                  value={area.areaId ?? area.id}
                  style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  {getAreaLabel(area)}
                </option>
              ))}
            </select>
            {formErrors.areaId ? <span className="text-xs font-medium text-rose-600">{formErrors.areaId}</span> : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            <span>Danh mục</span>
            <select
              value={form.categoryId}
              onChange={(event) => handleFieldChange('categoryId', event.target.value)}
              className={selectClass}
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              <option value="" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Không chọn danh mục</option>
              {categories.map((category) => (
                <option
                  key={category.categoryId ?? category.id}
                  value={category.categoryId ?? category.id}
                  style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  {getCategoryLabel(category.categoryName || category.name || category.categoryType || category.type)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            <span>Bán kính ảnh hưởng (m)</span>
            <input
              type="number"
              min="1"
              value={form.radiusMeters}
              onChange={(event) => handleFieldChange('radiusMeters', event.target.value)}
              placeholder="Theo khu vực"
              className="input h-11 w-full rounded-xl border-slate-200 bg-white text-sm shadow-sm"
            />
            {formErrors.radiusMeters ? <span className="text-xs font-medium text-rose-600">{formErrors.radiusMeters}</span> : null}
          </label>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Lucide.Clock3 size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Thời gian hiệu lực</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cảnh báo bắt đầu tại thời điểm đã chọn và có thể không đặt thời gian kết thúc.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            <span>Bắt đầu <span className="text-rose-500">*</span></span>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(event) => handleFieldChange('startAt', event.target.value)}
              className="input h-11 w-full rounded-xl border-slate-200 bg-white text-sm shadow-sm [color-scheme:light]"
            />
            {formErrors.startAt ? <span className="text-xs font-medium text-rose-600">{formErrors.startAt}</span> : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
            <span>Kết thúc</span>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(event) => handleFieldChange('endAt', event.target.value)}
              className="input h-11 w-full rounded-xl border-slate-200 bg-white text-sm shadow-sm [color-scheme:light]"
            />
            {formErrors.endAt ? <span className="text-xs font-medium text-rose-600">{formErrors.endAt}</span> : null}
          </label>
        </div>
      </section>

      <section className="admin-panel overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <Lucide.Crosshair size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Vị trí chính xác</h2>
              <p className="mt-1 text-sm text-slate-500">
                Không bắt buộc. Chọn điểm trên bản đồ nếu cảnh báo cần tâm ảnh hưởng cụ thể trong khu vực.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <LocationPicker
              latitude={form.latitude ? Number(form.latitude) : null}
              longitude={form.longitude ? Number(form.longitude) : null}
              onSelectLocation={handleLocationSelect}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
            <span>
              {form.latitude && form.longitude
                ? `Đã chọn: ${Number(form.latitude).toFixed(6)}, ${Number(form.longitude).toFixed(6)}`
                : 'Chưa chọn tọa độ cụ thể.'}
            </span>
            {(formErrors.latitude || formErrors.longitude) ? (
              <span className="text-rose-600">{formErrors.latitude || formErrors.longitude}</span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="admin-panel flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-slate-500">
          Kiểm tra lại nội dung và phạm vi trước khi phát hành. Các trường có dấu <span className="text-rose-500">*</span> là bắt buộc.
        </p>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button
            type="button"
            onClick={() => navigate('/staff/area-alerts')}
            disabled={loadingCreate}
            variant="ghost"
          >
            Hủy
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loadingCreate}
            variant="primary"
          >
            {loadingCreate ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Đang phát hành...
              </>
            ) : (
              <>
                <Lucide.Send size={15} />
                Phát hành cảnh báo
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
