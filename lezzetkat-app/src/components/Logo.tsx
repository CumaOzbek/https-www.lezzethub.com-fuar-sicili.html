import { Image, Text, View } from 'react-native';

import { colors } from '../lib/theme';

const MARK = require('../../assets/brand/logo-mark.png');

/** Marka renkleri (logodan): koyu kırmızı "Lezzet", turuncu "KAT". */
export const BRAND = { red: '#8E0B1A', orange: '#F28C0F' };

/** Beyaz yuvarlak rozet içinde LezzetKAT işareti (şef şapkası ve servis kubbesi). */
export function LogoMark({ size = 40, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 1.5 : 0,
        borderColor: 'rgba(255,255,255,0.6)',
      }}
    >
      <Image source={MARK} style={{ width: size * 0.82, height: size * 0.82 }} resizeMode="contain" accessibilityLabel="LezzetKAT" />
    </View>
  );
}

/** `inverted`: koyu (ana renk) zemin üzerinde açık renkli yazı. */
export function Logo({ size = 40, inverted = false, tagline = false }: { size?: number; inverted?: boolean; tagline?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.25 }} accessibilityRole="header" accessibilityLabel="LezzetKAT">
      <LogoMark size={size} ring={inverted} />
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontSize: size * 0.55, fontWeight: '900', color: inverted ? colors.cream : BRAND.red, letterSpacing: -0.5 }}>Lezzet</Text>
          <Text style={{ fontSize: size * 0.55, fontWeight: '900', color: BRAND.orange, letterSpacing: -0.3 }}>KAT</Text>
        </View>
        {tagline && (
          <Text style={{ fontSize: size * 0.24, color: inverted ? 'rgba(250,247,242,0.8)' : colors.muted, marginTop: 1 }}>
            Türkiye’nin ev lezzetleri, mahallenden
          </Text>
        )}
      </View>
    </View>
  );
}
