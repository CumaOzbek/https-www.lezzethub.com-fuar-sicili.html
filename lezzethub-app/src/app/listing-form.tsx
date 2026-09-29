import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { LoginRequired } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { PhotoManager } from '../components/photos';
import { Button, Card, Chip, EmptyState, Field, Header, LocationBadge, Notice, Row, Screen, StickyFooter, Toggle } from '../components/ui';
import { calcBreakdown } from '../lib/commission';
import { VERIFICATION_LABEL, shippingPayerText, tl } from '../lib/format';
import { useStore } from '../lib/store';
import { colors, font } from '../lib/theme';
import { canSell } from '../lib/api';
import { CATEGORIES, type CategoryKey, type DeliveryMethod, type ShippingPayer } from '../lib/types';

export default function ListingForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db, me, actions } = useStore();
  const { run, confirm } = useFeedback();
  const existing = id ? db.listings.find((l) => l.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [category, setCategory] = useState<CategoryKey>(existing?.category ?? 'ana-yemek');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [prepTime, setPrepTime] = useState(existing?.prepTime ?? '');
  const [delivery, setDelivery] = useState<DeliveryMethod[]>(existing?.delivery ?? ['pickup']);
  const [shippingPayer, setShippingPayer] = useState<ShippingPayer>(existing?.shippingPayer ?? 'buyer');
  const [active, setActive] = useState(existing ? existing.status === 'active' : true);
  const [saving, setSaving] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="İlan Ver" />
        <LoginRequired text="İlan vermek için giriş yapmalısın." />
      </View>
    );
  }

  // Hijyen belgesi onaylanmadan ilan verilemez.
  if (!canSell(me)) {
    const pending = me.sellerStatus === 'pending';
    return (
      <View style={{ flex: 1 }}>
        <Header title="İlan Ver" />
        <Screen>
          <EmptyState
            emoji={pending ? '⏳' : '📄'}
            title={pending ? 'Satıcı başvurun inceleniyor' : 'Önce satıcı başvurusu gerekiyor'}
            text={
              pending
                ? 'Hijyen belgen onaylandığında ilan verebileceksin. Sonucu bildirim olarak göndereceğiz.'
                : `Satış yapabilmek için e-Devlet onaylı hijyen belgeni yüklemeli ve mevzuat beyanını onaylamalısın. Durum: ${VERIFICATION_LABEL[me.sellerStatus]}.`
            }
            action={pending ? 'Başvuruyu görüntüle' : 'Satıcı başvurusu yap'}
            onAction={() => router.push('/apply/seller')}
          />
        </Screen>
      </View>
    );
  }

  const shipping = delivery.includes('courier') || delivery.includes('cargo');

  const toggleDelivery = (m: DeliveryMethod, on: boolean) =>
    setDelivery((d) => (on ? Array.from(new Set([...d, m])) : d.filter((x) => x !== m)));

  const priceNum = Number(price.replace(',', '.'));
  const preview = Number.isFinite(priceNum) && priceNum > 0 ? calcBreakdown(priceNum, 1) : null;

  const save = async () => {
    setSaving(true);
    await run(async () => {
      const l = await actions.saveListing(
        { title, description, price: priceNum, category, images, prepTime, delivery, shippingPayer, status: active ? 'active' : 'passive' },
        existing?.id,
      );
      router.replace(`/listing/${l.id}`);
    }, existing ? 'İlan güncellendi' : 'İlanın yayında! 🎉');
    setSaving(false);
  };

  const remove = async () => {
    if (!existing) return;
    const { ok } = await confirm({ title: 'İlanı sil', message: `“${existing.title}” kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true });
    if (ok) {
      const done = await run(() => actions.deleteListing(existing.id), 'İlan silindi');
      if (done) router.replace('/my-listings');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen
        header={<Header title={existing ? 'İlanı Düzenle' : 'Yeni İlan'} subtitle="Ev yapımı lezzetini tanıt" />}
        footer={
          <StickyFooter>
            <Button title={existing ? 'Değişiklikleri Kaydet' : 'İlanı Yayınla'} icon="checkmark-circle-outline" onPress={save} loading={saving} />
          </StickyFooter>
        }
      >
        <PhotoManager value={images} onChange={setImages} category={category} title={title} />

        <Card>
          <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="Ör. Antakya Künefesi (Tepsi)" maxLength={60} />
          <Field
            label="Açıklama"
            value={description}
            onChangeText={setDescription}
            placeholder="Malzemeler, porsiyon, alerjenler, lezzet notları…"
            multiline
            maxLength={500}
            hint={`${description.length}/500 · Alerjenleri (fındık, süt, gluten vb.) belirtmeyi unutma.`}
          />
          <Field
            label="Fiyat (TL)"
            icon="pricetag-outline"
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            keyboardType="decimal-pad"
            hint={preview ? `Alıcı ${tl(preview.buyerTotal)} öder · Sana ${tl(preview.sellerNet)} kalır (porsiyon başı)` : 'Porsiyon / adet başı fiyat'}
          />
          <Text style={[font.small, { fontWeight: '700', color: colors.inkSoft, marginBottom: 8 }]}>Kategori</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} label={c.label} emoji={c.emoji} active={category === c.key} onPress={() => setCategory(c.key)} />
            ))}
          </View>
          <Field label="Müsaitlik / hazırlanma süresi" icon="time-outline" value={prepTime} onChangeText={setPrepTime} placeholder="Ör. 1 gün önceden sipariş, 2 saatte hazır" maxLength={120} />
        </Card>

        <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Teslimat seçenekleri</Text>
        <Toggle label="Elden Teslim" description="Alıcı adresinden teslim alır" icon="hand-left-outline" value={delivery.includes('pickup')} onChange={(v) => toggleDelivery('pickup', v)} />
        <Toggle label="Kurye" description="Yakın mahallelere kuryeyle gönderim (Kurye Bul’dan onaylı kurye bulabilirsin)" icon="bicycle" value={delivery.includes('courier')} onChange={(v) => toggleDelivery('courier', v)} />
        <Toggle label="Kargo" description="Türkiye’nin her yerine kargoyla gönderim (bozulmayan ürünler için)" icon="cube-outline" value={delivery.includes('cargo')} onChange={(v) => toggleDelivery('cargo', v)} />
        {delivery.length === 0 && <Notice tone="red" icon="alert-circle-outline" text="En az bir teslimat seçeneği seçmelisin." />}
        {shipping && (
          <Card style={{ marginTop: 4 }}>
            <Text style={[font.h3, { marginBottom: 4 }]}>Kurye / kargo ücreti kime ait?</Text>
            <Text style={[font.small, { marginBottom: 10 }]}>Gönderim ücretini ve organizasyonunu kimin üstleneceğini seç. Alıcı bunu sipariş vermeden önce görür.</Text>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Chip label="Alıcı öder" icon="person-outline" active={shippingPayer === 'buyer'} onPress={() => setShippingPayer('buyer')} />
              <Chip label="Satıcı öder (ücretsiz gönderim)" icon="gift-outline" active={shippingPayer === 'seller'} onPress={() => setShippingPayer('seller')} />
            </Row>
            <Text style={[font.small, { marginTop: 10 }]}>{shippingPayerText(delivery.includes('cargo') ? 'cargo' : 'courier', shippingPayer)}</Text>
            {delivery.includes('cargo') && (
              <Text style={[font.small, { marginTop: 6, color: colors.warning }]}>Kargoda soğuk zincir gerektiren ve çabuk bozulan yemekleri göndermeyin; sağlam ve kapalı ambalaj kullanın.</Text>
            )}
          </Card>
        )}

        <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Durum</Text>
        <Toggle
          label={active ? 'Yayında' : 'Pasif'}
          description={active ? 'İlan ana sayfada görünür ve sipariş alır.' : 'İlan gizlenir, sipariş alınmaz.'}
          icon={active ? 'radio-button-on' : 'pause-circle-outline'}
          value={active}
          onChange={setActive}
        />
        {existing?.removedByAdmin && <Notice tone="red" icon="alert-circle-outline" text="Bu ilan yönetici tarafından yayından kaldırıldı; tekrar yayına alınamaz." />}

        <Card style={{ marginTop: 10, padding: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={font.small}>İlan konumu (profilinden otomatik)</Text>
            <LocationBadge province={me.province} district={me.district} neighborhood={me.neighborhood} />
          </Row>
        </Card>

        {existing && <Button title="İlanı Sil" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: 20 }} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
