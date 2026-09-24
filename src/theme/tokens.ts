/**
 * Veyra design tokens — "Soft Premium AI".
 * Screens read these through useTheme(); never hard-code colours in components.
 */

/** Raw brand palette. Components should prefer semantic theme colours below. */
export const palette = {
  deepNavy: '#0F172A',
  darkNavy: '#111827',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  purple: '#8B7CF6',
  lavender: '#A78BFA',
  orchid: '#C084FC',
  blue: '#4F7CFF',
  cyan: '#38BDF8',
  pink: '#F472B6',
  peach: '#FDBA74',
  yellow: '#FDE68A',
  green: '#10B981',
  red: '#F87171',
  orange: '#FB923C',
  gray: '#64748B',
  lightGray: '#E2E8F0',
  veryLight: '#F8FAFC',
  white: '#FFFFFF',
} as const;

/** Brand gradient: Blue → Indigo → Purple → Pink → Peach. Use selectively. */
export const gradients = {
  brand: {
    colors: ['#6366F1', '#8B5CF6', '#C084FC', '#F472B6', '#FDBA74'] as const,
    locations: [0, 0.35, 0.55, 0.75, 1] as const,
  },
  /** Cooler variant for AI accents and the centre nav button. */
  ai: {
    colors: ['#4F7CFF', '#6366F1', '#8B5CF6', '#C084FC'] as const,
    locations: [0, 0.35, 0.7, 1] as const,
  },
} as const;

/** Soft tint pair: background + readable foreground. */
export type Tint = { bg: string; fg: string };

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  focusRing: string;
  income: string;
  expense: string;
  balance: string;
  success: string;
  warning: string;
  danger: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  overlay: string;
  /** Faint wash behind AI surfaces (used with gradient accents). */
  aiWash: string;
};

export type ThemeTints = {
  priorityHigh: Tint;
  priorityMedium: Tint;
  priorityLow: Tint;
  done: Tint;
  meeting: Tint;
  focus: Tint;
  personal: Tint;
  bill: Tint;
};

const light: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  primary: '#6366F1',
  primarySoft: '#EEF0FF',
  onPrimary: '#FFFFFF',
  focusRing: '#6366F1',
  income: '#059669',
  expense: '#E05252',
  balance: '#0F172A',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  tabBar: '#FFFFFF',
  tabActive: '#6366F1',
  tabInactive: '#94A3B8',
  overlay: 'rgba(15, 23, 42, 0.4)',
  aiWash: '#F5F3FF',
};

const dark: ThemeColors = {
  background: '#0B1020',
  surface: '#111827',
  surfaceElevated: '#172033',
  surfaceMuted: '#172033',
  border: '#263247',
  borderStrong: '#334155',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  primary: '#818CF8',
  primarySoft: 'rgba(99, 102, 241, 0.16)',
  onPrimary: '#FFFFFF',
  focusRing: '#A5B4FC',
  income: '#34D399',
  expense: '#F87171',
  balance: '#F8FAFC',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  tabBar: '#111827',
  tabActive: '#A5B4FC',
  tabInactive: '#64748B',
  overlay: 'rgba(0, 0, 0, 0.55)',
  aiWash: 'rgba(139, 92, 246, 0.10)',
};

const lightTints: ThemeTints = {
  priorityHigh: { bg: '#FEF2F2', fg: '#DC4A4A' },
  priorityMedium: { bg: '#FFF4E8', fg: '#C2610C' },
  priorityLow: { bg: '#EEF3FF', fg: '#3B63D9' },
  done: { bg: '#ECFDF5', fg: '#059669' },
  meeting: { bg: '#EEF0FF', fg: '#4F46E5' },
  focus: { bg: '#F5F0FF', fg: '#7C3AED' },
  personal: { bg: '#FFF7ED', fg: '#C2610C' },
  bill: { bg: '#FDF2F8', fg: '#BE3A82' },
};

const darkTints: ThemeTints = {
  priorityHigh: { bg: 'rgba(248, 113, 113, 0.14)', fg: '#FCA5A5' },
  priorityMedium: { bg: 'rgba(251, 146, 60, 0.14)', fg: '#FDBA74' },
  priorityLow: { bg: 'rgba(79, 124, 255, 0.16)', fg: '#93B4FF' },
  done: { bg: 'rgba(16, 185, 129, 0.14)', fg: '#6EE7B7' },
  meeting: { bg: 'rgba(99, 102, 241, 0.18)', fg: '#A5B4FC' },
  focus: { bg: 'rgba(139, 92, 246, 0.18)', fg: '#C4B5FD' },
  personal: { bg: 'rgba(253, 186, 116, 0.14)', fg: '#FDBA74' },
  bill: { bg: 'rgba(244, 114, 182, 0.14)', fg: '#F9A8D4' },
};

export const themes = {
  light: { colors: light, tints: lightTints },
  dark: { colors: dark, tints: darkTints },
} as const;

export type ColorName = keyof ThemeColors;
export type TintName = keyof ThemeTints;

/** 4-pt spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  button: 14,
  lg: 16,
  card: 20,
  panel: 24,
  pill: 999,
} as const;

/** Inter font family per weight (custom fonts can't rely on fontWeight on Android). */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontWeightName = keyof typeof fontFamily;

type TypeStyle = { fontSize: number; lineHeight: number; weight: FontWeightName; letterSpacing?: number };

export const typography = {
  display: { fontSize: 30, lineHeight: 38, weight: 'bold', letterSpacing: -0.6 },
  title: { fontSize: 24, lineHeight: 32, weight: 'bold', letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, weight: 'semibold', letterSpacing: -0.2 },
  subheading: { fontSize: 16, lineHeight: 22, weight: 'semibold' },
  body: { fontSize: 16, lineHeight: 24, weight: 'regular' },
  bodySm: { fontSize: 14, lineHeight: 20, weight: 'regular' },
  label: { fontSize: 14, lineHeight: 20, weight: 'medium' },
  caption: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  overline: { fontSize: 12, lineHeight: 16, weight: 'semibold', letterSpacing: 0.8 },
  number: { fontSize: 28, lineHeight: 34, weight: 'bold', letterSpacing: -0.5 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typography;

/** CSS box-shadow strings (supported by RN new architecture and web). */
export const shadows = {
  light: {
    none: undefined,
    sm: '0px 1px 2px rgba(15, 23, 42, 0.04), 0px 1px 3px rgba(15, 23, 42, 0.05)',
    md: '0px 4px 12px rgba(15, 23, 42, 0.06), 0px 1px 3px rgba(15, 23, 42, 0.04)',
    lg: '0px 12px 32px rgba(15, 23, 42, 0.10), 0px 2px 6px rgba(15, 23, 42, 0.05)',
    glow: '0px 8px 24px rgba(99, 102, 241, 0.35)',
  },
  dark: {
    none: undefined,
    sm: '0px 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0px 4px 14px rgba(0, 0, 0, 0.35)',
    lg: '0px 14px 36px rgba(0, 0, 0, 0.45)',
    glow: '0px 8px 24px rgba(129, 140, 248, 0.35)',
  },
} as const;

export type ShadowName = keyof typeof shadows.light;

export const motion = {
  fast: 180,
  base: 280,
  slow: 480,
  /** Gentle spring — no excessive bounce. */
  spring: { damping: 20, stiffness: 220, mass: 0.9 },
} as const;

/** Layout breakpoints (dp). Mobile-first. */
export const breakpoints = { tablet: 768, desktop: 1024, wide: 1280 } as const;

/** Minimum accessible touch target. */
export const touchTarget = 44;
