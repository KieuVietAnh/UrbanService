import { useEffect, useRef } from 'react';

export default function StatusTransition({ children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // add a soft shadow when mounted to hint change
    el.classList.add('status-transition');
  }, []);

  return (
    <span ref={ref} className={className}>
      {children}
    </span>
  );
}
