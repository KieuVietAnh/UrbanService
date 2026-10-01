import { useEffect, useRef } from 'react';

export default function PageTransition({ children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // trigger enter transition on next frame
    requestAnimationFrame(() => el.classList.add('entered'));
  }, []);

  return (
    <div ref={ref} className={`page-transition ${className}`}>
      {children}
    </div>
  );
}
