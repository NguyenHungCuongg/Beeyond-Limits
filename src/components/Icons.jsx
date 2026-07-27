/**
 * Beeyond Limits – SVG Icon Library
 *
 * Consistent style: 24×24 viewBox, 1.5 stroke, round caps/joins.
 * Play & Pause are filled for better recognition at small sizes.
 */

const Icon = ({ children, size = 20, className = "", strokeWidth = 1.5, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

/* ── Navigation ───────────────────────────────────────────── */

export const ChevronLeft = (props) => (
  <Icon {...props}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);

export const ChevronRight = (props) => (
  <Icon {...props}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

export const Home = (props) => (
  <Icon {...props}>
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </Icon>
);

/* ── Actions ──────────────────────────────────────────────── */

export const Plus = (props) => (
  <Icon {...props}>
    <path d="M12 5v14m-7-7h14" />
  </Icon>
);

export const X = (props) => (
  <Icon {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);

export const Check = (props) => (
  <Icon {...props}>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
);

export const Trash = (props) => (
  <Icon {...props}>
    <path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </Icon>
);

export const Pencil = (props) => (
  <Icon {...props}>
    <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Icon>
);

export const RotateCcw = (props) => (
  <Icon {...props}>
    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);

/* ── Feature icons ────────────────────────────────────────── */

export const Clock = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
);

export const ClipboardCheck = (props) => (
  <Icon {...props}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 14l2 2 4-4" />
  </Icon>
);

export const ShieldCheck = (props) => (
  <Icon {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

export const Globe = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </Icon>
);

export const Headphones = (props) => (
  <Icon {...props}>
    <path d="M3 18v-6a9 9 0 0118 0v6" />
    <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
  </Icon>
);

export const Coffee = (props) => (
  <Icon {...props}>
    <path d="M18 8h1a4 4 0 010 8h-1" />
    <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
    <path d="M6 1v3m4-3v3m4-3v3" />
  </Icon>
);

/* ── Playback (filled for visibility at small sizes) ──────── */

export const Play = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
  </svg>
);

export const Pause = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

/* ── Status ───────────────────────────────────────────────── */

export const Lock = (props) => (
  <Icon {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </Icon>
);

export const Unlock = (props) => (
  <Icon {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 019.9-1" />
  </Icon>
);

export const Ban = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M4.93 4.93l14.14 14.14" />
  </Icon>
);

/* ── Audio ────────────────────────────────────────────────── */

export const Volume = (props) => (
  <Icon {...props}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.54 8.46a5 5 0 010 7.07" />
    <path d="M19.07 4.93a10 10 0 010 14.14" />
  </Icon>
);

export const VolumeX = (props) => (
  <Icon {...props}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M16 9l6 6m-6 0l6-6" />
  </Icon>
);

/* ── Nature sounds ────────────────────────────────────────── */

export const Feather = (props) => (
  <Icon {...props}>
    <path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z" />
    <path d="M16 8L2 22" />
    <path d="M17.5 15H9" />
  </Icon>
);

export const Flame = (props) => (
  <Icon {...props}>
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
  </Icon>
);

export const Waves = (props) => (
  <Icon {...props}>
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </Icon>
);

export const CloudRain = (props) => (
  <Icon {...props}>
    <path d="M20 16.2A5 5 0 0018 7h-1.26a8 8 0 10-11.62 9" />
    <path d="M13 17l-2 5m-4-5l-2 5m12-5l-2 5" />
  </Icon>
);

export const Zap = (props) => (
  <Icon {...props}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </Icon>
);

export const Wind = (props) => (
  <Icon {...props}>
    <path d="M17.7 7.7a2.5 2.5 0 111.8 4.3H2" />
    <path d="M9.6 4.6A2 2 0 1111 8H2" />
    <path d="M12.6 19.4A2 2 0 1014 16H2" />
  </Icon>
);

/* ── Decorative ───────────────────────────────────────────── */

export const Sparkles = (props) => (
  <Icon {...props}>
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </Icon>
);

export const Loader = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className={`animate-spin ${className}`}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2a10 10 0 019.8 8" />
  </svg>
);
