import * as Lucide from 'lucide-react';

export default function ConfirmationModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-[1.55rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,255,0.96))] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-blue-50 text-blue-700">
            <Lucide.AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            {children ? <div className="mt-4">{children}</div> : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="btn btn-ghost rounded-[1rem]">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-primary rounded-[1rem]">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
