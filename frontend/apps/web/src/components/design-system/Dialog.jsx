import { useEffect } from 'react';
import clsx from './clsx';

function Dialog({ open = false, onClose = () => {}, title, children, className }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40"
        role="button"
        tabIndex={0}
        aria-label="Đóng hộp thoại"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <div className={clsx('z-10 w-full sm:max-w-2xl rounded-t-lg sm:rounded-lg bg-white p-4 sm:p-6 shadow-lg', className)} role="dialog" aria-modal="true" aria-label={title}>
        {title && <h3 className="heading-3 mb-3">{title}</h3>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export default Dialog;
