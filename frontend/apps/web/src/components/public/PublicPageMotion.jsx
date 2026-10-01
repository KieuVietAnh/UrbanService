import { useEffect, useRef, useState } from 'react';

export const PublicPageMotion = ({ children, className = '' }) => {
  const rootRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const frame = window.requestAnimationFrame(() => {
      setIsReady(true);
    });

    const revealItems = Array.from(
      root.querySelectorAll('[data-public-reveal]')
    );

    revealItems.forEach((item, index) => {
      item.style.setProperty(
        '--public-reveal-delay',
        `${Math.min(index, 5) * 55}ms`
      );
    });

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`public-page-motion ${isReady ? 'is-ready' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export default PublicPageMotion;
