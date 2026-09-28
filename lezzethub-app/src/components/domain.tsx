import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUYER_FEE_RATE, SELLER_FEE_RATE, type Breakdown } from '../lib/commission';
import { DELIVERY_LABEL, appointmentText, tl } from '../lib/format';
import { ALL_HATAY, DISTRICTS, suggestNeighborhoods } from '../lib/hatay';
import { useStore } from '../lib/store';
import { colors, font, radius, shadowSoft } from '../lib/theme';
import { CATEGORIES, type DeliveryMethod, type Listing, type Order, type User } from '../lib/types';
import { useFeedback } from './feedback';
import { Avatar, Badge, Button, Card, EmptyState, Field, LocationBadge, Row, StatusBadge } from './ui';

export const categoryOf = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1]!;

const PLACEHOLDER_BG = ['#fed7aa', '#fde68a', '#fecaca', '#fbcfe8', '#bbf7d0', '#fdba74'];

export function ListingImage({ listing, height = 170, style }: { listing: Pick<Listing, 'image' | 'category' | 'title'>; height?: number; style?: StyleProp<ViewStyle> }) {
  if (listing.image) {
    return <Image source={{ uri: listing.image }} style={[{ width: '100%', height, backgroundColor: colors.creamDeep }, style as object]} resizeMode="cover" />;
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
        {listing.status !== 'active' && (
          <View style={[styles.catPill, { left: undefined, right: 10, backgroundColor: colors.ink }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Pasif</Text>
          </View>
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
              <LocationBadge district={listing.district} neighborhood={listing.neighborhood} compact />
            </View>
          </Row>
          <DeliveryIcons delivery={listing.delivery} />
        </View>
      </View>
    </Card>
  );
}

/* ------------------------------ İlçe / Mahalle ------------------------------ */

export function DistrictPicker({
  label = 'İlçe',
  value,
  onChange,
  includeAll,
  error,
}: {
  label?: string;
  value: string;
  onChange: (d: string) => void;
  includeAll?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const items = includeAll ? [ALL_HATAY, ...DISTRICTS] : [...DISTRICTS];
  return (
    <View style={{ marginBottom: 14 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <Pressable onPress={() => setOpen(true)} style={[styles.select, !!error && { borderColor: colors.danger }]} accessibilityRole="button">
        <Ionicons name="map-outline" size={18} color={colors.muted} />
        <Text style={{ flex: 1, fontSize: 15, color: value ? colors.ink : colors.muted }}>{value || 'İlçe seçin'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[font.h2, { marginBottom: 4 }]}>Hatay · İlçe seçin</Text>
          <Text style={[font.small, { marginBottom: 12 }]}>LezzetHub yalnızca Hatay ilinde hizmet verir.</Text>
          <FlatList
            data={items}
            keyExtractor={(x) => x}
            style={{ maxHeight: 440 }}
            renderItem={({ item }) => {
              const active = item === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={[styles.sheetItem, active && { backgroundColor: colors.creamDeep }]}
                >
                  <Text style={{ fontSize: 16, fontWeight: active ? '800' : '500', color: active ? colors.primaryDark : colors.ink }}>
                    {item === ALL_HATAY ? '🗺️  ' : '📍  '}
                    {item}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

export function NeighborhoodInput({
  district,
  value,
  onChange,
  label = 'Mahalle',
  placeholder = 'Mahalle yazın veya seçin',
  error,
  hint = 'Listede yoksa kendi mahallenizi yazabilirsiniz.',
}: {
  district?: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => suggestNeighborhoods(district, value), [district, value]);
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
          <Text style={[font.tiny, { marginBottom: 6 }]}>{district && district !== ALL_HATAY ? `${district} mahalleleri` : 'Öneriler'}</Text>
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

/* ------------------------------ Hesap dökümü ------------------------------ */

export function PriceBreakdown({ b, unitPrice, quantity, perspective }: { b: Breakdown; unitPrice: number; quantity: number; perspective: 'buyer' | 'seller' | 'admin' }) {
  const line = (label: string, value: string, opts: { strong?: boolean; muted?: boolean; color?: string } = {}) => (
    <View style={styles.bLine} key={label}>
      <Text style={[{ color: opts.muted ? colors.muted : colors.inkSoft, fontSize: 14 }, opts.strong && { fontWeight: '800', color: colors.ink, fontSize: 16 }]}>{label}</Text>
      <Text style={[{ color: opts.color ?? colors.ink, fontSize: 14, fontWeight: '600' }, opts.strong && { fontWeight: '900', fontSize: 17, color: opts.color ?? colors.primaryDark }]}>{value}</Text>
    </View>
  );
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

/* ------------------------------ Görsel seçimi ------------------------------ */

/** Web'de tarayıcı depolaması ~5 MB ile sınırlı olduğundan tek görsel ~1 MB'ı geçmemeli. */
const MAX_WEB_IMAGE_CHARS = 1_400_000;
class ImageTooLargeError extends Error {}

async function pick(from: 'camera' | 'library', aspect: [number, number]): Promise<string | undefined> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.6, base64: Platform.OS === 'web' };
  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return undefined;
    const r = await ImagePicker.launchCameraAsync(opts);
    return r.canceled ? undefined : r.assets[0]?.uri;
  }
  const r = await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled) return undefined;
  const a = r.assets[0];
  if (!a) return undefined;
  // Web'de blob: adresleri kalıcı değildir; base64 veri adresi saklanır.
  if (Platform.OS === 'web' && a.base64) {
    if (a.base64.length > MAX_WEB_IMAGE_CHARS) throw new ImageTooLargeError();
    return `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`;
  }
  return a.uri;
}

export function ImagePickerField({ value, onChange, category, title }: { value?: string; onChange: (uri?: string) => void; category: string; title: string }) {
  const { toast } = useFeedback();
  const choose = async (from: 'camera' | 'library') => {
    try {
      const uri = await pick(from, [4, 3]);
      if (uri) onChange(uri);
      else if (from === 'camera') toast('Kamera izni verilmedi veya çekim iptal edildi.', 'info');
    } catch (e) {
      toast(e instanceof ImageTooLargeError ? 'Görsel çok büyük. Lütfen daha küçük bir fotoğraf seçin.' : 'Görsel seçilemedi.', 'error');
    }
  };
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>Görsel</Text>
      <View style={styles.imageBox}>
        <ListingImage listing={{ image: value, category: category as Listing['category'], title: title || 'x' }} height={180} />
        {value && (
          <Pressable onPress={() => onChange(undefined)} style={styles.removeImg} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Button title="Galeriden Seç" icon="images-outline" variant="secondary" small onPress={() => choose('library')} style={{ flex: 1 }} />
        {Platform.OS !== 'web' && <Button title="Fotoğraf Çek" icon="camera-outline" variant="secondary" small onPress={() => choose('camera')} style={{ flex: 1 }} />}
      </Row>
    </View>
  );
}

export function AvatarPicker({ user, value, onChange }: { user: User; value?: string; onChange: (uri?: string) => void }) {
  const { toast } = useFeedback();
  const choose = async () => {
    try {
      const uri = await pick('library', [1, 1]);
      if (uri) onChange(uri);
    } catch (e) {
      toast(e instanceof ImageTooLargeError ? 'Görsel çok büyük. Lütfen daha küçük bir fotoğraf seçin.' : 'Görsel seçilemedi.', 'error');
    }
  };
  return (
    <Pressable onPress={choose} style={{ alignSelf: 'center', marginBottom: 18 }} accessibilityLabel="Profil fotoğrafını değiştir">
      <Avatar uri={value} name={user.name} size={96} />
      <View style={styles.avatarEdit}>
        <Ionicons name="camera" size={16} color="#fff" />
      </View>
    </Pressable>
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
        <StatusBadge status={order.status} />
        <Text style={{ fontWeight: '900', color: colors.primaryDark, fontSize: 15 }}>
          {tl(perspective === 'seller' ? order.sellerNet : order.buyerTotal)}
        </Text>
      </Row>
    </Card>
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
  pricePill: { position: 'absolute', right: 10, bottom: 10, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, ...shadowSoft },
  priceText: { color: '#fff', fontWeight: '900', fontSize: 15 },
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
  suggestBox: { backgroundColor: '#fff7ed', borderRadius: radius.md, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.creamDeep },
  suggestChip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.peach },
  breakdown: { backgroundColor: '#fff7ed', borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.creamDeep },
  bLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 10 },
  bDivider: { height: 1, backgroundColor: colors.peach, marginVertical: 6, opacity: 0.7 },
  imageBox: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  removeImg: { position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(0,0,0,0.55)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarEdit: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.cream },
  orderFooter: { justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fffbf7', borderTopWidth: 1, borderTopColor: colors.line },
  unread: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
});
