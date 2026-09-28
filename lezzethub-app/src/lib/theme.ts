import { Platform } from 'react-native';

// Palet: güven veren koyu zeytin-petrol yeşili ana renk; sıcak turuncu yalnızca marka vurgusu
// (logo, fiyat, "İlan Ver"); krem-kum tonlarında sıcak nötrler ve kömür grisi metin.
export const colors = {
  // Ana renk (butonlar, başlıklar, seçili durumlar)
  primary: '#1F5E57',
  primaryDark: '#15433E',
  primaryLight: '#4E8C83',
  primarySoft: '#E4EFEB',
  /** Ana renk zemin üzerinde ikincil (soluk) yazı rengi. */
  onPrimaryMuted: '#CFE3DE',
  // Marka vurgusu (sıcaklık): logo, fiyatlar, öne çıkan eylem
  accent: '#E07335',
  accentDark: '#B9551F',
  accentSoft: '#FCEDE1',
  // Bal sarısı: rozet ve küçük vurgular
  honey: '#E6A532',
  honeySoft: '#FBF1DB',
  // Sıcak nötrler
  cream: '#FAF7F2',
  creamDeep: '#F1EBE1',
  peach: '#E3D8C7',
  card: '#FFFFFF',
  ink: '#1E2A29',
  inkSoft: '#4B5957',
  muted: '#87918E',
  line: '#E7E1D7',
  // Durum renkleri
  danger: '#C8372D',
  dangerBg: '#FBE7E4',
  success: '#2E7D4F',
  successBg: '#E1F1E6',
  warning: '#A86B00',
  warningBg: '#FCF1D6',
  info: '#2F5F9E',
  infoBg: '#E3ECF7',
  neutral: '#667270',
  neutralBg: '#EEF0EE',
};

/** Web'de odak çerçevesini kaldırır; iOS/Android 'none' değerini desteklemediği için yalnızca web'e uygulanır. */
export const noOutline = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const space = (n: number) => n * 4;

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 20px rgba(30, 42, 41, 0.08)' } as object,
  default: {
    shadowColor: '#1E2A29',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});

export const shadowSoft = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(30, 42, 41, 0.06)' } as object,
  default: {
    shadowColor: '#1E2A29',
    shadowOpacity: 0.06,
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
