import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { ImagePickerField, LoginRequired } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { Button, Card, Chip, Field, Header, LocationBadge, Notice, Row, Screen, StickyFooter, Toggle } from '../components/ui';
import * as api from '../lib/api';
import { calcBreakdown } from '../lib/commission';
import { tl } from '../lib/format';
import { useStore } from '../lib/store';
import { font } from '../lib/theme';
import { CATEGORIES, type CategoryKey, type DeliveryMethod } from '../lib/types';

export default function ListingForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { db, me, mutate } = useStore();
  const { run, confirm } = useFeedback();
  const existing = id ? db.listings.find((l) => l.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [category, setCategory] = useState<CategoryKey>(existing?.category ?? 'ana-yemek');
  const [image, setImage] = useState<string | undefined>(existing?.image);
  const [prepTime, setPrepTime] = useState(existing?.prepTime ?? '');
  const [delivery, setDelivery] = useState<DeliveryMethod[]>(existing?.delivery ?? ['pickup']);
  const [active, setActive] = useState(existing ? existing.status === 'active' : true);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="İlan Ver" />
        <LoginRequired text="İlan vermek için giriş yapmalısın." />
      </View>
    );
  }

  const toggleDelivery = (m: DeliveryMethod, on: boolean) =>
    setDelivery((d) => (on ? Array.from(new Set([...d, m])) : d.filter((x) => x !== m)));

  const priceNum = Number(price.replace(',', '.'));
  const preview = Number.isFinite(priceNum) && priceNum > 0 ? calcBreakdown(priceNum, 1) : null;

  const save = () =>
    run(() => {
      const l = mutate((d) =>
        api.saveListing(
          d,
          me.id,
          { title, description, price: priceNum, category, image, prepTime, delivery, status: active ? 'active' : 'passive' },
          existing?.id,
        ),
      );
      router.replace(`/listing/${l.id}`);
    }, existing ? 'İlan güncellendi' : 'İlanın yayında! 🎉');

  const remove = async () => {
    if (!existing) return;
    const { ok } = await confirm({ title: 'İlanı sil', message: `“${existing.title}” kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true });
    if (ok) {
      const done = await run(() => mutate((d) => api.deleteListing(d, me, existing.id)), 'İlan silindi');
      if (done) router.replace('/my-listings');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen
        header={<Header title={existing ? 'İlanı Düzenle' : 'Yeni İlan'} subtitle="Ev yapımı lezzetini paylaş" />}
        footer={
          <StickyFooter>
            <Button title={existing ? 'Değişiklikleri Kaydet' : 'İlanı Yayınla'} icon="checkmark-circle-outline" onPress={save} />
          </StickyFooter>
        }
      >
        <ImagePickerField value={image} onChange={setImage} category={category} title={title} />

        <Card>
          <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="Ör. Antakya Künefesi (Tepsi)" maxLength={60} />
          <Field label="Açıklama" value={description} onChangeText={setDescription} placeholder="Malzemeler, porsiyon, lezzet notları…" multiline maxLength={500} />
          <Field
            label="Fiyat (TL)"
            icon="pricetag-outline"
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            keyboardType="decimal-pad"
            hint={preview ? `Alıcı ${tl(preview.buyerTotal)} öder · Sana ${tl(preview.sellerNet)} kalır (porsiyon başı)` : 'Porsiyon / adet başı fiyat'}
          />
          <Text style={[font.small, { fontWeight: '700', color: '#5b4636', marginBottom: 8 }]}>Kategori</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c.key} label={c.label} emoji={c.emoji} active={category === c.key} onPress={() => setCategory(c.key)} />
            ))}
          </View>
          <Field label="Müsaitlik / hazırlanma süresi" icon="time-outline" value={prepTime} onChangeText={setPrepTime} placeholder="Ör. 1 gün önceden sipariş, 2 saatte hazır" />
        </Card>

        <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Teslimat seçenekleri</Text>
        <Toggle label="Kurye" description="Alıcının adresine kuryeyle gönderim" icon="bicycle" value={delivery.includes('courier')} onChange={(v) => toggleDelivery('courier', v)} />
        <Toggle label="Elden Teslim" description="Alıcı adresinden teslim alır" icon="hand-left-outline" value={delivery.includes('pickup')} onChange={(v) => toggleDelivery('pickup', v)} />
        {delivery.length === 0 && <Notice tone="red" icon="alert-circle-outline" text="En az bir teslimat seçeneği seçmelisin." />}

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
            <LocationBadge district={me.district} neighborhood={me.neighborhood} />
          </Row>
        </Card>

        {existing && <Button title="İlanı Sil" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: 20 }} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
