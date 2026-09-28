import { Platform } from 'react-native';

export const colors = {
  primary: '#ea580c',
  primaryDark: '#c2410c',
  primaryLight: '#fb923c',
  cream: '#fffaf5',
  creamDeep: '#ffedd5',
  peach: '#fed7aa',
  card: '#ffffff',
  ink: '#2b1a10',
  inkSoft: '#5b4636',
  muted: '#9a8474',
  line: '#f3e2d2',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#ca8a04',
  warningBg: '#fef9c3',
  info: '#2563eb',
  infoBg: '#dbeafe',
  neutral: '#6b7280',
  neutralBg: '#f3f4f6',
};

/** Web'de odak çerçevesini kaldırır; iOS/Android 'none' değerini desteklemediği için yalnızca web'e uygulanır. */
export const noOutline = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const space = (n: number) => n * 4;

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 18px rgba(194, 65, 12, 0.10)' } as object,
  default: {
    shadowColor: '#c2410c',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});

export const shadowSoft = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(194, 65, 12, 0.08)' } as object,
  default: {
    shadowColor: '#c2410c',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});

export const font = {
  h1: { fontSize: 26, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.inkSoft, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted },
};
