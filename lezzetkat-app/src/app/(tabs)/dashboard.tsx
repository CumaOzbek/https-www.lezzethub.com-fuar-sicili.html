import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LoginRequired, OrderCard } from '../../components/domain';
import { Avatar, Button, Card, Header, IconButton, LocationBadge, Notice, Row, Screen, SectionTitle, StatCard, type IconName } from '../../components/ui';
import { VERIFICATION_LABEL, tl } from '../../lib/format';
import { useStore, useUnread } from '../../lib/store';
import { colors, font } from '../../lib/theme';

function MenuItem({ icon, title, subtitle, onPress, badge }: { icon: IconName; title: string; subtitle: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menu, pressed && { opacity: 0.7 }]}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={font.small}>{subtitle}</Text>
      </View>
      {!!badge && (
        <View style={styles.badge}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function Dashboard() {
  const { db, me } = useStore();
  const unread = useUnread();

  const s = useMemo(() => {
    if (!me) return null;
    const mine = db.listings.filter((l) => l.ownerId === me.id);
    const buying = db.orders.filter((o) => o.buyerId === me.id);
    const selling = db.orders.filter((o) => o.sellerId === me.id);
    const open = ['seller_pending', 'approved', 'paid'];
    return {
      active: mine.filter((l) => l.status === 'active').length,
      passive: mine.filter((l) => l.status !== 'active').length,
      buying: buying.length,
      selling: selling.length,
      openBuying: buying.filter((o) => open.includes(o.status)).length,
      openSelling: selling.filter((o) => open.includes(o.status)).length,
      toApprove: selling.filter((o) => o.status === 'seller_pending'),
      toPay: buying.filter((o) => o.status === 'approved'),
      earnings: selling.filter((o) => o.status === 'completed' || o.status === 'paid').reduce((sum, o) => sum + o.sellerNet, 0),
      spent: buying.filter((o) => o.status === 'completed' || o.status === 'paid').reduce((sum, o) => sum + o.buyerTotal, 0),
    };
  }, [db, me]);

  if (!me || !s) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Panelim" back={false} />
        <LoginRequired text="Kullanıcı paneline erişmek için giriş yap." />
      </View>
    );
  }

  const todo = [...s.toApprove, ...s.toPay];

  return (
    <Screen
      header={
        <Header
          title="Panelim"
          back={false}
          subtitle="Genel bakış"
          right={<IconButton name="notifications-outline" badge={unread.notifications} onPress={() => router.push('/notifications')} accessibilityLabel="Bildirimler" />}
        />
      }
    >
      <Card style={{ backgroundColor: colors.primary }}>
        <Row gap={12}>
          <Avatar uri={me.avatar} name={me.name} size={54} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{me.name}</Text>
            <Text style={{ color: colors.onPrimaryMuted, fontSize: 13, marginTop: 2 }}>
              📍 {me.neighborhood}, {me.district}/{me.province}
            </Text>
          </View>
        </Row>
        <View style={styles.earnRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.earnLabel}>Net kazancın</Text>
            <Text style={styles.earnValue}>{tl(s.earnings)}</Text>
          </View>
          <View style={styles.earnDivider} />
          <View style={{ flex: 1 }}>
            <Text style={styles.earnLabel}>Harcaman</Text>
            <Text style={styles.earnValue}>{tl(s.spent)}</Text>
          </View>
        </View>
      </Card>

      {me.sellerStatus !== 'approved' && (
        <View style={{ marginTop: 12 }}>
          <Notice
            tone={me.sellerStatus === 'rejected' ? 'red' : me.sellerStatus === 'pending' ? 'yellow' : 'teal'}
            icon="storefront-outline"
            title={me.sellerStatus === 'pending' ? 'Satıcı başvurun inceleniyor' : me.sellerStatus === 'rejected' ? 'Satıcı başvurun reddedildi' : 'Satış yapmak ister misin?'}
            text={me.sellerStatus === 'pending' ? 'Hijyen belgen onaylandığında ilan verebileceksin.' : 'Tüm satıcıların e-Devlet onaylı hijyen belgesi yüklemesi ve mevzuat beyanını onaylaması zorunludur.'}
          />
        </View>
      )}
      {me.sellerStatus !== 'approved' && me.sellerStatus !== 'pending' && (
        <Button title="Satıcı başvurusu" icon="document-attach-outline" variant="secondary" small onPress={() => router.push('/apply/seller')} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
      )}
      <View style={styles.grid}>
        <StatCard label="Yayındaki ilan" value={s.active} icon="megaphone-outline" tone="green" onPress={() => router.push('/my-listings')} />
        <StatCard label="Pasif ilan" value={s.passive} icon="pause-circle-outline" tone="gray" onPress={() => router.push('/my-listings')} />
      </View>
      <View style={styles.grid}>
        <StatCard label={`Alıcı siparişi · ${s.openBuying} açık`} value={s.buying} icon="bag-handle-outline" tone="blue" onPress={() => router.navigate({ pathname: '/orders', params: { tab: 'buyer' } })} />
        <StatCard label={`Satıcı siparişi · ${s.openSelling} açık`} value={s.selling} icon="storefront-outline" tone="orange" onPress={() => router.navigate({ pathname: '/orders', params: { tab: 'seller' } })} />
      </View>

      {todo.length > 0 && (
        <>
          <SectionTitle title={`Seni bekleyenler (${todo.length})`} />
          {s.toApprove.map((o) => (
            <OrderCard key={o.id} order={o} perspective="seller" />
          ))}
          {s.toPay.map((o) => (
            <OrderCard key={o.id} order={o} perspective="buyer" />
          ))}
        </>
      )}

      <SectionTitle title="Yönet" />
      <Card style={{ padding: 6 }}>
        <MenuItem icon="restaurant-outline" title="İlanlarım" subtitle="Düzenle, pasifleştir veya sil" onPress={() => router.push('/my-listings')} />
        <MenuItem icon="receipt-outline" title="Siparişlerim" subtitle="Alıcı ve satıcı siparişleri" badge={s.toApprove.length || undefined} onPress={() => router.navigate('/orders')} />
        <MenuItem icon="add-circle-outline" title="Yeni İlan Ver" subtitle="Ev yapımı lezzetini paylaş" onPress={() => router.push('/listing-form')} />
        <MenuItem icon="document-attach-outline" title="Satıcı başvurusu" subtitle={`Hijyen belgesi · ${VERIFICATION_LABEL[me.sellerStatus]}`} onPress={() => router.push('/apply/seller')} />
        <MenuItem icon="bicycle-outline" title={me.courierStatus === 'approved' ? 'Kurye panelim' : 'Kurye ol'} subtitle={`A2/B ehliyet · ${VERIFICATION_LABEL[me.courierStatus]}`} onPress={() => router.push('/apply/courier')} />
        <MenuItem icon="people-outline" title="Kurye Bul" subtitle="Yakınındaki onaylı kuryeler" onPress={() => router.push('/couriers')} />
        <MenuItem icon="notifications-outline" title="Bildirimler" subtitle="Sipariş ve mesaj bildirimleri" badge={unread.notifications || undefined} onPress={() => router.push('/notifications')} />
        <MenuItem icon="person-outline" title="Profilim" subtitle="Bio, konum, adres, müsaitlik, şifre" onPress={() => router.navigate('/profile')} />
      </Card>

      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <LocationBadge province={me.province} district={me.district} neighborhood={me.neighborhood} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  earnRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: 12, marginTop: 14 },
  earnLabel: { color: colors.onPrimaryMuted, fontSize: 12, fontWeight: '700' },
  earnValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 },
  earnDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 12 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
