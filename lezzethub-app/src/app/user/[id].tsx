import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ListingCard } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { ReportSheet } from '../../components/ReportSheet';
import { Avatar, Button, Card, EmptyState, Header, IconButton, InfoRow, LocationBadge, Notice, Screen, SectionTitle } from '../../components/ui';
import { useBlockedIds, useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me, actions } = useStore();
  const { run } = useFeedback();
  const blocked = useBlockedIds();
  const [reporting, setReporting] = useState(false);
  const user = db.users.find((u) => u.id === id);

  if (!user || (!user.active && me?.role !== 'admin')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Profil" />
        <EmptyState emoji="🙈" title="Kullanıcı bulunamadı" />
      </View>
    );
  }
  if (me?.id === user.id) return <Redirect href="/profile" />;

  const listings = db.listings.filter((l) => l.ownerId === user.id && l.status === 'active');
  const completed = db.orders.filter((o) => o.sellerId === user.id && o.status === 'completed').length;

  return (
    <Screen
      header={
        <Header
          title={user.name}
          subtitle="Satıcı profili"
          right={me && me.role !== 'admin' ? <IconButton name="flag-outline" onPress={() => setReporting(true)} accessibilityLabel="Kullanıcıyı şikayet et" /> : undefined}
        />
      }
    >
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Avatar uri={user.avatar} name={user.name} size={92} />
        <Text style={[font.h2, { marginTop: 12 }]}>{user.name}</Text>
        <View style={{ marginTop: 8 }}>
          <LocationBadge province={user.province} district={user.district} neighborhood={user.neighborhood} />
        </View>
        {user.sellerStatus === 'approved' && (
          <Text style={[font.small, { textAlign: 'center', marginTop: 8 }]}>
            🛡 Hijyen belgesi onaylı{user.foodRegistrationNo ? ` · Gıda işletmesi kayıt no: ${user.foodRegistrationNo}` : ''}
          </Text>
        )}
        {!!user.bio && <Text style={[font.body, { textAlign: 'center', marginTop: 12 }]}>{user.bio}</Text>}
        <View style={{ flexDirection: 'row', gap: 26, marginTop: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{listings.length}</Text>
            <Text style={font.small}>İlan</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>{completed}</Text>
            <Text style={font.small}>Tamamlanan sipariş</Text>
          </View>
        </View>
      </Card>
      {!!user.availability && (
        <Card style={{ marginTop: 14 }}>
          <InfoRow icon="time-outline" label="Genel müsaitlik" value={user.availability} />
        </Card>
      )}
      {blocked.has(user.id) ? (
        <View style={{ marginTop: 14 }}>
          <Notice tone="gray" icon="ban-outline" title="Bu kullanıcıyı engelledin" text="İlanlarını görmezsin ve mesajlaşamazsınız." />
          <Button title="Engeli kaldır" variant="ghost" small onPress={() => run(() => actions.unblockUser(user.id), 'Engel kaldırıldı')} style={{ alignSelf: 'center', marginTop: 6 }} />
        </View>
      ) : (
        <>
          <SectionTitle title="Yayındaki ilanları" />
          {listings.length === 0 ? <EmptyState emoji="🍽️" title="Yayında ilan yok" /> : listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </>
      )}
      {me && <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="user" targetId={user.id} userId={user.id} userName={user.name} />}
    </Screen>
  );
}
