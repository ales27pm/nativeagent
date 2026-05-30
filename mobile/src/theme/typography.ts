import { Platform } from 'react-native';

export const fonts = {
  display: 'VT323',
  mono: 'ShareTechMono',
  monoFallback: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

export const sizes = {
  xs: 10,
  sm: 12,
  base: 13,
  md: 15,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 40,
  hero: 68,
} as const;

export const tracking = {
  tight: -0.3,
  normal: 0,
  wide: 1,
  wider: 2,
  widest: 4,
  hero: 6,
} as const;

export type FontToken = keyof typeof fonts;
export type SizeToken = keyof typeof sizes;
