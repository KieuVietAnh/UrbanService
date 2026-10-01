import clsx from './clsx';

function Select({ className, children, ...props }) {
  return (
    <select className={clsx('w-full rounded-[1rem] border border-slate-200/90 bg-[rgba(248,250,252,0.9)] px-3 py-2 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-[color-mix(in_srgb,var(--brand-primary)_42%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)]', className)} {...props}>
      {children}
    </select>
  );
}

export default Select;
