import { palette } from './colors';

// Semantic Token System
// Maps raw palette colors to functional design tokens.
// Aligned with web index.css CSS variable system (source of truth).
// Web vars: --brand-primary, --surface, --bg, --ink, --muted,
//           --color-success/bg, --color-warning/bg, --color-danger/bg, --color-info/bg
export const semantics = {
  // Background semantic tokens
  bg: {
    app: palette.slate[50],            // web --bg: #f8fafc
    surface: palette.white,            // web --surface: #ffffff
    surfaceSubtle: palette.slate[100], // hover/pressed surface
    surfaceDark: palette.navy[800],    // web dark hero gradient start: #0d1d36
    card: palette.white,
    cardSubtle: palette.blue[50],
    input: palette.slate[50],
    inputFocused: palette.white,
    overlay: 'rgba(15, 23, 42, 0.5)', // web: bg-black/40 ≈ rgba(2,6,23,0.5)
    primary: palette.blue[550],        // web --brand-primary: #0b56d9
    primarySoft: palette.blue[50],     // web: bg-primary/10
    primaryMuted: palette.blue[100],
    // Public (citizen-facing) surface tokens — from web citizen dashboard CSS vars
    publicSurface: 'rgba(248, 251, 255, 0.97)',    // --public-surface light
    publicSurfaceSoft: 'rgba(232, 239, 248, 0.95)', // --public-surface-soft light
    publicSurfaceStrong: '#f7faff',                  // --public-surface-strong light
    // Hero / dark panel backgrounds
    heroDark: palette.navy[900],       // #060f24 — deepest navy for hero
    heroNavy: palette.navy[800],       // #0d1d36 — hero gradient start
  },

  // Text semantic tokens
  text: {
    primary: palette.slate[900],       // web --ink: #0f172a
    secondary: palette.slate[700],
    muted: palette.slate[500],         // web --muted: #6b7280
    lightMuted: palette.slate[400],
    inverse: palette.white,
    brand: palette.blue[550],          // web --brand-primary: #0b56d9
    link: palette.blue[550],
    danger: palette.red[700],          // web --color-danger: #b91c1c
    success: palette.emerald[700],     // web --color-success: #047857
    warning: palette.amber[700],       // web --color-warning: #b45309
    // Citizen-facing text from web CSS vars
    publicTitle: palette.slate[900],
    publicCopy: '#4f6077',             // --public-copy light
    publicMuted: '#718198',            // --public-muted light
  },

  // Border semantic tokens
  border: {
    default: palette.slate[200],       // web: border-slate-200
    light: palette.slate[100],
    strong: palette.slate[300],
    focus: palette.blue[550],          // web: ring-2 ring-blue-500/30
    primary: palette.blue[550],
    danger: palette.red[500],
    // Public-facing border
    publicBorder: 'rgba(148, 163, 184, 0.52)', // --public-border
    publicBorderSoft: 'rgba(186, 205, 229, 0.86)',
  },

  // Interactive state semantic tokens
  interactive: {
    primaryBg: palette.blue[550],      // web bg-blue-600
    primaryPressBg: palette.blue[700], // web hover:bg-blue-700
    primaryText: palette.white,
    secondaryBg: palette.blue[50],     // web bg-primary/10
    secondaryBorder: palette.blue[550],
    secondaryText: palette.blue[550],
    disabledBg: palette.slate[200],
    disabledText: palette.slate[400],
    dangerBg: palette.red[500],
    dangerPressBg: palette.red[700],
    dangerText: palette.white,
  },

  // Intent-based semantic styles (badges, pills, alerts)
  // Aligned with web badge classes: .status-info, .status-success, .status-warning, .status-danger
  intent: {
    info: {
      bg: palette.blue[50],            // web --color-info-bg: #eff6ff
      text: '#1D4ED8',
      dot: palette.blue[500],
      border: palette.blue[200],
    },
    warning: {
      bg: palette.amber[50],           // web --color-warning-bg: #fffbeb
      text: palette.amber[700],        // web --color-warning: #b45309
      dot: palette.amber[500],
      border: palette.amber[200],
    },
    success: {
      bg: palette.emerald[50],         // web --color-success-bg: #ecfdf5
      text: palette.emerald[700],      // web --color-success: #047857
      dot: palette.emerald[500],
      border: palette.emerald[200],
    },
    danger: {
      bg: palette.red[50],             // web --color-danger-bg: #fff1f2
      text: palette.red[700],          // web --color-danger: #b91c1c
      dot: palette.red[500],
      border: palette.red[200],
    },
    neutral: {
      bg: palette.slate[100],
      text: palette.slate[700],
      dot: palette.slate[400],
      border: palette.slate[200],
    },
  },

  // Ticket & Process Status semantic tokens
  // Labels aligned with web's getResidentStatusMeta() in Dashboard.jsx
  status: {
    pending: {
      bg: palette.amber[50],
      text: palette.amber[700],
      dot: palette.amber[500],
      border: palette.amber[200],
    },
    processing: {
      bg: palette.blue[50],
      text: '#1D4ED8',
      dot: palette.blue[500],
      border: palette.blue[200],
    },
    waiting: {
      bg: palette.purple[100],
      text: palette.purple[800],
      dot: palette.purple[500],
      border: palette.purple[200],
    },
    verified: {
      bg: palette.emerald[50],
      text: palette.emerald[700],
      dot: palette.emerald[500],
      border: palette.emerald[200],
    },
    resolved: {
      bg: palette.emerald[50],
      text: palette.emerald[700],
      dot: palette.emerald[500],
      border: palette.emerald[200],
    },
    closed: {
      bg: palette.slate[100],
      text: palette.slate[700],
      dot: palette.slate[400],
      border: palette.slate[200],
    },
    rejected: {
      bg: palette.red[50],
      text: palette.red[700],
      dot: palette.red[500],
      border: palette.red[200],
    },
  },

  // Toast & Banner Alert Feedback tokens
  feedback: {
    success: {
      bg: palette.emerald[50],
      text: palette.emerald[700],
      icon: palette.emerald[700],
      border: palette.emerald[200],
    },
    error: {
      bg: palette.red[50],
      text: palette.red[700],
      icon: palette.red[500],
      border: palette.red[200],
    },
    warning: {
      bg: palette.amber[50],
      text: palette.amber[700],
      icon: palette.amber[500],
      border: palette.amber[200],
    },
    info: {
      bg: palette.blue[50],
      text: '#1D4ED8',
      icon: palette.blue[550],
      border: palette.blue[200],
    },
  },
} as const;

export type Semantics = typeof semantics;
