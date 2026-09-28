import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ListingImage, LoginRequired, PriceBreakdown } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Button, Card, EmptyState, Field, Header, LocationBadge, Notice, Row, Screen, StickyFooter, Toggle } from '../../components/ui';
import * as api from '../../lib/api';
import { calcBreakdown } from '../../lib/commission';
import { dateShort, dayLabel, hhmm, tl } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font, radius } from '../../lib/theme';
import type { DeliveryMethod } from '../../lib/types';

const SLOT_START = 9;
const SLOT_END = 22;

function buildDays(n = 14) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
}

function buildSlots(day: Date) {
  const slots: Date[] = [];
  const minTime = Date.now() + 60 * 60 * 1000; // en erken 1 saat sonrası
  for (let h = SLOT_START; h < SLOT_END; h++) {
    for (const m of [0, 30]) {
      const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      if (d.getTime() >= minTime) slots.push(d);
    }
  }
  return slots;
}

export default function NewOrder() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { db, me, actions } = useStore();
  const { run } = useFeedback();
  const listing = db.listings.find((l) => l.id === listingId);
  const seller = listing && db.users.find((u) => u.id === listing.ownerId);

  const days = useMemo(() => buildDays(), []);
  const [quantity, setQuantity] = useState(1);
  const [dayIdx, setDayIdx] = useState(() => (buildSlots(days[0]!).length ? 0 : 1));
  const slots = useMemo(() => buildSlots(days[dayIdx]!), [days, dayIdx]);
  const [slot, setSlot] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryMethod>(listing?.delivery.includes('pickup') ? 'pickup' : 'courier');
  const [address, setAddress] = useState(me?.address ?? '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Sipariş" />
        <LoginRequired text="Sipariş vermek için giriş yapmalısın." />
      </View>
    );
  }
  if (!listing || !seller) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Sipariş" />
        <EmptyState title="İlan bulunamadı" />
      </View>
    );
  }

  const b = calcBreakdown(listing.price, quantity);
  const otherDistrict = me.district !== listing.district;

  const submit = async () => {
    setLoading(true);
    await run(async () => {
      if (!slot) throw new api.ApiError('Lütfen randevu saati seçin.');
      const order = await actions.createOrder({ listingId: listing.id, quantity, appointment: slot, delivery, address, note });
      router.replace(`/order/${order.id}`);
    }, 'Siparişin satıcıya iletildi! 🛎');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen
        header={<Header title="Randevulu Sipariş" subtitle={seller.name} />}
        footer={
          <StickyFooter>
            <Row gap={12}>
              <View>
                <Text style={font.tiny}>Toplam</Text>
                <Text style={{ fontWeight: '900', fontSize: 19, color: colors.ink }}>{tl(b.buyerTotal)}</Text>
              </View>
              <Button title="Siparişi Gönder" icon="send" onPress={submit} loading={loading} style={{ flex: 1 }} disabled={!slot} />
            </Row>
          </StickyFooter>
        }
      >
        <Card style={{ padding: 12 }}>
          <Row gap={12}>
            <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden' }}>
              <ListingImage listing={listing} height={64} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={font.h3} numberOfLines={1}>
                {listing.title}
              </Text>
              <Text style={{ color: colors.accentDark, fontWeight: '900', marginTop: 2 }}>{tl(listing.price)} / adet</Text>
              <LocationBadge district={listing.district} neighborhood={listing.neighborhood} compact />
            </View>
          </Row>
        </Card>

        {otherDistrict && (
          <View style={{ marginTop: 12 }}>
            <Notice
              title="Dikkat: farklı ilçe"
              text={`Satıcı ${listing.district} ilçesinde, sen ${me.district} ilçesindesin. Teslimat süresi uzayabilir; ${delivery === 'courier' ? 'kurye ücreti için' : 'teslim noktası için'} satıcıyla mesajlaşmanı öneririz.`}
              icon="warning-outline"
            />
          </View>
        )}

        <Text style={styles.section}>Adet</Text>
        <Card style={{ padding: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.stepBtn} accessibilityLabel="Azalt">
              <Ionicons name="remove" size={22} color={colors.primaryDark} />
            </Pressable>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink }}>{quantity}</Text>
            <Pressable onPress={() => setQuantity((q) => Math.min(50, q + 1))} style={styles.stepBtn} accessibilityLabel="Arttır">
              <Ionicons name="add" size={22} color={colors.primaryDark} />
            </Pressable>
          </Row>
        </Card>

        <Text style={styles.section}>Randevu günü</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d, i) => {
            const active = i === dayIdx;
            const disabled = buildSlots(d).length === 0;
            return (
              <Pressable
                key={d.toISOString()}
                disabled={disabled}
                onPress={() => {
                  setDayIdx(i);
                  setSlot(null);
                }}
                style={[styles.day, active && styles.dayActive, disabled && { opacity: 0.4 }]}
              >
                <Text style={[styles.dayTop, active && { color: colors.onPrimaryMuted }]}>{dayLabel(d, true)}</Text>
                <Text style={[styles.dayNum, active && { color: '#fff' }]}>{d.getDate()}</Text>
                <Text style={[styles.dayTop, active && { color: colors.onPrimaryMuted }]}>{dateShort(d).split(' ')[1]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.section}>Randevu saati</Text>
        {!!seller.availability && <Text style={[font.small, { marginBottom: 8 }]}>🕒 Satıcının müsaitliği: {seller.availability}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {slots.map((s) => {
            const iso = s.toISOString();
            const active = slot === iso;
            return (
              <Pressable key={iso} onPress={() => setSlot(iso)} style={[styles.slot, active && styles.slotActive]}>
                <Text style={[styles.slotText, active && { color: '#fff' }]}>{hhmm(s)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Teslimat yöntemi</Text>
        {listing.delivery.includes('pickup') && (
          <Toggle label="Elden Teslim" description={`${listing.neighborhood}, ${listing.district} — adres sipariş onayından sonra paylaşılır`} icon="hand-left-outline" value={delivery === 'pickup'} onChange={() => setDelivery('pickup')} />
        )}
        {listing.delivery.includes('courier') && (
          <Toggle label="Kurye" description="Adresine kuryeyle gönderilir" icon="bicycle" value={delivery === 'courier'} onChange={() => setDelivery('courier')} />
        )}
        {delivery === 'courier' && (
          <Field
            label="Teslimat adresi"
            icon="location-outline"
            value={address}
            onChangeText={setAddress}
            placeholder="Mahalle, sokak, bina, daire"
            multiline
            hint={me.address ? 'Profilindeki adresten otomatik dolduruldu.' : 'Profiline adres eklersen bir dahaki sefere otomatik dolar.'}
          />
        )}

        <Field label="Satıcıya not (isteğe bağlı)" icon="chatbubble-ellipses-outline" value={note} onChangeText={setNote} placeholder="Ör. Fıstıklı olsun, zili çalmayın…" multiline maxLength={300} style={{ marginTop: 6 }} />

        <Text style={styles.section}>Hesap dökümü</Text>
        <PriceBreakdown b={b} unitPrice={listing.price} quantity={quantity} perspective="buyer" />
        <Text style={[font.tiny, { marginTop: 8, lineHeight: 16 }]}>
          Uygulama içinde doğrudan ödeme alınmaz. Satıcı onayından sonra “Ödeme Yap” ile ödemeyi başlatırsın; ödeme yönetici onayıyla kesinleşir.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  stepBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  day: { width: 62, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1.5, borderColor: colors.line },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTop: { fontSize: 11, fontWeight: '700', color: colors.muted },
  dayNum: { fontSize: 20, fontWeight: '900', color: colors.ink, marginVertical: 2 },
  slot: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontWeight: '800', color: colors.inkSoft },
});
