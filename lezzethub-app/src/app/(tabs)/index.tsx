import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingCard, NeighborhoodInput, ProvincePicker } from '../../components/domain';
import { Logo } from '../../components/Logo';
import { Button, Chip, EmptyState, Field, IconButton, Row, useLightStatusBar } from '../../components/ui';
import { ALL_DISTRICTS, ALL_TURKEY, districtsOf, matchesText } from '../../lib/locations';
import { useBlockedIds, useStore, useUnread } from '../../lib/store';
import { colors, font, radius, shadow } from '../../lib/theme';
import { CATEGORIES } from '../../lib/types';

export default function Discover() {
  const { db, me } = useStore();
  const blocked = useBlockedIds();
  useLightStatusBar();
  const unread = useUnread();
  const insets = useSafeAreaInsets();

  const [province, setProvince] = useState<string>(me?.province ?? ALL_TURKEY);
  const [district, setDistrict] = useState<string>(me?.district ?? ALL_DISTRICTS);
  const [cargoOnly, setCargoOnly] = useState(false);
  const [neighborhood, setNeighborhood] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Varsayılan: kullanıcının kendi ilçesi (giriş/çıkış ve profil değişikliğinde güncellenir).
  const sessionKey = `${me?.id ?? ''}|${me?.province ?? ''}|${me?.district ?? ''}`;
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey);
  if (prevSessionKey !== sessionKey) {
    setPrevSessionKey(sessionKey);
    setProvince(me?.province ?? ALL_TURKEY);
    setDistrict(me?.district ?? ALL_DISTRICTS);
    setNeighborhood('');
  }

  const chooseProvince = (p: string) => {
    setProvince(p);
    setDistrict(p === me?.province ? me.district : ALL_DISTRICTS);
    setNeighborhood('');
    setCargoOnly(false);
  };

  const users = useMemo(() => new Map(db.users.map((u) => [u.id, u])), [db.users]);

  // Seçili ilin ilçeleri; kullanıcının kendi ilçesi "Tüm ilçeler"in hemen yanında gösterilir.
  const districtChips = useMemo(() => {
    if (province === ALL_TURKEY) return [];
    const all = districtsOf(province);
    const mine = me && me.province === province ? [me.district] : [];
    return [ALL_DISTRICTS, ...mine, ...all.filter((d) => !mine.includes(d))];
  }, [me, province]);

  const results = useMemo(() => {
    const list = db.listings.filter((l) => {
      const owner = users.get(l.ownerId);
      if (l.status !== 'active' || !owner?.active || blocked.has(l.ownerId)) return false;
      if (cargoOnly) {
        // Kargolu ilanlar konumdan bağımsız olarak tüm Türkiye'ye gönderilir.
        if (!l.delivery.includes('cargo')) return false;
      } else {
        if (province !== ALL_TURKEY && l.province !== province) return false;
        if (province !== ALL_TURKEY && district !== ALL_DISTRICTS && l.district !== district) return false;
      }
      if (neighborhood.trim() && !matchesText(l.neighborhood, neighborhood)) return false;
      if (category && l.category !== category) return false;
      if (query.trim() && !matchesText(`${l.title} ${l.description} ${owner.name}`, query)) return false;
      return true;
    });
    // Kullanıcının kendi ilanları akışın sonunda yer alır.
    return me ? [...list.filter((l) => l.ownerId !== me.id), ...list.filter((l) => l.ownerId === me.id)] : list;
  }, [db.listings, users, province, district, cargoOnly, neighborhood, category, query, me, blocked]);

  const activeFilterCount = (neighborhood.trim() ? 1 : 0) + (category ? 1 : 0);

  const header = (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.heroInner}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Logo size={36} inverted />
            {me ? (
              <IconButton name="notifications-outline" badge={unread.notifications} onPress={() => router.push('/notifications')} color={colors.primaryDark} bg={colors.cream} accessibilityLabel="Bildirimler" />
            ) : (
              <Pressable onPress={() => router.push('/login')} style={styles.loginPill}>
                <Ionicons name="log-in-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontWeight: '800' }}>Giriş</Text>
              </Pressable>
            )}
          </Row>
          <Text style={styles.greet}>{me ? `Merhaba ${me.name.split(' ')[0]} 👋` : 'Hoş geldin 👋'}</Text>
          <Text style={styles.greetSub}>
            {me ? (
              <>
                📍 {me.neighborhood}, {me.district}/{me.province} · Bugün mahallende neler pişiyor?
              </>
            ) : (
              'Türkiye’nin ev lezzetleri, komşundan kapına.'
            )}
          </Text>
          <View style={styles.searchWrap}>
            <Field
              icon="search"
              value={query}
              onChangeText={setQuery}
              placeholder="Mantı, künefe, sarma ara…"
              style={{ marginBottom: 0, flex: 1 }}
              returnKeyType="search"
              right={
                query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                ) : undefined
              }
            />
            <Pressable onPress={() => setShowFilters((s) => !s)} style={[styles.filterBtn, showFilters && { backgroundColor: colors.primaryDark }]} accessibilityLabel="Filtreler">
              <Ionicons name="options-outline" size={22} color="#fff" />
              {activeFilterCount > 0 && (
                <View style={styles.filterDot}>
                  <Text style={{ color: colors.primaryDark, fontSize: 10, fontWeight: '900' }}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <Chip label="Kurye Bul" emoji="🛵" onPress={() => router.push('/couriers')} />
          <Chip label="Kargoyla Türkiye geneli" emoji="📦" active={cargoOnly} onPress={() => setCargoOnly((v) => !v)} />
        </Row>
        {!cargoOnly && (
          <>
            <Text style={styles.filterLabel}>Konum</Text>
            <ProvincePicker label="" value={province} onChange={chooseProvince} includeAll />
            {districtChips.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { marginTop: -4 }]}>
                {districtChips.map((d) => (
                  <Chip
                    key={d}
                    label={d === me?.district && province === me?.province ? `${d} (Benim)` : d}
                    emoji={d === ALL_DISTRICTS ? '🗺️' : undefined}
                    active={district === d}
                    onPress={() => {
                      setDistrict(d);
                      setNeighborhood('');
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {showFilters && (
          <View style={styles.filterPanel}>
            <NeighborhoodInput
              province={province === ALL_TURKEY ? undefined : province}
              district={district === ALL_DISTRICTS ? undefined : district}
              value={neighborhood}
              onChange={setNeighborhood}
              label="Mahalle ara"
              placeholder={district === ALL_DISTRICTS || province === ALL_TURKEY ? 'Mahalle adı yaz' : `${district} içinde mahalle ara`}
              hint="Yazdıkça mahalle önerileri çıkar."
            />
            <Text style={styles.filterLabel}>Kategori</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="Tümü" active={!category} onPress={() => setCategory(null)} />
              {CATEGORIES.map((c) => (
                <Chip key={c.key} label={c.label} emoji={c.emoji} active={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />
              ))}
            </View>
            {activeFilterCount > 0 && (
              <Button
                title="Filtreleri temizle"
                variant="ghost"
                small
                icon="refresh"
                onPress={() => {
                  setNeighborhood('');
                  setCategory(null);
                }}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              />
            )}
          </View>
        )}

        {!showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 2 }]}>
            {CATEGORIES.map((c) => (
              <Pressable key={c.key} onPress={() => setCategory(category === c.key ? null : c.key)} style={[styles.catTile, category === c.key && styles.catTileActive]}>
                <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
                <Text style={[styles.catText, category === c.key && { color: colors.primaryDark }]} numberOfLines={1}>
                  {c.label.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {!me && (
          <View style={styles.promo}>
            <Text style={{ fontSize: 30 }}>👩‍🍳</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 15 }}>Mutfağın gelire dönüşsün</Text>
              <Text style={[font.small, { marginTop: 2 }]}>Ücretsiz kayıt ol, ev yemeklerini mahallene sat.</Text>
            </View>
            <Button title="Kayıt Ol" variant="accent" small onPress={() => router.push('/register')} />
          </View>
        )}

        <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
          <Text style={[font.h2, { flex: 1 }]} numberOfLines={1}>
            {cargoOnly ? 'Kargoyla tüm Türkiye’ye' : province === ALL_TURKEY ? 'Türkiye Geneli' : district === ALL_DISTRICTS ? `${province} lezzetleri` : `${district} lezzetleri`}
          </Text>
          <Text style={font.small}>{results.length} ilan</Text>
        </Row>
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.cream }}
      data={results}
      keyExtractor={(l) => l.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => (
        <View style={styles.body}>
          <ListingCard listing={item} seller={users.get(item.ownerId)} />
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          emoji="🥘"
          title="Bu kriterlere uygun ilan yok"
          text={
            cargoOnly
              ? 'Kargolu ilan bulunamadı. Filtreleri değiştirerek tekrar dene.'
              : province === ALL_TURKEY
                ? 'Filtreleri değiştirerek tekrar dene.'
                : district !== ALL_DISTRICTS
                  ? `${district} için ilan bulunamadı. Tüm ${province}’a bakmak ister misin?`
                  : `${province} için ilan bulunamadı. Kargoyla gönderilen ilanlara göz atabilirsin.`
          }
          action={cargoOnly || province === ALL_TURKEY ? undefined : district !== ALL_DISTRICTS ? `Tüm ${province}` : 'Kargolu ilanlar'}
          onAction={() => (district !== ALL_DISTRICTS ? setDistrict(ALL_DISTRICTS) : setCargoOnly(true))}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroInner: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  greet: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 18 },
  greetSub: { color: colors.onPrimaryMuted, fontSize: 14, marginTop: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  filterBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  filterDot: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  loginPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.cream, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill },
  body: { paddingHorizontal: 16, width: '100%', maxWidth: 672, alignSelf: 'center' },
  filterLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  chips: { gap: 8, paddingRight: 16 },
  filterPanel: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginTop: 12, ...shadow },
  catTile: { width: 76, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, marginTop: 12 },
  catTileActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft, marginTop: 4 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: 14, marginTop: 16 },
});
