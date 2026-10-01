import { useState } from 'react';

export default function MapInteraction({ children, active = false, className = '', onToggle }) {
  const [zoomed, setZoomed] = useState(!!active);

  const toggle = () => {
    setZoomed((s) => {
      const next = !s;
      if (onToggle) onToggle(next);
      return next;
    });
  };

  return (
    <div
      onClick={toggle}
      className={`map-interaction ${zoomed ? 'zoomed' : ''} ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); }}
    >
      {children}
    </div>
  );
}
