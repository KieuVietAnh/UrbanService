import { useEffect, useRef } from 'react';

export default function TimelineProgress({ percent = 0, className = '' }) {
  const barRef = useRef(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // animate width
    requestAnimationFrame(() => {
      el.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    });
  }, [percent]);

  return (
    <div className={`timeline-progress ${className}`} aria-hidden>
      <div ref={barRef} className="bar" />
    </div>
  );
}
