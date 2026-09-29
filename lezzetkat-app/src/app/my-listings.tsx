import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { DeliveryIcons, ListingImage, LoginRequired } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { Badge, Button, Card, EmptyState, Header, IconButton, Row, Screen, Segmented } from '../components/ui';
import { tl } from '../lib/format';
import { useStore } from '../lib/store';
import { shareListing } from '../lib/share';
import { colors, font } from '../lib/theme';

export default function MyListings() {
  const { db, me, actions } = useStore();
  const { run, confirm, toast } = useFeedback();
  const [tab, setTab] = useState<'active' | 'passive'>('active');

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="İlanlarım" />
        <LoginRequired />
      </View>
    );
  }

  const mine = db.listings.filter((l) => l.ownerId === me.id);
  const list = mine.filter((l) => l.status === tab);

  const remove = async (id: string, title: string) => {
    const { ok } = await confirm({ title: 'İlanı sil', message: `“${title}” kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true });
    if (ok) run(() => actions.deleteListing(id), 'İlan silindi');
  };

  return (
    <Screen header={<Header title="İlanlarım" subtitle={`${mine.length} ilan`} right={<IconButton name="add" onPress={() => router.push('/listing-form')} accessibilityLabel="Yeni ilan" />} />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Yayında', count: mine.filter((l) => l.status === 'active').length },
          { value: 'passive', label: 'Pasif', count: mine.filter((l) => l.status === 'passive').length },
        ]}
      />
      <View style={{ height: 14 }} />
      {list.length === 0 ? (
        <EmptyState emoji={tab === 'active' ? '📣' : '💤'} title={tab === 'active' ? 'Yayında ilanın yok' : 'Pasif ilanın yok'} action={tab === 'active' ? 'İlan Ver' : undefined} onAction={() => router.push('/listing-form')} />
      ) : (
        list.map((l) => {
          const orders = db.orders.filter((o) => o.listingId === l.id).length;
          return (
            <Card key={l.id} style={{ marginBottom: 12, padding: 12 }}>
              <Row gap={12} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 76, height: 76, borderRadius: 14, overflow: 'hidden' }}>
                  <ListingImage listing={l} height={76} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={font.h3} numberOfLines={1} onPress={() => router.push(`/listing/${l.id}`)}>
                    {l.title}
                  </Text>
                  <Text style={{ fontWeight: '900', color: colors.accentDark, marginTop: 2 }}>{tl(l.price)}</Text>
                  <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                    <DeliveryIcons delivery={l.delivery} />
                    <Badge label={`${orders} sipariş`} tone="gray" />
                    <Badge label={l.images.length ? `${l.images.length} fotoğraf` : 'Fotoğraf yok'} tone={l.images.length ? 'teal' : 'honey'} icon="camera-outline" />
                    {l.underReview && <Badge label="Hijyen incelemesinde" tone="red" icon="alert-circle-outline" />}
                    {l.removedByAdmin && !l.underReview && <Badge label="Admin kaldırdı" tone="red" />}
                  </Row>
                </View>
              </Row>
              <Row gap={8} style={{ marginTop: 12 }}>
                <Button title="Düzenle" icon="create-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push({ pathname: '/listing-form', params: { id: l.id } })} />
                <Button
                  title={l.status === 'active' ? 'Pasifleştir' : 'Yayına Al'}
                  icon={l.status === 'active' ? 'pause-outline' : 'play-outline'}
                  variant="outline"
                  small
                  style={{ flex: 1 }}
                  disabled={(l.removedByAdmin || l.underReview) && l.status !== 'active'}
                  onPress={() =>
                    run(
                      () => actions.setListingStatus(l.id, l.status === 'active' ? 'passive' : 'active'),
                      l.status === 'active' ? 'İlan pasifleştirildi' : 'İlan yayında',
                    )
                  }
                />
                {l.status === 'active' && (
                  <IconButton
                    name="share-social-outline"
                    color={colors.primary}
                    onPress={() =>
                      run(async () => {
                        if ((await shareListing(l, me)) === 'copied') toast('İlan bağlantısı panoya kopyalandı', 'success');
                      })
                    }
                    accessibilityLabel="Paylaş"
                  />
                )}
                <IconButton name="trash-outline" color={colors.danger} onPress={() => remove(l.id, l.title)} accessibilityLabel="Sil" />
              </Row>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
