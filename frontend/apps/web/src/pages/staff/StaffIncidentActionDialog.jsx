import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as Lucide from 'lucide-react';

import Button from '../../components/design-system/Button';

export default function StaffIncidentActionDialog({
  busy = false,
  cancelLabel = 'Quay lại',
  children,
  confirmLabel,
  description,
  icon: Icon = Lucide.CircleHelp,
  onClose,
  onConfirm,
  open = false,
  title,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocusedElement = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    const dashboardScrollContainer = document.querySelector('[data-dashboard-scroll-container]');
    const previousDashboardOverflow = dashboardScrollContainer?.style.overflowY || '';
    document.body.style.overflow = 'hidden';
    if (dashboardScrollContainer) dashboardScrollContainer.style.overflowY = 'hidden';

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector('[data-staff-dialog-primary]')?.focus();
    }, 0);
    const handleDialogKeyboard = (event) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusableElements = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])];
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeyboard);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousBodyOverflow;
      if (dashboardScrollContainer) dashboardScrollContainer.style.overflowY = previousDashboardOverflow;
      window.removeEventListener('keydown', handleDialogKeyboard);
      previouslyFocusedElement?.focus?.();
    };
  }, [busy, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-transparent focus-visible:outline-none"
        aria-label="Đóng hộp thoại"
        disabled={busy}
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-950"
      >
        <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-5 dark:border-slate-800 dark:bg-slate-900/70">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]" aria-hidden="true">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-black text-slate-950 dark:text-white">{title}</h2>
            {description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-blue-950"
            aria-label="Đóng hộp thoại"
            disabled={busy}
            onClick={onClose}
          >
            <Lucide.X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[min(62vh,34rem)] overflow-y-auto px-5 py-5">{children}</div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-900/60">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button data-staff-dialog-primary type="button" size="sm" disabled={busy} onClick={onConfirm}>
            {busy ? <Lucide.LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Lucide.Check size={16} aria-hidden="true" />}
            {busy ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
