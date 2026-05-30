export const colors = {
  bg: '#030201',
  surface: '#0c0906',
  surfaceUp: '#16110a',
  border: '#241a0f',
  borderGlow: '#6b4208',

  amber: '#f59e0b',
  amberBright: '#fbbf24',
  amberGlow: '#fde68a',
  amberDim: '#78350f',
  amberFaint: '#1c1208',

  text: '#fef3c7',
  textSub: '#d97706',
  textMuted: '#7c5526',

  success: '#4ade80',
  successDim: '#052e16',
  danger: '#f87171',
  dangerDim: '#450a0a',
} as const;

export type Color = keyof typeof colors;
