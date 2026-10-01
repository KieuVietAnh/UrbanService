 

function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={className} role="status" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-100 rounded-md my-2 animate-pulse" />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
