import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AvatarPicker, DistrictPicker, ListingCard, LoginRequired, NeighborhoodInput } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Avatar, Button, Card, EmptyState, Field, Header, InfoRow, LocationBadge, Row, Screen, SectionTitle } from '../../components/ui';
import * as api from '../../lib/api';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

export default function Profile() {
  const { db, me, mutate, logout, changePassword, resetDemo } = useStore();
  const { run, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<api.ProfileInput | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Profil" back={false} />
        <LoginRequired text="Profil oluşturmak için giriş yap ya da ücretsiz kayıt ol." />
      </View>
    );
  }

  const myListings = db.listings.filter((l) => l.ownerId === me.id && l.status === 'active');
  const startEdit = () => {
    setForm({ name: me.name, bio: me.bio, district: me.district, neighborhood: me.neighborhood, address: me.address, availability: me.availability, avatar: me.avatar });
    setEditing(true);
  };
  const set = <K extends keyof api.ProfileInput>(k: K, v: api.ProfileInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const ok = await run(() => mutate((d) => api.updateProfile(d, me.id, form)), 'Profil güncellendi');
    if (ok) setEditing(false);
  };

  const savePassword = async () => {
    const ok = await run(() => changePassword(pw.current, pw.next), 'Şifren değiştirildi');
    if (ok) setPw({ current: '', next: '' });
  };

  const doLogout = async () => {
    const { ok } = await confirm({ title: 'Çıkış yap', message: 'Hesabından çıkış yapılacak.', confirmText: 'Çıkış Yap' });
    if (ok) {
      logout();
      router.replace('/');
    }
  };

  const doReset = async () => {
    const { ok } = await confirm({ title: 'Demo verilerini sıfırla', message: 'Tüm kullanıcılar, ilanlar, siparişler ve mesajlar başlangıç haline döner.', confirmText: 'Sıfırla', destructive: true });
    if (ok) {
      await resetDemo();
      router.replace('/login');
    }
  };

  if (editing && form) {
    return (
      <Screen
        header={
          <Header
            title="Profili Düzenle"
            back={false}
            right={<Button title="Vazgeç" variant="ghost" small onPress={() => setEditing(false)} />}
          />
        }
      >
        <AvatarPicker user={me} value={form.avatar} onChange={(uri) => set('avatar', uri)} />
        <Card>
          <Field label="Ad Soyad" icon="person-outline" value={form.name} onChangeText={(v) => set('name', v)} />
          <Field label="Kısa tanıtım (bio)" value={form.bio} onChangeText={(v) => set('bio', v)} multiline maxLength={240} placeholder="Mutfağını ve lezzetlerini kısaca anlat…" hint={`${form.bio.length}/240`} />
          <DistrictPicker value={form.district} onChange={(d) => setForm((f) => (f ? { ...f, district: d, neighborhood: '' } : f))} />
          <NeighborhoodInput district={form.district} value={form.neighborhood} onChange={(v) => set('neighborhood', v)} />
          <Field label="Açık adres" icon="location-outline" value={form.address} onChangeText={(v) => set('address', v)} multiline placeholder="Sokak, bina no, daire" hint="Kurye siparişlerinde otomatik doldurulur. Sadece sipariş taraflarına gösterilir." />
          <Field label="Genel müsaitlik saatleri" icon="time-outline" value={form.availability} onChangeText={(v) => set('availability', v)} placeholder="Ör. Hafta içi 10:00–20:00" />
          <Button title="Kaydet" icon="checkmark-circle-outline" onPress={save} />
        </Card>
        <Text style={[font.small, { marginTop: 10, textAlign: 'center' }]}>Konumunu değiştirirsen ilanlarının konumu da güncellenir.</Text>
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="Profilim" back={false} right={<Button title="Düzenle" icon="create-outline" variant="secondary" small onPress={startEdit} />} />}>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Avatar uri={me.avatar} name={me.name} size={92} />
        <Text style={[font.h2, { marginTop: 12 }]}>{me.name}</Text>
        <Text style={font.small}>{me.email}</Text>
        <View style={{ marginTop: 10 }}>
          <LocationBadge district={me.district} neighborhood={me.neighborhood} />
        </View>
        <Text style={[font.body, { textAlign: 'center', marginTop: 12 }]}>{me.bio || 'Henüz bir tanıtım yazmadın. Profilini düzenleyerek komşularına kendini tanıt.'}</Text>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <InfoRow icon="location-outline" label="Açık adres (yalnızca sipariş taraflarına görünür)" value={me.address} />
        <InfoRow icon="time-outline" label="Genel müsaitlik" value={me.availability} />
      </Card>

      <SectionTitle title={`Yayındaki ilanlarım (${myListings.length})`} action="Tümünü yönet" onAction={() => router.push('/my-listings')} />
      {myListings.length === 0 ? (
        <Card>
          <EmptyState emoji="🍳" title="Yayında ilanın yok" action="İlan Ver" onAction={() => router.push('/listing-form')} />
        </Card>
      ) : (
        myListings.slice(0, 3).map((l) => <ListingCard key={l.id} listing={l} compact />)
      )}

      <SectionTitle title="Şifre değiştir" />
      <Card>
        <Field label="Mevcut şifre" icon="lock-closed-outline" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secureTextEntry />
        <Field label="Yeni şifre" icon="key-outline" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secureTextEntry hint="En az 6 karakter" />
        <Button title="Şifreyi Güncelle" variant="secondary" onPress={savePassword} disabled={!pw.current || !pw.next} />
      </Card>

      <Row gap={10} style={{ marginTop: 20 }}>
        <Button title="Çıkış Yap" icon="log-out-outline" variant="outline" onPress={doLogout} style={{ flex: 1 }} />
      </Row>
      <Button title="Demo verilerini sıfırla" variant="ghost" small onPress={doReset} style={{ marginTop: 8, alignSelf: 'center' }} />
      <Text style={[font.tiny, { textAlign: 'center', color: colors.muted }]}>LezzetHub · Hatay · v1.0</Text>
    </Screen>
  );
}
