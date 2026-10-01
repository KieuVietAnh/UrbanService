import clsx from './clsx';

const base = 'inline-flex items-center justify-center gap-2 rounded-[1rem] border border-slate-200/80 font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-60';

function Button({ variant = 'primary', size = 'md', children, className, ...rest }) {
  const variantClass = {
    primary: 'border-transparent bg-[var(--brand-primary)] text-[var(--brand-on-primary)] shadow-[0_14px_28px_rgba(37,99,235,0.22)] hover:bg-[var(--brand-primary-dark)] hover:shadow-[0_18px_36px_rgba(37,99,235,0.28)]',
    ghost: 'border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-800',
    outline: 'border border-slate-200/90 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  }[variant];

  const sizeClass = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg',
  }[size];

  return (
    <button className={clsx(base, variantClass, sizeClass, className)} {...rest}>
      {children}
    </button>
  );
}

export default Button;
