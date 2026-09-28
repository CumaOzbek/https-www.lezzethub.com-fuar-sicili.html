import { Redirect, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { ListingCard } from '../../components/domain';
import { Avatar, Card, EmptyState, Header, InfoRow, LocationBadge, Screen, SectionTitle } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me } = useStore();
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
    <Screen header={<Header title={user.name} subtitle="Satıcı profili" />}>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Avatar uri={user.avatar} name={user.name} size={92} />
        <Text style={[font.h2, { marginTop: 12 }]}>{user.name}</Text>
        <View style={{ marginTop: 8 }}>
          <LocationBadge district={user.district} neighborhood={user.neighborhood} />
        </View>
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
      <SectionTitle title="Yayındaki ilanları" />
      {listings.length === 0 ? <EmptyState emoji="🍽️" title="Yayında ilan yok" /> : listings.map((l) => <ListingCard key={l.id} listing={l} />)}
    </Screen>
  );
}
