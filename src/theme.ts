import { MD3LightTheme } from 'react-native-paper';

/**
 * A fixed, high-contrast light theme for the POS. We deliberately do NOT follow
 * the system dark/light setting: a point-of-sale used in a shop needs
 * predictable, readable contrast in any lighting, and forcing light avoids the
 * "light text on a white modal" problem that dark mode caused.
 */
export const appTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0B6E4F', // verde retail, buen contraste con texto blanco
    onPrimary: '#FFFFFF',
    primaryContainer: '#8FF0C6',
    onPrimaryContainer: '#002013',
    secondary: '#1565C0',
    onSecondary: '#FFFFFF',
    background: '#F6F7F9',
    onBackground: '#111417',
    surface: '#FFFFFF',
    onSurface: '#111417', // texto principal casi negro → máxima legibilidad
    onSurfaceVariant: '#3F464C', // texto secundario con contraste suficiente
    outline: '#7A828A',
    outlineVariant: '#C7CDD2',
    error: '#B3261E',
    onError: '#FFFFFF',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level2: '#FFFFFF',
    },
  },
};

export type AppTheme = typeof appTheme;
