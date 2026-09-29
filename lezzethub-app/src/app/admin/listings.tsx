import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { ListingImage } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Card, Chip, EmptyState, Field, LocationBadge, Row, Screen } from '../../components/ui';
import { tl } from '../../lib/format';
import { matchesText } from '../../lib/locations';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

export default function AdminListings() {
  const { db, me, actions } = useStore();
  const { run, confirm } = useFeedback();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'passive'>('all');
  if (!me) return null;

  const owner = (id: string) => db.users.find((u) => u.id === id);
  const list = db.listings.filter(
    (l) => (filter === 'all' || l.status === filter) && (!q.trim() || matchesText(`${l.title} ${owner(l.ownerId)?.name ?? ''} ${l.province} ${l.district} ${l.neighborhood}`, q)),
  );

  return (
    <Screen header={<AdminHeader title="İlan Yönetimi" subtitle={`${db.listings.length} ilan`} />}>
      <Field icon="search" value={q} onChangeText={setQ} placeholder="Başlık, satıcı veya ilçe ara" />
      <Row gap={8} style={{ marginBottom: 14 }}>
        <Chip label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Yayında" active={filter === 'active'} onPress={() => setFilter('active')} />
        <Chip label="Pasif" active={filter === 'passive'} onPress={() => setFilter('passive')} />
      </Row>
      {list.length === 0 && <EmptyState emoji="🔎" title="İlan bulunamadı" />}
      {list.map((l) => (
        <Card key={l.id} style={{ marginBottom: 12, padding: 12 }}>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 70, height: 70, borderRadius: 14, overflow: 'hidden' }}>
              <ListingImage listing={l} height={70} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={font.h3} numberOfLines={1} onPress={() => router.push(`/listing/${l.id}`)}>
                {l.title}
              </Text>
              <Text style={font.small}>
                {owner(l.ownerId)?.name ?? '—'} · <Text style={{ color: colors.primaryDark, fontWeight: '800' }}>{tl(l.price)}</Text>
              </Text>
              <LocationBadge province={l.province} district={l.district} neighborhood={l.neighborhood} compact />
              <Row gap={6} style={{ marginTop: 4 }}>
                <Badge label={l.status === 'active' ? 'Yayında' : 'Pasif'} tone={l.status === 'active' ? 'green' : 'gray'} />
                {l.removedByAdmin && <Badge label="Admin kaldırdı" tone="red" />}
              </Row>
            </View>
          </Row>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button
              small
              variant="outline"
              style={{ flex: 1 }}
              icon={l.status === 'active' ? 'eye-off-outline' : 'eye-outline'}
              title={l.status === 'active' ? 'Yayından Kaldır' : 'Yayına Geri Al'}
              onPress={() => run(() => actions.setListingStatus(l.id, l.status === 'active' ? 'passive' : 'active'), l.status === 'active' ? 'İlan yayından kaldırıldı' : 'İlan tekrar yayında')}
            />
            <Button
              small
              variant="danger"
              icon="trash-outline"
              title="Sil"
              onPress={async () => {
                const { ok } = await confirm({ title: 'İlanı sil', message: `“${l.title}” kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true });
                if (ok) run(() => actions.deleteListing(l.id), 'İlan silindi');
              }}
            />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
