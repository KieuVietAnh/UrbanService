export default function clsx(...parts) {
  return parts
    .flatMap((p) => {
      if (!p) return [];
      if (typeof p === 'string') return p.split(' ');
      if (Array.isArray(p)) return p;
      if (typeof p === 'object') return Object.entries(p).filter(([, v]) => v).map(([k]) => k);
      return [String(p)];
    })
    .filter(Boolean)
    .join(' ');
}
