import React from 'react';
import clsx from './clsx';

const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx('w-full rounded-[1rem] border border-slate-200/90 bg-[rgba(248,250,252,0.9)] px-3 py-2 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 focus:border-[color-mix(in_srgb,var(--brand-primary)_42%,transparent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)]', className)}
    {...props}
  />
));

Input.displayName = 'Input';

export default Input;
