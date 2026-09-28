import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DistrictPicker, ListingCard, LoginRequired, NeighborhoodInput } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { AvatarPicker } from '../../components/photos';
import { Avatar, Button, Card, EmptyState, Field, Header, InfoRow, LocationBadge, Row, Screen, SectionTitle, type IconName } from '../../components/ui';
import type * as api from '../../lib/api';
import { SUPPORT_EMAIL } from '../../lib/config';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

function LinkRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
      <Text style={{ flex: 1, fontSize: 15, color: danger ? colors.danger : colors.ink, fontWeight: '600' }}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

export default function Profile() {
  const { db, me, actions, mode } = useStore();
  const { run, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<api.ProfileInput | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [saving, setSaving] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Profil" back={false} />
        <LoginRequired text="Profil oluşturmak için giriş yap ya da ücretsiz kayıt ol." />
      </View>
    );
  }

  const myListings = db.listings.filter((l) => l.ownerId === me.id && l.status === 'active');
  const blockedUsers = db.blocks.filter((b) => b.blockerId === me.id).map((b) => db.users.find((u) => u.id === b.blockedId) ?? { id: b.blockedId, name: 'Kullanıcı', avatar: undefined });
  const set = <K extends keyof api.ProfileInput>(k: K, v: api.ProfileInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const startEdit = () => {
    setForm({ name: me.name, bio: me.bio, district: me.district, neighborhood: me.neighborhood, address: me.address, availability: me.availability, avatar: me.avatar });
    setEditing(true);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const ok = await run(() => actions.updateProfile(form), 'Profil güncellendi');
    setSaving(false);
    if (ok) setEditing(false);
  };

  const savePassword = async () => {
    const ok = await run(() => actions.changePassword(pw.current, pw.next), 'Şifren değiştirildi');
    if (ok) setPw({ current: '', next: '' });
  };

  const doLogout = async () => {
    const { ok } = await confirm({ title: 'Çıkış yap', message: 'Hesabından çıkış yapılacak.', confirmText: 'Çıkış Yap' });
    if (ok && (await run(() => actions.logout()))) router.replace('/');
  };

  const doDelete = async () => {
    const first = await confirm({
      title: 'Hesabını sil',
      message: 'Profilin, ilanların ve bildirimlerin kalıcı olarak silinir. Bu işlem geri alınamaz. Devam etmek istiyor musun?',
      confirmText: 'Devam',
      destructive: true,
    });
    if (!first.ok) return;
    const second = await confirm({
      title: 'Emin misin?',
      message: 'Onaylamak için aşağıya SİL yaz.',
      confirmText: 'Hesabımı Sil',
      destructive: true,
      inputPlaceholder: 'SİL',
    });
    if (!second.ok) return;
    if (second.note.toLocaleUpperCase('tr-TR') !== 'SİL') {
      await confirm({ title: 'Hesap silinmedi', message: 'Onay metni eşleşmedi. Hesabını silmek için SİL yazmalısın.', confirmText: 'Tamam' });
      return;
    }
    const ok = await run(() => actions.deleteAccount(), 'Hesabın silindi. Tekrar görüşmek üzere!');
    if (ok) router.replace('/');
  };

  const doReset = async () => {
    const { ok } = await confirm({ title: 'Demo verilerini sıfırla', message: 'Tüm kullanıcılar, ilanlar, siparişler ve mesajlar başlangıç haline döner.', confirmText: 'Sıfırla', destructive: true });
    if (ok && actions.resetDemo) {
      await actions.resetDemo();
      router.replace('/login');
    }
  };

  if (editing && form) {
    return (
      <Screen header={<Header title="Profili Düzenle" back={false} right={<Button title="Vazgeç" variant="ghost" small onPress={() => setEditing(false)} />} />}>
        <AvatarPicker user={me} value={form.avatar} onChange={(uri) => set('avatar', uri)} />
        <Card>
          <Field label="Ad Soyad" icon="person-outline" value={form.name} onChangeText={(v) => set('name', v)} />
          <Field label="Kısa tanıtım (bio)" value={form.bio} onChangeText={(v) => set('bio', v)} multiline maxLength={240} placeholder="Mutfağını ve lezzetlerini kısaca anlat…" hint={`${form.bio.length}/240`} />
          <DistrictPicker value={form.district} onChange={(d) => setForm((f) => (f ? { ...f, district: d, neighborhood: '' } : f))} />
          <NeighborhoodInput district={form.district} value={form.neighborhood} onChange={(v) => set('neighborhood', v)} />
          <Field label="Açık adres" icon="location-outline" value={form.address} onChangeText={(v) => set('address', v)} multiline placeholder="Sokak, bina no, daire" hint="Kurye siparişlerinde otomatik doldurulur. Yalnızca siparişin karşı tarafına gösterilir." />
          <Field label="Genel müsaitlik saatleri" icon="time-outline" value={form.availability} onChangeText={(v) => set('availability', v)} placeholder="Ör. Hafta içi 10:00–20:00" maxLength={120} />
          <Button title="Kaydet" icon="checkmark-circle-outline" onPress={save} loading={saving} />
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
        <Field label="Mevcut şifre" icon="lock-closed-outline" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secureTextEntry autoComplete="password" />
        <Field label="Yeni şifre" icon="key-outline" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secureTextEntry hint="En az 6 karakter" autoComplete="new-password" />
        <Button title="Şifreyi Güncelle" variant="secondary" onPress={savePassword} disabled={!pw.current || !pw.next} />
      </Card>

      {blockedUsers.length > 0 && (
        <>
          <SectionTitle title={`Engellenen kullanıcılar (${blockedUsers.length})`} />
          <Card style={{ paddingVertical: 6 }}>
            {blockedUsers.map((u) => (
              <Row key={u.id} gap={10} style={{ paddingVertical: 8 }}>
                <Avatar uri={u.avatar} name={u.name} size={36} />
                <Text style={{ flex: 1, color: colors.ink, fontWeight: '600' }}>{u.name}</Text>
                <Button title="Engeli kaldır" variant="ghost" small onPress={() => run(() => actions.unblockUser(u.id), 'Engel kaldırıldı')} />
              </Row>
            ))}
          </Card>
        </>
      )}

      <SectionTitle title="Hesap ve yardım" />
      <Card style={{ paddingVertical: 4 }}>
        <LinkRow icon="document-text-outline" label="Kullanım Koşulları" onPress={() => router.push('/legal/terms')} />
        <LinkRow icon="shield-checkmark-outline" label="Gizlilik Politikası / KVKK" onPress={() => router.push('/legal/privacy')} />
        <LinkRow icon="mail-outline" label={`Destek: ${SUPPORT_EMAIL}`} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <LinkRow icon="log-out-outline" label="Çıkış Yap" onPress={doLogout} />
        <LinkRow icon="trash-outline" label="Hesabımı Sil" onPress={doDelete} danger />
      </Card>

      {mode === 'local' && actions.resetDemo && (
        <Button title="Demo verilerini sıfırla" variant="ghost" small onPress={doReset} style={{ marginTop: 12, alignSelf: 'center' }} />
      )}
      <Text style={[font.tiny, { textAlign: 'center', marginTop: 8 }]}>LezzetHub · Hatay · v1.0{mode === 'local' ? ' · Demo modu' : ''}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
