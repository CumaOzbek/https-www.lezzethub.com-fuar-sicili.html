import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { ListingImage } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Avatar, Badge, Button, Card, EmptyState, Row, Screen, Segmented } from '../../components/ui';
import { timeAgo } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';
import { REPORT_REASONS } from '../../lib/types';

export default function AdminReports() {
  const { db, actions } = useStore();
  const { run, confirm } = useFeedback();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');

  const list = db.reports.filter((r) => r.status === tab);
  const userName = (id: string) => db.users.find((u) => u.id === id)?.name ?? 'Silinmiş kullanıcı';

  return (
    <Screen header={<AdminHeader title="Şikayetler" subtitle="Kullanıcı içeriklerinin denetimi" />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: 'Açık', count: db.reports.filter((r) => r.status === 'open').length },
          { value: 'resolved', label: 'Çözüldü', count: db.reports.filter((r) => r.status === 'resolved').length },
        ]}
      />
      <View style={{ height: 14 }} />
      {list.length === 0 && <EmptyState emoji="🕊️" title={tab === 'open' ? 'Açık şikayet yok' : 'Çözülmüş şikayet yok'} />}
      {list.map((r) => {
        const listing = r.targetType === 'listing' ? db.listings.find((l) => l.id === r.targetId) : undefined;
        const user = r.targetType === 'user' ? db.users.find((u) => u.id === r.targetId) : listing ? db.users.find((u) => u.id === listing.ownerId) : undefined;
        const reason = REPORT_REASONS.find((x) => x.key === r.reason)?.label ?? r.reason;
        return (
          <Card key={r.id} style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Badge label={r.targetType === 'listing' ? 'İlan' : 'Kullanıcı'} tone={r.targetType === 'listing' ? 'orange' : 'blue'} icon={r.targetType === 'listing' ? 'restaurant-outline' : 'person-outline'} />
              <Text style={font.tiny}>{timeAgo(r.createdAt)}</Text>
            </Row>
            <Text style={[font.h3, { marginTop: 8 }]}>{reason}</Text>
            {!!r.note && <Text style={[font.body, { marginTop: 4 }]}>“{r.note}”</Text>}
            <Text style={[font.small, { marginTop: 4 }]}>Bildiren: {userName(r.reporterId)}</Text>

            {listing ? (
              <Card style={{ marginTop: 10, padding: 10 }} onPress={() => router.push(`/listing/${listing.id}`)}>
                <Row gap={10}>
                  <View style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden' }}>
                    <ListingImage listing={listing} height={52} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={font.h3} numberOfLines={1}>
                      {listing.title}
                    </Text>
                    <Text style={font.small}>
                      {userName(listing.ownerId)} · {listing.status === 'active' ? 'Yayında' : 'Pasif'}
                    </Text>
                  </View>
                </Row>
              </Card>
            ) : (
              r.targetType === 'listing' && <Text style={[font.small, { marginTop: 8, color: colors.muted }]}>İlan silinmiş.</Text>
            )}
            {user && r.targetType === 'user' && (
              <Card style={{ marginTop: 10, padding: 10 }} onPress={() => router.push(`/user/${user.id}`)}>
                <Row gap={10}>
                  <Avatar uri={user.avatar} name={user.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={font.h3}>{user.name}</Text>
                    <Text style={font.small}>{user.active ? 'Aktif hesap' : 'Pasif hesap'}</Text>
                  </View>
                </Row>
              </Card>
            )}

            {r.status === 'open' && (
              <View style={{ gap: 8, marginTop: 12 }}>
                <Row gap={8}>
                  {listing && listing.status === 'active' && (
                    <Button
                      title="İlanı kaldır"
                      icon="eye-off-outline"
                      variant="danger"
                      small
                      style={{ flex: 1 }}
                      onPress={() => run(async () => {
                        await actions.setListingStatus(listing.id, 'passive');
                        await actions.adminResolveReport(r.id);
                      }, 'İlan yayından kaldırıldı')}
                    />
                  )}
                  {user && user.active && user.role !== 'admin' && (
                    <Button
                      title="Hesabı pasifleştir"
                      icon="person-remove-outline"
                      variant="danger"
                      small
                      style={{ flex: 1 }}
                      onPress={async () => {
                        const { ok } = await confirm({ title: 'Hesabı pasifleştir', message: `${user.name} giriş yapamayacak ve ilanları gizlenecek.`, confirmText: 'Pasifleştir', destructive: true });
                        if (ok) {
                          await run(async () => {
                            await actions.adminSetUserActive(user.id, false);
                            await actions.adminResolveReport(r.id);
                          }, 'Hesap pasifleştirildi');
                        }
                      }}
                    />
                  )}
                </Row>
                <Button title="Sorun yok, kapat" icon="checkmark" variant="outline" small onPress={() => run(() => actions.adminResolveReport(r.id), 'Şikayet kapatıldı')} />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
