// These are browser stress profiles, not emulated Android system settings.
// The reserved bars reduce the available browser viewport; they do not inject
// react-native-safe-area-context values or prove edge-to-edge behavior.
export const STAFF_SMOKE_PROFILES = Object.freeze({
  baseline: { label: 'Phone · 390 × 844', width: 390, height: 844 },
  small: { label: 'Small phone · 360 × 800', width: 360, height: 800 },
  tiny: { label: 'Tiny phone · 320 × 640', width: 320, height: 640 },
  'large-text': { label: 'Large text · web text × 1.5', width: 360, height: 800, textScale: 1.5 },
  'gesture-frame': { label: 'Gesture-like available area', width: 360, height: 800, reservedBars: { top: 24, bottom: 24 } },
  'three-button-frame': { label: '3-button-like available area', width: 360, height: 800, reservedBars: { top: 24, bottom: 48 } },
  landscape: { label: 'Landscape stress · 844 × 390', width: 844, height: 390 },
  tablet: { label: 'Tablet stress · 800 × 1280', width: 800, height: 1280 },
});

export function smokeProfile(name = 'baseline', overrides = {}) {
  const selected = STAFF_SMOKE_PROFILES[name];
  if (!selected) throw new Error('Unknown Staff smoke profile: ' + name);
  const width = Number(overrides.width ?? selected.width);
  const height = Number(overrides.height ?? selected.height);
  const textScale = Number(overrides.textScale ?? selected.textScale ?? 1);
  const reservedBars = selected.reservedBars ?? { top: 0, bottom: 0 };
  if (![width, height, textScale].every(Number.isFinite) || width < 240 || height < 240 || textScale < 1 || textScale > 3) throw new Error('Invalid Staff smoke geometry');
  return {
    name, label: selected.label, viewport: { width, height: height - reservedBars.top - reservedBars.bottom },
    nominalFrame: { width, height }, reservedBars, textScale,
    evidence: 'Synthetic Expo web geometry with isolated API fixtures; not a native Android device test.',
  };
}

export const COMPATIBILITY_SCREEN_PREFIXES = Object.freeze([
  '01-home', '05-incident-filters', '09-incident-overview', '10-incident-reports',
  '13-incident-timeline', '20-chat-public', '21-chat-draft-error', '23-notifications',
  '26-account-edit', '29-provider-candidates', '34-provider-contacts',
  '39-evidence-uploaded', '40-resolution-form', '43-resolution-history',
]);

// Installed before app code in a browser-only test context. Android's fontScale
// and React Native's layout engine are not changed. Icon fonts are excluded.
export function installSyntheticTextScale(scale) {
  if (scale === 1) return;
  const changed = new WeakSet();
  let pending = false;
  const apply = () => {
    pending = false;
    const updates = [];
    for (const element of document.querySelectorAll('div,span,a,button,label,input,textarea')) {
      if (changed.has(element)) continue;
      const directText = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent.trim()).join('');
      if (!['INPUT', 'TEXTAREA'].includes(element.tagName) && !directText) continue;
      const style = getComputedStyle(element);
      if (/icon|material|awesome|ionicons|feather|octicons|entypo|antdesign|fontisto|zocial/i.test(style.fontFamily)) continue;
      // Preserve symbol-only navigation glyphs. They are icons even when a web
      // stack header renders them with the system text font.
      if (directText && /^[←→‹›⌂…]+$/u.test(directText)) continue;
      const size = parseFloat(style.fontSize);
      if (!Number.isFinite(size)) continue;
      updates.push({ element, size, lineHeight: parseFloat(style.lineHeight) });
    }
    // Read computed styles before writing any: inherited text must not scale twice.
    for (const { element, size, lineHeight } of updates) {
      changed.add(element);
      element.style.setProperty('font-size', size * scale + 'px', 'important');
      if (Number.isFinite(lineHeight)) element.style.setProperty('line-height', lineHeight * scale + 'px', 'important');
    }
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(apply); } };
  const start = () => {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    schedule();
  };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
}
