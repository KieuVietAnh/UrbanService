import clsx from './clsx';

function Badge({ intent = 'neutral', children, className }) {
  const intentClass = {
    neutral: 'status-neutral',
    info: 'status-info',
    success: 'status-success',
    warning: 'status-warning',
    danger: 'status-danger',
  }[intent];

  return (
    <span className={clsx('status-label border-0 shadow-none', intentClass, className)}>
      {children}
    </span>
  );
}

export default Badge;
