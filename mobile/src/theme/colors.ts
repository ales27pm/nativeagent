export const colors = {
  background: '#07090c',
  surface: '#0f1318',
  surfaceElevated: '#161b22',
  border: '#1f2630',
  borderStrong: '#2a3340',
  textPrimary: '#e6edf3',
  textSecondary: '#9aa7b4',
  textMuted: '#5f6c7a',
  accent: '#7ee787',
  accentDim: '#1f3a23',
  warning: '#f0a14a',
  danger: '#ff7b72',
  info: '#79c0ff',
} as const;

export type ColorToken = keyof typeof colors;
