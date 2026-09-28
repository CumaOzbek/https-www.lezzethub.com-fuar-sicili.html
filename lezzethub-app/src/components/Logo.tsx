import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../lib/theme';

/** Yuvarlak rozet içinde ince çizgili, buğulu çorba kasesi. */
export function LogoMark({ size = 40, inverted = false }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? colors.cream : colors.primary;
  const fg = inverted ? colors.primary : colors.cream;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={23} fill={bg} />
      <Circle cx={24} cy={24} r={20} fill="none" stroke={fg} strokeOpacity={0.35} strokeWidth={0.8} />
      {/* buğu */}
      <Path d="M18 12c-1.6 1.8 1.6 3.2 0 5" stroke={fg} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M24 10c-1.6 1.8 1.6 3.6 0 6" stroke={fg} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M30 12c-1.6 1.8 1.6 3.2 0 5" stroke={fg} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      {/* kase */}
      <Path d="M11 22h26" stroke={fg} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M12.5 22c0.8 6.8 5.4 11 11.5 11s10.7-4.2 11.5-11" stroke={fg} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path d="M19 36.5h10" stroke={fg} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M17 26.5c1.8 2.4 4.2 3.3 7 3.3" stroke={fg} strokeOpacity={0.6} strokeWidth={1.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function Logo({ size = 40, inverted = false, tagline = false }: { size?: number; inverted?: boolean; tagline?: boolean }) {
  const text = inverted ? colors.cream : colors.ink;
  const accent = inverted ? colors.creamDeep : colors.primary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.25 }}>
      <LogoMark size={size} inverted={inverted} />
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontSize: size * 0.55, fontWeight: '900', color: text, letterSpacing: -0.5 }}>Lezzet</Text>
          <Text style={{ fontSize: size * 0.42, fontWeight: '600', color: accent, letterSpacing: size * 0.09, marginLeft: 3 }}>
            HUB
          </Text>
        </View>
        {tagline && (
          <Text style={{ fontSize: size * 0.24, color: inverted ? colors.creamDeep : colors.muted, marginTop: 1 }}>
            Hatay’ın ev lezzetleri, mahallenden
          </Text>
        )}
      </View>
    </View>
  );
}
