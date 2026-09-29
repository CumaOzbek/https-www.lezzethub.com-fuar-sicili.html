import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUYER_FEE_RATE, SELLER_FEE_RATE, type Breakdown } from '../lib/commission';
import { DELIVERY_LABEL, appointmentText, tl } from '../lib/format';
import { ALL_DISTRICTS, ALL_TURKEY, PROVINCES, districtsOf, matchesText, suggestNeighborhoods, useNeighbourhoods } from '../lib/locations';
import type { LegalKey } from '../lib/legal';
import { useStore } from '../lib/store';
import { colors, font, radius, shadowSoft } from '../lib/theme';
import { CATEGORIES, type DeliveryMethod, type Listing, type Order, type PaymentMethod, type User } from '../lib/types';
import { Avatar, Badge, Card, EmptyState, Field, LocationBadge, Row, StatusBadge, type IconName } from './ui';

export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1]!;

const PLACEHOLDER_BG = ['#F3E6D3', '#E4EEE8', '#F6E4D8', '#E5ECEF', '#F2EAD3', '#EEE5E0'];

type ImageSource = { images?: string[]; category: Listing['category']; title: string };

/** İlanın kapak fotoğrafı; fotoğraf yoksa kategori simgeli sıcak renkli bir yer tutucu. */
export function ListingImage({ listing, height = 170, style }: { listing: ImageSource; height?: number; style?: StyleProp<ViewStyle> }) {
  const cover = listing.images?.[0];
  if (cover) {
    return <Image source={{ uri: cover }} style={[{ width: '100%', height, backgroundColor: colors.creamDeep }, style as object]} resizeMode="cover" />;
  }
  const cat = categoryOf(listing.category);
  const bg = PLACEHOLDER_BG[listing.title.length % PLACEHOLDER_BG.length];
  return (
    <View style={[{ width: '100%', height, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Text style={{ fontSize: height * 0.2, position: 'absolute', left: 18, top: 14, opacity: 0.25 }}>{cat.emoji}</Text>
      <Text style={{ fontSize: height * 0.16, position: 'absolute', right: 22, bottom: 12, opacity: 0.25 }}>{cat.emoji}</Text>
      <Text style={{ fontSize: height * 0.36 }}>{cat.emoji}</Text>
    </View>
  );
}

export function DeliveryIcons({ delivery, labels = false }: { delivery: DeliveryMethod[]; labels?: boolean }) {
  return (
    <Row gap={6}>
      {delivery.includes('cargo') && <Badge label={labels ? 'Kargo' : '📦'} tone="honey" icon={labels ? 'cube-outline' : undefined} />}
      {delivery.includes('courier') && <Badge label={labels ? 'Kurye' : '🛵'} tone="blue" icon={labels ? 'bicycle' : undefined} />}
      {delivery.includes('pickup') && <Badge label={labels ? 'Elden Teslim' : '🤝'} tone="green" icon={labels ? 'hand-left-outline' : undefined} />}
    </Row>
  );
}

export function ListingCard({ listing, seller, compact }: { listing: Listing; seller?: User; compact?: boolean }) {
  const cat = categoryOf(listing.category);
  return (
    <Card style={styles.listingCard} onPress={() => router.push(`/listing/${listing.id}`)}>
      <View>
        <ListingImage listing={listing} height={compact ? 130 : 170} />
        <View style={styles.pricePill}>
          <Text style={styles.priceText}>{tl(listing.price)}</Text>
        </View>
        <View style={styles.catPill}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>
            {cat.emoji} {cat.label}
          </Text>
        </View>
        {listing.status !== 'active' ? (
          <View style={[styles.cornerPill, { backgroundColor: colors.ink }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Pasif</Text>
          </View>
        ) : (
          listing.images.length > 1 && (
            <View style={[styles.cornerPill, styles.photoCount]}>
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>{listing.images.length}</Text>
            </View>
          )
        )}
      </View>
      <View style={{ padding: 14 }}>
        <Text style={font.h3} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={[font.small, { marginTop: 4, lineHeight: 18 }]} numberOfLines={2}>
          {listing.description}
        </Text>
        <View style={styles.cardFooter}>
          <Row gap={8} style={{ flex: 1, minWidth: 0 }}>
            {seller && <Avatar uri={seller.avatar} name={seller.name} size={26} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              {seller && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }} numberOfLines={1}>
                  {seller.name}
                </Text>
              )}
              <LocationBadge province={listing.province} district={listing.district} neighborhood={listing.neighborhood} compact />
            </View>
          </Row>
          <DeliveryIcons delivery={listing.delivery} />
        </View>
      </View>
    </Card>
  );
}

/* ------------------------------ İl / İlçe / Mahalle ------------------------------ */

/** Aranabilir seçim listesi (alttan açılan sayfa). */
function PickerSheet({
  visible,
  title,
  subtitle,
  items,
  value,
  multi,
  selected,
  onPick,
  onClose,
  searchable,
  iconFor,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: string[];
  value?: string;
  multi?: boolean;
  selected?: string[];
  onPick: (item: string) => void;
  onClose: () => void;
  searchable?: boolean;
  iconFor?: (item: string) => string;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const shown = useMemo(() => (q.trim() ? items.filter((i) => matchesText(i, q)) : items), [items, q]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHandle} />
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={font.h2}>{title}</Text>
          {multi && (
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Tamam</Text>
            </Pressable>
          )}
        </Row>
        {!!subtitle && <Text style={[font.small, { marginBottom: 10 }]}>{subtitle}</Text>}
        {searchable && <Field icon="search" value={q} onChangeText={setQ} placeholder="Ara…" autoCorrect={false} style={{ marginBottom: 8 }} />}
        <FlatList
          data={shown}
          keyExtractor={(x) => x}
          style={{ maxHeight: 420 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[font.small, { padding: 14 }]}>Sonuç bulunamadı.</Text>}
          renderItem={({ item }) => {
            const active = multi ? !!selected?.includes(item) : item === value;
            return (
              <Pressable
                onPress={() => {
                  onPick(item);
                  if (!multi) {
                    setQ('');
                    onClose();
                  }
                }}
                style={[styles.sheetItem, active && { backgroundColor: colors.creamDeep }]}
                accessibilityRole={multi ? 'checkbox' : 'button'}
                accessibilityState={multi ? { checked: active } : { selected: active }}
              >
                <Text style={{ fontSize: 16, fontWeight: active ? '800' : '500', color: active ? colors.primaryDark : colors.ink, flex: 1 }}>
                  {iconFor ? iconFor(item) + '  ' : ''}
                  {item}
                </Text>
                {active && <Ionicons name={multi ? 'checkbox' : 'checkmark-circle'} size={20} color={colors.primary} />}
                {multi && !active && <Ionicons name="square-outline" size={20} color={colors.muted} />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

function SelectBox({ label, value, placeholder, icon, error, disabled, onPress }: { label?: string; value: string; placeholder: string; icon: IconName; error?: string; disabled?: boolean; onPress: () => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <Pressable onPress={disabled ? undefined : onPress} style={[styles.select, !!error && { borderColor: colors.danger }, disabled && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={label}>
        <Ionicons name={icon} size={18} color={colors.muted} />
        <Text style={{ flex: 1, fontSize: 15, color: value ? colors.ink : colors.muted }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const PROVINCE_NAMES = PROVINCES.map((p) => p.name);

export function ProvincePicker({
  label = 'İl',
  value,
  onChange,
  includeAll,
  error,
}: {
  label?: string;
  value: string;
  onChange: (p: string) => void;
  /** Filtrelerde "Türkiye Geneli" seçeneği. */
  includeAll?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = includeAll ? [ALL_TURKEY, ...PROVINCE_NAMES] : PROVINCE_NAMES;
  return (
    <>
      <SelectBox label={label} value={value} placeholder="İl seçin" icon="business-outline" error={error} onPress={() => setOpen(true)} />
      <PickerSheet
        visible={open}
        title="İl seçin"
        subtitle="LezzetKAT Türkiye’nin 81 ilinde hizmet verir."
        items={items}
        value={value}
        searchable
        iconFor={(i) => (i === ALL_TURKEY ? '🇹🇷' : '🏙️')}
        onPick={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function DistrictPicker({
  label = 'İlçe',
  province,
  value,
  onChange,
  includeAll,
  error,
}: {
  label?: string;
  province: string;
  value: string;
  onChange: (d: string) => void;
  /** Filtrelerde "Tüm ilçeler" seçeneği. */
  includeAll?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const districts = districtsOf(province);
  const items = includeAll ? [ALL_DISTRICTS, ...districts] : districts;
  return (
    <>
      <SelectBox
        label={label}
        value={value}
        placeholder={districts.length ? 'İlçe seçin' : 'Önce il seçin'}
        icon="map-outline"
        error={error}
        disabled={!districts.length}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title={`${province} · İlçe seçin`}
        items={items}
        value={value}
        searchable={items.length > 12}
        iconFor={(i) => (i === ALL_DISTRICTS ? '🗺️' : '📍')}
        onPick={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** Birden fazla ilçe seçimi (kuryenin hizmet bölgesi). */
export function MultiDistrictPicker({
  label = 'Hizmet verdiğin ilçeler',
  province,
  value,
  onChange,
  error,
}: {
  label?: string;
  province: string;
  value: string[];
  onChange: (d: string[]) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const districts = districtsOf(province);
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <>
      <SelectBox
        label={label}
        value={value.length ? value.join(', ') : ''}
        placeholder={districts.length ? 'İlçe seçin (birden fazla)' : 'Önce il seçin'}
        icon="navigate-outline"
        error={error}
        disabled={!districts.length}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title="Hizmet ilçeleri"
        subtitle={`${province} ilinde kurye olarak hizmet vereceğin ilçeleri seç.`}
        items={districts}
        multi
        selected={value}
        searchable={districts.length > 12}
        onPick={toggle}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function NeighborhoodInput({
  province,
  district,
  value,
  onChange,
  label = 'Mahalle',
  placeholder = 'Mahalle yazın veya seçin',
  error,
  hint = 'Listede yoksa kendi mahallenizi yazabilirsiniz.',
}: {
  province?: string;
  district?: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const pool = useNeighbourhoods(province, district);
  const suggestions = useMemo(() => suggestNeighborhoods(pool, value), [pool, value]);
  return (
    <View>
      <Field
        label={label}
        icon="home-outline"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        error={error}
        hint={focused ? undefined : hint}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 180)}
        autoCorrect={false}
        style={{ marginBottom: focused && suggestions.length ? 6 : 14 }}
        right={
          value ? (
            <Pressable onPress={() => onChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : undefined
        }
      />
      {focused && suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          <Text style={[font.tiny, { marginBottom: 6 }]}>{district ? `${district} mahalleleri` : 'Öneriler'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s) => (
              <Pressable key={s} onPress={() => onChange(s)} style={styles.suggestChip}>
                <Text style={{ color: colors.primaryDark, fontWeight: '700', fontSize: 13 }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** İl + ilçe + mahalle birlikte (il değişince ilçe/mahalle sıfırlanır). */
export function LocationFields({
  value,
  onChange,
  errors = {},
}: {
  value: { province: string; district: string; neighborhood: string };
  onChange: (v: { province: string; district: string; neighborhood: string }) => void;
  errors?: { province?: string; district?: string; neighborhood?: string };
}) {
  return (
    <>
      <ProvincePicker value={value.province} onChange={(province) => onChange(province === value.province ? value : { province, district: '', neighborhood: '' })} error={errors.province} />
      <DistrictPicker
        province={value.province}
        value={value.district}
        onChange={(district) => onChange(district === value.district ? value : { ...value, district, neighborhood: '' })}
        error={errors.district}
      />
      <NeighborhoodInput province={value.province} district={value.district} value={value.neighborhood} onChange={(neighborhood) => onChange({ ...value, neighborhood })} error={errors.neighborhood} />
    </>
  );
}

/* ------------------------------ Hesap dökümü ------------------------------ */

export function PriceBreakdown({
  b,
  unitPrice,
  quantity,
  perspective,
  method = 'online',
}: {
  b: Breakdown;
  unitPrice: number;
  quantity: number;
  perspective: 'buyer' | 'seller' | 'admin';
  method?: PaymentMethod;
}) {
  const line = (label: string, value: string, opts: { strong?: boolean; muted?: boolean; color?: string } = {}) => (
    <View style={styles.bLine} key={label}>
      <Text style={[{ color: opts.muted ? colors.muted : colors.inkSoft, fontSize: 14, flexShrink: 1 }, opts.strong && { fontWeight: '800', color: colors.ink, fontSize: 16 }]}>{label}</Text>
      <Text style={[{ color: opts.color ?? colors.ink, fontSize: 14, fontWeight: '600' }, opts.strong && { fontWeight: '900', fontSize: 17, color: opts.color ?? colors.primaryDark }]}>{value}</Text>
    </View>
  );
  if (method === 'on_delivery') {
    // Pilot mod: para platformdan geçmez, hizmet bedeli yoktur.
    return (
      <View style={styles.breakdown}>
        {line(`Ürün tutarı (${quantity} × ${tl(unitPrice)})`, tl(b.subtotal))}
        {line('Hizmet bedeli', 'Pilot dönemde ücretsiz', { muted: true, color: colors.success })}
        <View style={styles.bDivider} />
        {line(perspective === 'seller' ? 'Teslimatta alacağın tutar' : 'Teslimatta satıcıya ödenecek', tl(b.buyerTotal), { strong: true })}
        <Text style={[font.tiny, { marginTop: 6, lineHeight: 16 }]}>Ödeme uygulama üzerinden alınmaz; alıcı teslimatta satıcıya nakit veya IBAN ile öder.</Text>
      </View>
    );
  }
  return (
    <View style={styles.breakdown}>
      {line(`Ürün tutarı (${quantity} × ${tl(unitPrice)})`, tl(b.subtotal))}
      {(perspective === 'buyer' || perspective === 'admin') && (
        <>
          {line(`Alıcı hizmet bedeli (%${BUYER_FEE_RATE * 100})`, '+ ' + tl(b.buyerFee), { muted: true })}
          <View style={styles.bDivider} />
          {line('Alıcının ödeyeceği toplam', tl(b.buyerTotal), { strong: true })}
        </>
      )}
      {(perspective === 'seller' || perspective === 'admin') && (
        <>
          {perspective === 'admin' && <View style={{ height: 10 }} />}
          {line(`Satıcı hizmet bedeli (%${SELLER_FEE_RATE * 100})`, '− ' + tl(b.sellerFee), { muted: true })}
          <View style={styles.bDivider} />
          {line('Satıcıya geçecek net tutar', tl(b.sellerNet), { strong: true, color: colors.success })}
        </>
      )}
      {perspective === 'admin' && (
        <>
          <View style={styles.bDivider} />
          {line('Platform geliri (komisyon)', tl(b.platformRevenue), { strong: true, color: colors.info })}
        </>
      )}
    </View>
  );
}

/* ------------------------------ Sipariş kartı ------------------------------ */

export function OrderCard({ order, perspective }: { order: Order; perspective: 'buyer' | 'seller' | 'admin' }) {
  const { db, me } = useStore();
  const other = db.users.find((u) => u.id === (perspective === 'buyer' ? order.sellerId : order.buyerId));
  const listing = db.listings.find((l) => l.id === order.listingId);
  const unread = db.messages.filter((m) => m.orderId === order.id && m.receiverId === me?.id && !m.read).length;
  return (
    <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }} onPress={() => router.push(`/order/${order.id}`)}>
      <Row gap={12} style={{ padding: 12 }}>
        <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden' }}>
          <ListingImage listing={listing ?? { category: 'diger', title: order.listingTitle }} height={64} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>
              {order.listingTitle}
            </Text>
            {unread > 0 && (
              <View style={styles.unread}>
                <Ionicons name="chatbubble" size={11} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unread}</Text>
              </View>
            )}
          </Row>
          <Text style={[font.small, { marginTop: 2 }]} numberOfLines={1}>
            {perspective === 'buyer' ? 'Satıcı' : perspective === 'seller' ? 'Alıcı' : 'Alıcı'}: {other?.name ?? 'Silinmiş kullanıcı'} · {order.quantity} adet
          </Text>
          <Text style={[font.small, { marginTop: 1 }]} numberOfLines={1}>
            🗓 {appointmentText(order.appointment)} · {DELIVERY_LABEL[order.delivery]}
          </Text>
        </View>
      </Row>
      <Row style={styles.orderFooter}>
        <StatusBadge status={order.status} method={order.paymentMethod} />
        <Text style={{ fontWeight: '900', color: colors.primaryDark, fontSize: 15 }}>
          {tl(perspective === 'seller' ? order.sellerNet : order.buyerTotal)}
        </Text>
      </Row>
    </Card>
  );
}

/* ------------------------------ Onaylar ------------------------------ */

/** Hukuki metne bağlantı (metin içinde). */
export function LegalLink({ doc, label }: { doc: LegalKey; label: string }) {
  return (
    <Text style={{ color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }} onPress={() => router.push(`/legal/${doc}`)}>
      {label}
    </Text>
  );
}

/** Zorunlu onay kutusu. Metin içinde LegalLink kullanılabilir. */
export function ConsentCheck({ checked, onChange, children, required = true }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; required?: boolean }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={[styles.consent, checked && { borderColor: colors.primaryLight, backgroundColor: colors.primarySoft }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.muted} />
      <Text style={{ flex: 1, color: colors.inkSoft, lineHeight: 20, fontSize: 14 }}>
        {children}
        {required && <Text style={{ color: colors.danger, fontWeight: '800' }}> *</Text>}
      </Text>
    </Pressable>
  );
}

/* ------------------------------ Yetki kapısı ------------------------------ */

export function LoginRequired({ text = 'Bu bölümü kullanmak için giriş yapmalısın.' }: { text?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <EmptyState emoji="🔐" title="Giriş yapman gerekiyor" text={text} action="Giriş Yap / Kayıt Ol" onAction={() => router.push('/login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  listingCard: { padding: 0, overflow: 'hidden', marginBottom: 14 },
  pricePill: { position: 'absolute', right: 10, bottom: 10, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, ...shadowSoft },
  priceText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cornerPill: { position: 'absolute', right: 10, top: 10, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  photoCount: { backgroundColor: 'rgba(30,42,41,0.7)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  catPill: { position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(255,250,245,0.95)', borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginBottom: 6, marginLeft: 2 },
  error: { color: colors.danger, fontSize: 12, marginTop: 4, marginLeft: 2 },
  select: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 12, minHeight: 50,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(43,26,16,0.4)' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingTop: 10, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.peach, alignSelf: 'center', marginBottom: 14 },
  sheetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.md },
  suggestBox: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.creamDeep },
  suggestChip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.peach },
  breakdown: { backgroundColor: colors.cream, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.creamDeep },
  bLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 10 },
  bDivider: { height: 1, backgroundColor: colors.peach, marginVertical: 6, opacity: 0.7 },
  consent: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, marginBottom: 10 },
  orderFooter: { justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.cream, borderTopWidth: 1, borderTopColor: colors.line },
  unread: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
});
