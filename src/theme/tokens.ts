/**
 * Design tokens — Navy / Silver brand.
 * ใช้ผ่าน useTheme() เท่านั้น ห้าม hardcode สีในหน้าจอ
 */
export const palette = {
  navy900: '#0B1F3A',
  navy700: '#14325C',
  navy500: '#1F4A85',
  navy300: '#4F79B8',
  silver100: '#F4F6F9',
  silver200: '#E3E7ED',
  silver400: '#B8C0CC',
  silver600: '#6F7A8A',
  white: '#FFFFFF',
  black: '#0A0C10',
  gold: '#C9A227',
  green: '#2E9E6B',
  red: '#D64545',
  amber: '#E39B1B',
} as const;

/** 12 สีให้ user เลือกสำหรับ task / area / wallet */
export const accentColors = [
  '#1F4A85', '#4F79B8', '#2E9E6B', '#6BBF8A',
  '#C9A227', '#E39B1B', '#D64545', '#E07A9A',
  '#7B5CC7', '#3BA7B8', '#8A6D4E', '#6F7A8A',
] as const;

export type ThemeColors = {
  background: string; surface: string; surfaceAlt: string; border: string;
  text: string; textSecondary: string; primary: string; onPrimary: string; accent: string;
  income: string; expense: string; warning: string; tabBar: string; tabActive: string; tabInactive: string;
};

const light: ThemeColors = {
  background: palette.silver100,
  surface: palette.white,
  surfaceAlt: palette.silver200,
  border: palette.silver200,
  text: palette.navy900,
  textSecondary: palette.silver600,
  primary: palette.navy700,
  onPrimary: palette.white,
  accent: palette.gold,
  income: palette.green,
  expense: palette.red,
  warning: palette.amber,
  tabBar: palette.white,
  tabActive: palette.navy700,
  tabInactive: palette.silver600,
};

const dark: ThemeColors = {
  background: palette.black,
  surface: '#141A24',
  surfaceAlt: '#1D2532',
  border: '#2A3442',
  text: palette.silver100,
  textSecondary: palette.silver400,
  primary: palette.navy300,
  onPrimary: palette.white,
  accent: palette.gold,
  income: '#4CC48C',
  expense: '#F06A6A',
  warning: '#F2B04B',
  tabBar: '#0F141C',
  tabActive: palette.silver100,
  tabInactive: palette.silver600,
};

export const themes = { light, dark } as const;
export type ColorName = keyof ThemeColors;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34 } as const;
