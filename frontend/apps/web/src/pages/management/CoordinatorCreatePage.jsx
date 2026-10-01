import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { managementFeedbackApi } from '../../services/api/managementFeedbackApi';
import { clearCoordinatorDirectoryCache } from '../../services/cache/adminCoordinatorDirectoryCache';

const EMPTY_FORM = {
  providerName: '',
  coordinatorName: '',
  phoneNumber: '',
  email: '',
  address: '',
  note: '',
};

const unwrapItem = (value) => value?.data ?? value?.item ?? value?.result ?? value ?? null;
const translateApiMessage = (message, fallback) => {
  if (!message) return fallback;
  const normalized = String(message).toLowerCase();
  if (normalized.includes('phonenumber') && (normalized.includes('required') || normalized.includes('bat buoc'))) {
    return 'Vui lòng nhập số điện thoại.';
  }
  if (normalized.includes('providername') && normalized.includes('required')) {
    return 'Vui lòng nhập tên đơn vị cung cấp.';
  }
  if (normalized.includes('coordinatorname') && normalized.includes('required')) {
    return 'Vui lòng nhập tên người phụ trách.';
  }
  return message;
};

const getErrorMessage = (error, fallback) =>
  translateApiMessage(
    error?.response?.data?.message || error?.response?.data?.msg || error?.message,
    fallback,
  );

function FieldHint({ message }) {
  if (!message) return null;

  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <Lucide.CircleAlert size={15} className="cursor-help text-rose-500" aria-label={message} />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
        {message}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
      </span>
    </span>
  );
}

export default function CoordinatorCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setupCoverage = location.state?.setupCoverage || null;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const validation = useMemo(() => ({
    providerName: form.providerName.trim() ? '' : 'Vui lòng nhập tên đơn vị cung cấp.',
    coordinatorName: form.coordinatorName.trim() ? '' : 'Vui lòng nhập tên người phụ trách.',
    phoneNumber: !form.phoneNumber.trim()
      ? 'Vui lòng nhập số điện thoại.'
      : !/^0\d{9}$/.test(form.phoneNumber)
        ? 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.'
        : '',
  }), [form.coordinatorName, form.phoneNumber, form.providerName]);

  const isDirty = useMemo(
    () => Object.values(form).some((value) => String(value).trim() !== ''),
    [form],
  );

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty || saving) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saving]);

  const updateForm = (field, value) => {
    const nextValue = field === 'phoneNumber' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setForm((current) => ({ ...current, [field]: nextValue }));
    if (error) setError('');
  };

  const leavePage = () => {
    navigate('/management/coordinators', {
      state: setupCoverage ? { setupCoverage } : { restoreCoordinatorList: true },
    });
  };

  const goBack = () => {
    if (isDirty && !saving) {
      setShowLeaveConfirm(true);
      return;
    }
    leavePage();
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    const firstInvalidField = Object.keys(validation).find((field) => validation[field]);
    if (firstInvalidField) {
      setError('Vui lòng kiểm tra và điền đầy đủ các trường bắt buộc.');
      requestAnimationFrame(() => {
        document.querySelector(`[name="${firstInvalidField}"]`)?.focus();
      });
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await managementFeedbackApi.createServiceProvider({
        providerName: form.providerName.trim(),
        coordinatorName: form.coordinatorName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
      });
      const created = unwrapItem(response);
      const coordinatorId = created?.coordinatorId ?? created?.id;
      clearCoordinatorDirectoryCache();

      if (coordinatorId) {
        navigate(`/management/coordinators/${coordinatorId}`, {
          replace: true,
          state: {
            coordinatorCreated: true,
            ...(setupCoverage ? { setupCoverage } : {}),
          },
        });
        return;
      }

      navigate('/management/coordinators', {
        replace: true,
        state: { forceCoordinatorRefresh: true },
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tạo điều phối viên.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page-shell space-y-6">
      <section className="admin-page-hero">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="admin-hero-icon"><Lucide.UserRoundPlus size={22} /></div>
            <div className="min-w-0">
              <h1 className="admin-hero-title">Thêm điều phối viên</h1>
              <p className="admin-hero-description">Tạo thông tin đơn vị và người phụ trách. Sau khi lưu, tiếp tục thiết lập phạm vi phụ trách.</p>
            </div>
          </div>
          <button type="button" onClick={goBack} className="btn h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Lucide.ArrowLeft size={17} /> Quay lại danh sách
          </button>
        </div>
      </section>

      <form onSubmit={submit} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Lucide.Building2 size={19} /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Thông tin điều phối viên</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Các trường có dấu * là bắt buộc.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 flex items-center text-sm font-semibold text-slate-700">Tên đơn vị cung cấp *{submitted && <FieldHint message={validation.providerName} />}</span>
            <input name="providerName" value={form.providerName} onChange={(event) => updateForm('providerName', event.target.value)} aria-invalid={submitted && Boolean(validation.providerName)} className={`input input-bordered w-full rounded-2xl ${submitted && validation.providerName ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400' : 'border-slate-200'}`} placeholder="Ví dụ: Công ty Môi trường đô thị" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center text-sm font-semibold text-slate-700">Tên người phụ trách *{submitted && <FieldHint message={validation.coordinatorName} />}</span>
            <input name="coordinatorName" value={form.coordinatorName} onChange={(event) => updateForm('coordinatorName', event.target.value)} aria-invalid={submitted && Boolean(validation.coordinatorName)} className={`input input-bordered w-full rounded-2xl ${submitted && validation.coordinatorName ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400' : 'border-slate-200'}`} placeholder="Nhập họ và tên" />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center text-sm font-semibold text-slate-700">Số điện thoại *{submitted && <FieldHint message={validation.phoneNumber} />}</span>
            <input name="phoneNumber" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} value={form.phoneNumber} onChange={(event) => updateForm('phoneNumber', event.target.value)} aria-invalid={submitted && Boolean(validation.phoneNumber)} className={`input input-bordered w-full rounded-2xl tabular-nums ${submitted && validation.phoneNumber ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400' : 'border-slate-200'}`} placeholder="Ví dụ: 0912345678" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
            <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className="input input-bordered w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100" placeholder="name@example.com" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Địa chỉ</span>
            <input value={form.address} onChange={(event) => updateForm('address', event.target.value)} className="input input-bordered w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100" placeholder="Nhập địa chỉ đơn vị" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Ghi chú</span>
            <textarea value={form.note} onChange={(event) => updateForm('note', event.target.value)} className="textarea textarea-bordered min-h-32 w-full rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100" placeholder="Thông tin bổ sung về đơn vị hoặc người phụ trách" />
          </label>
        </div>

        {error && <div className="mx-6 mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={goBack} disabled={saving} className="btn rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Hủy</button>
          <button type="submit" disabled={saving} className="btn rounded-xl border-0 bg-blue-600 px-5 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">
            {saving ? <span className="loading loading-spinner loading-sm" /> : <Lucide.Save size={17} />}
            Lưu và thiết lập phạm vi
          </button>
        </div>
      </form>

      {showLeaveConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex min-h-screen w-screen items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="leave-coordinator-title">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Lucide.TriangleAlert size={22} />
              </div>
              <div>
                <h2 id="leave-coordinator-title" className="text-lg font-bold text-slate-950 dark:text-slate-50">Rời trang và bỏ dữ liệu?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Thông tin điều phối viên bạn vừa nhập chưa được lưu. Nếu quay lại danh sách, dữ liệu này sẽ bị mất.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowLeaveConfirm(false)} className="btn rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Tiếp tục nhập</button>
              <button type="button" onClick={leavePage} className="btn rounded-xl border-0 bg-rose-600 px-5 text-white hover:bg-rose-700">Bỏ dữ liệu và quay lại</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
