import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { ConsentCheck, LegalLink, LoginRequired } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { PhotoManager } from '../components/photos';
import { Button, Card, Chip, EmptyState, Field, Header, LocationBadge, Notice, Row, Screen, StickyFooter, Toggle } from '../components/ui';
import { calcBreakdown } from '../lib/commission';
import { VERIFICATION_LABEL, allergenShort, shippingPayerText, tl } from '../lib/format';
import { useStore } from '../lib/store';
import { colors, font } from '../lib/theme';
import { canSell } from '../lib/api';
import { ALLERGENS, CATEGORIES, PROHIBITED_FOODS, type AllergenKey, type CategoryKey, type DeliveryMethod, type ShippingPayer } from '../lib/types';

export default function ListingForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db, me, actions } = useStore();
  const { run, confirm, toast } = useFeedback();
  const existing = id ? db.listings.find((l) => l.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [category, setCategory] = useState<CategoryKey>(existing?.category ?? 'ana-yemek');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [prepTime, setPrepTime] = useState(existing?.prepTime ?? '');
  const [delivery, setDelivery] = useState<DeliveryMethod[]>(existing?.delivery ?? ['pickup']);
  const [shippingPayer, setShippingPayer] = useState<ShippingPayer>(existing?.shippingPayer ?? 'buyer');
  const [allergens, setAllergens] = useState<AllergenKey[]>(existing?.allergens ?? []);
  const [noAllergens, setNoAllergens] = useState(!!existing && existing.allergens.length === 0);
  const [shelfLife, setShelfLife] = useState(existing?.shelfLife ?? '');
  const [shelfStable, setShelfStable] = useState(existing?.shelfStable ?? false);
  // Yasaklı ürün onayı her kayıtta yeniden verilir.
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [active, setActive] = useState(existing ? existing.status === 'active' && !existing.underReview : true);
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

  const toggleDelivery = (m: DeliveryMethod, on: boolean) => {
    if (m === 'cargo' && on && !shelfStable) {
      toast('Kargo yalnızca oda sıcaklığında dayanıklı ürünlerde seçilebilir. Önce ürünün soğuk zincir gerektirmediğini işaretle.', 'error');
      return;
    }
    setDelivery((d) => (on ? Array.from(new Set([...d, m])) : d.filter((x) => x !== m)));
  };

  const toggleAllergen = (a: AllergenKey) => {
    setNoAllergens(false);
    setAllergens((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  };

  const setStable = (v: boolean) => {
    setShelfStable(v);
    if (!v) setDelivery((d) => d.filter((x) => x !== 'cargo'));
  };

  const priceNum = Number(price.replace(',', '.'));
  const pilot = db.settings.paymentMode !== 'online';
  const preview = Number.isFinite(priceNum) && priceNum > 0 ? calcBreakdown(priceNum, 1, pilot ? 'on_delivery' : 'online') : null;

  const save = async () => {
    setSaving(true);
    await run(async () => {
      const l = await actions.saveListing(
        {
          title,
          description,
          price: priceNum,
          category,
          images,
          prepTime,
          delivery,
          shippingPayer,
          allergens,
          noAllergens,
          shelfLife,
          shelfStable,
          safetyConfirmed,
          status: active ? 'active' : 'passive',
        },
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
            <Button title={existing ? 'Değişiklikleri Kaydet' : 'İlanı Yayınla'} icon="checkmark-circle-outline" onPress={save} loading={saving} disabled={!safetyConfirmed} />
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
            hint={preview ? (pilot ? `Pilot dönem: komisyon yok, tutarın tamamı (${tl(preview.sellerNet)}) sana kalır` : `Alıcı ${tl(preview.buyerTotal)} öder · Sana ${tl(preview.sellerNet)} kalır (porsiyon başı)`) : 'Porsiyon / adet başı fiyat'}
          />
          <Text style={[font.small, { fontWeight: '700', color: colors.inkSoft, marginBottom: 8 }]}>Kategori</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} label={c.label} emoji={c.emoji} active={category === c.key} onPress={() => setCategory(c.key)} />
            ))}
          </View>
          <Field label="Müsaitlik / hazırlanma süresi" icon="time-outline" value={prepTime} onChangeText={setPrepTime} placeholder="Ör. 1 gün önceden sipariş, 2 saatte hazır" maxLength={120} />
        </Card>

        <Text style={[font.h3, { marginTop: 20, marginBottom: 4 }]}>Gıda güvenliği bilgileri</Text>
        <Text style={[font.small, { marginBottom: 10 }]}>Alıcılar bu bilgileri sipariş vermeden önce görür. Yanlış beyan alıcının sağlığını tehlikeye atar ve sorumluluğu sana aittir.</Text>
        <Card>
          <Text style={[font.small, { fontWeight: '700', color: colors.inkSoft, marginBottom: 8 }]}>Alerjenler (içerdiklerini işaretle) *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALLERGENS.map((a) => (
              <Chip key={a.key} label={allergenShort(a.key)} active={allergens.includes(a.key)} onPress={() => toggleAllergen(a.key)} />
            ))}
          </View>
          <View style={{ height: 10 }} />
          <Toggle
            label="Alerjen içermez"
            description="Yukarıdaki 14 alerjen grubundan hiçbirini içermediğini beyan ediyorum."
            icon="leaf-outline"
            value={noAllergens}
            onChange={(v) => {
              setNoAllergens(v);
              if (v) setAllergens([]);
            }}
          />
          <Field
            label="Son tüketim ve saklama bilgisi *"
            icon="thermometer-outline"
            value={shelfLife}
            onChangeText={setShelfLife}
            placeholder="Ör. Buzdolabında 2 gün · Oda sıcaklığında 7 gün"
            maxLength={160}
          />
          <Toggle
            label="Oda sıcaklığında dayanıklı"
            description="Soğuk zincir gerektirmez, oda sıcaklığında en az 3 gün bozulmaz (kargo için zorunlu)."
            icon="sunny-outline"
            value={shelfStable}
            onChange={setStable}
          />
        </Card>

        <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Teslimat seçenekleri</Text>
        <Toggle label="Elden Teslim" description="Alıcı adresinden teslim alır" icon="hand-left-outline" value={delivery.includes('pickup')} onChange={(v) => toggleDelivery('pickup', v)} />
        <Toggle label="Kurye" description="Yakın mahallelere kuryeyle gönderim (Kurye Bul’dan onaylı kurye bulabilirsin)" icon="bicycle" value={delivery.includes('courier')} onChange={(v) => toggleDelivery('courier', v)} />
        <Toggle
          label="Kargo"
          description={shelfStable ? 'Türkiye’nin her yerine kargoyla gönderim' : 'Yalnızca oda sıcaklığında dayanıklı ürünlerde seçilebilir'}
          icon="cube-outline"
          value={delivery.includes('cargo')}
          onChange={(v) => toggleDelivery('cargo', v)}
        />
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

        <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Yasaklı ürün onayı</Text>
        <Card style={{ marginBottom: 10 }}>
          <Text style={[font.small, { marginBottom: 6, fontWeight: '700', color: colors.inkSoft }]}>Aşağıdaki yüksek riskli ürünlerin satışı yasaktır:</Text>
          {PROHIBITED_FOODS.map((p) => (
            <Text key={p} style={[font.small, { lineHeight: 19 }]}>
              • {p}
            </Text>
          ))}
        </Card>
        <ConsentCheck checked={safetyConfirmed} onChange={setSafetyConfirmed}>
          Bu ürün yasaklı ürünlerden değildir; <LegalLink doc="food" label="Gıda Güvenliği Kuralları" />’na uygun hazırlandı ve bilgiler doğrudur.
        </ConsentCheck>

        <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Durum</Text>
        <Toggle
          label={active ? 'Yayında' : 'Pasif'}
          description={active ? 'İlan ana sayfada görünür ve sipariş alır.' : 'İlan gizlenir, sipariş alınmaz.'}
          icon={active ? 'radio-button-on' : 'pause-circle-outline'}
          value={active}
          onChange={setActive}
        />
        {existing?.underReview && (
          <Notice tone="red" icon="alert-circle-outline" title="Hijyen incelemesi" text="Bu ilan hijyen / gıda güvenliği şikayeti nedeniyle yayından kaldırıldı. Yönetici incelemesi bitene kadar yayına alınamaz." />
        )}
        {existing?.removedByAdmin && !existing.underReview && <Notice tone="red" icon="alert-circle-outline" text="Bu ilan yönetici tarafından yayından kaldırıldı; tekrar yayına alınamaz." />}

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
