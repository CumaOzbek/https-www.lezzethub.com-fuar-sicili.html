import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { useFeedback } from '../../components/feedback';
import { Avatar, Badge, Button, Card, EmptyState, Field, LocationBadge, Row, Screen } from '../../components/ui';
import { VERIFICATION_LABEL } from '../../lib/format';
import { matchesText } from '../../lib/locations';
import { useStore } from '../../lib/store';
import { font } from '../../lib/theme';

export default function AdminUsers() {
  const { db, me, actions } = useStore();
  const { run, confirm } = useFeedback();
  const [q, setQ] = useState('');
  if (!me) return null;

  const users = db.users.filter((u) => !q.trim() || matchesText(`${u.name} ${u.email} ${u.province} ${u.district} ${u.neighborhood}`, q));

  return (
    <Screen header={<AdminHeader title="Kullanıcı Yönetimi" subtitle={`${db.users.length} kayıtlı kullanıcı`} />}>
      <Field icon="search" value={q} onChangeText={setQ} placeholder="Ad, e-posta veya ilçe ara" />
      {users.length === 0 && <EmptyState emoji="🔎" title="Kullanıcı bulunamadı" />}
      {users.map((u) => {
        const self = u.id === me.id;
        const listings = db.listings.filter((l) => l.ownerId === u.id).length;
        const orders = db.orders.filter((o) => o.buyerId === u.id || o.sellerId === u.id).length;
        return (
          <Card key={u.id} style={{ marginBottom: 12 }}>
            <Row gap={12} style={{ alignItems: 'flex-start' }}>
              <Avatar uri={u.avatar} name={u.name} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3} onPress={() => router.push(`/user/${u.id}`)}>
                  {u.name}
                  {self ? ' (sen)' : ''}
                </Text>
                <Text style={font.small}>{u.email}</Text>
                <LocationBadge province={u.province} district={u.district} neighborhood={u.neighborhood} compact />
                <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                  <Badge label={u.role === 'admin' ? 'Admin' : 'Kullanıcı'} tone={u.role === 'admin' ? 'blue' : 'orange'} icon={u.role === 'admin' ? 'shield-checkmark' : 'person'} />
                  <Badge label={u.active ? 'Aktif' : 'Pasif'} tone={u.active ? 'green' : 'gray'} />
                  {u.sellerStatus !== 'none' && <Badge label={`Satıcı: ${VERIFICATION_LABEL[u.sellerStatus]}`} tone={u.sellerStatus === 'approved' ? 'teal' : u.sellerStatus === 'rejected' ? 'red' : 'yellow'} icon="storefront-outline" />}
                  {u.courierStatus !== 'none' && <Badge label={`Kurye: ${VERIFICATION_LABEL[u.courierStatus]}`} tone={u.courierStatus === 'approved' ? 'blue' : u.courierStatus === 'rejected' ? 'red' : 'yellow'} icon="bicycle-outline" />}
                  <Badge label={`${listings} ilan · ${orders} sipariş`} tone="gray" />
                </Row>
              </View>
            </Row>
            {!self && (
              <Row gap={8} style={{ marginTop: 12 }}>
                <Button
                  small
                  variant="outline"
                  style={{ flex: 1 }}
                  icon={u.active ? 'pause-outline' : 'play-outline'}
                  title={u.active ? 'Pasifleştir' : 'Aktifleştir'}
                  onPress={() => run(() => actions.adminSetUserActive(u.id, !u.active), u.active ? 'Kullanıcı pasifleştirildi' : 'Kullanıcı aktifleştirildi')}
                />
                <Button
                  small
                  variant="secondary"
                  style={{ flex: 1 }}
                  icon="shield-outline"
                  title={u.role === 'admin' ? 'Admin Al' : 'Admin Yap'}
                  onPress={async () => {
                    const { ok } = await confirm({ title: u.role === 'admin' ? 'Admin yetkisini al' : 'Admin yap', message: `${u.name} için yetki değiştirilecek.`, confirmText: 'Onayla' });
                    if (ok) run(() => actions.adminSetUserRole(u.id, u.role === 'admin' ? 'user' : 'admin'), 'Yetki güncellendi');
                  }}
                />
                <Button
                  small
                  variant="danger"
                  icon="trash-outline"
                  title="Sil"
                  onPress={async () => {
                    const { ok } = await confirm({ title: 'Kullanıcıyı sil', message: `${u.name} ve tüm ilanları kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true });
                    if (ok) run(() => actions.adminDeleteUser(u.id), 'Kullanıcı silindi');
                  }}
                />
              </Row>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
