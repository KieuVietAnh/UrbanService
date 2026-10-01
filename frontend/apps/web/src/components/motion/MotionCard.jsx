import { useEffect, useRef } from 'react';

export default function MotionCard({ children, index = 0, className = '', style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--i', index);
    // small delay to allow layout then reveal
    requestAnimationFrame(() => el.classList.add('revealed'));
  }, [index]);

  return (
    <div ref={ref} className={`card-reveal ${className}`} style={style}>
      {children}
    </div>
  );
}
