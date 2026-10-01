import { useEffect } from 'react';

export default function ConfettiBurst({ className = '' }) {
  useEffect(() => {
    // No-op: purely presentational stateless animation
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 flex items-start justify-center z-[900] ${className}`} aria-hidden>
      <svg width="100%" height="160" viewBox="0 0 800 160" preserveAspectRatio="none" className="max-w-4xl">
        <g>
          {/* 12 confetti pieces, subtle spread */}
          {Array.from({ length: 12 }).map((_, i) => {
            const x = 50 + i * 60;
            const delay = (i % 5) * 80;
            return (
              <rect
                key={i}
                x={x}
                y="20"
                width="8"
                height="14"
                rx="2"
                fill={`hsl(${(i * 35) % 360} 80% 55%)`}
                style={{
                  transformOrigin: 'center',
                  animation: `confetti-fall 900ms ${delay}ms cubic-bezier(.22,.9,.31,1) forwards`,
                }}
              />
            );
          })}
        </g>

        <style>{`@keyframes confetti-fall { 0% { transform: translateY(-60px) rotate(0deg); opacity: 0 } 60% { opacity: 1 } 100% { transform: translateY(220px) rotate(320deg); opacity: 1 } }
          @media (prefers-reduced-motion: reduce) { rect { animation: none !important; opacity: 0; } }
        `}</style>
      </svg>
    </div>
  );
}
