import { Platform } from 'react-native';

export const colors = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF2FF',
  accent: '#7C3AED',
  accentSoft: '#F5F3FF',
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  success: '#059669',
  successSoft: '#ECFDF5',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  white: '#FFFFFF',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** System font stack: San Francisco on iOS, Roboto on Android (both Inter-like). */
export const font = {
  family: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
  medium: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: undefined }),
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 3 },
});
