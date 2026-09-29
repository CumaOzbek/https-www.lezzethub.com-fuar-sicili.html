import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { Card, Row, Screen, SectionTitle, StatCard, StatusBadge } from '../../components/ui';
import { adminStats } from '../../lib/api';
import { BUYER_FEE_RATE, SELLER_FEE_RATE } from '../../lib/commission';
import { STATUS_META, timeAgo, tl } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';
import type { OrderStatus } from '../../lib/types';

export default function AdminStats() {
  const { db } = useStore();
  const s = useMemo(() => adminStats(db), [db]);

  const byStatus = useMemo(() => {
    const m = new Map<OrderStatus, number>();
    db.orders.forEach((o) => m.set(o.status, (m.get(o.status) ?? 0) + 1));
    return m;
  }, [db.orders]);

  // En çok ilanı olan 10 il.
  const byDistrict = useMemo(() => {
    const m = new Map<string, number>();
    db.listings.filter((l) => l.status === 'active').forEach((l) => m.set(l.province, (m.get(l.province) ?? 0) + 1));
    return [...m.entries()].map(([d, n]) => ({ d, n })).sort((a, b) => b.n - a.n).slice(0, 10);
  }, [db.listings]);
  const maxD = Math.max(1, ...byDistrict.map((x) => x.n));

  return (
    <Screen header={<AdminHeader title="Yönetim Paneli" subtitle="Türkiye geneli platform istatistikleri" />}>
      <View style={styles.grid}>
        <StatCard label={`Kullanıcı · ${s.activeUsers} aktif`} value={s.users} icon="people-outline" tone="blue" onPress={() => router.navigate('/admin/users')} />
        <StatCard label={`İlan · ${s.activeListings} yayında`} value={s.listings} icon="restaurant-outline" tone="orange" onPress={() => router.navigate('/admin/listings')} />
      </View>
      <View style={styles.grid}>
        <StatCard label="Onay bekleyen başvuru" value={s.pendingVerifications} icon="document-text-outline" tone="yellow" onPress={() => router.navigate('/admin/verifications')} />
        <StatCard label={`Sipariş · ${s.completedOrders} tamamlandı`} value={s.orders} icon="receipt-outline" tone="green" />
      </View>
      <View style={styles.grid}>
        <StatCard label="Onaylı satıcı" value={s.sellers} icon="storefront-outline" tone="teal" />
        <StatCard label="Onaylı kurye" value={s.couriers} icon="bicycle-outline" tone="blue" />
      </View>
      {s.payoutDueCount > 0 && (
        <Card style={{ marginTop: 12, backgroundColor: colors.honeySoft }} onPress={() => router.navigate('/admin/payments')}>
          <Row gap={10}>
            <Text style={{ fontSize: 22 }}>💸</Text>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.warning }]}>Satıcılara {tl(s.payoutDue)} aktarılacak</Text>
              <Text style={font.small}>{s.payoutDueCount} tamamlanmış siparişin satıcı ödemesi bekliyor.</Text>
            </View>
          </Row>
        </Card>
      )}
      {s.openReports > 0 && (
        <Card style={{ marginTop: 12, backgroundColor: colors.dangerBg }} onPress={() => router.navigate('/admin/reports')}>
          <Row gap={10}>
            <Text style={{ fontSize: 22 }}>🚩</Text>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.danger }]}>{s.openReports} açık şikayet</Text>
              <Text style={font.small}>Şikayetleri 24 saat içinde incelemen önerilir.</Text>
            </View>
          </Row>
        </Card>
      )}

      {s.paymentMode === 'offline' && (
        <Card style={{ marginTop: 12, backgroundColor: colors.successBg }}>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 22 }}>🌱</Text>
            <View style={{ flex: 1 }}>
              <Text style={[font.h3, { color: colors.success }]}>Pilot mod: teslimatta ödeme</Text>
              <Text style={[font.small, { marginTop: 2, lineHeight: 18 }]}>
                Ödemeler uygulamadan geçmez; alıcı satıcıya teslimatta öder ve komisyon alınmaz. Şirket ve iyzico hazır olunca online ödemeye geçilir (README → “Online ödemeye geçiş”).
              </Text>
            </View>
          </Row>
        </Card>
      )}

      <Card style={{ marginTop: 12, backgroundColor: colors.ink }}>
        <Text style={{ color: colors.peach, fontWeight: '700', fontSize: 13 }}>Toplam komisyon geliri</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 }}>{tl(s.commission)}</Text>
        <View style={styles.revRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.revLabel}>Alıcı bedeli (%{BUYER_FEE_RATE * 100})</Text>
            <Text style={styles.revValue}>{tl(s.buyerFees)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.revLabel}>Satıcı bedeli (%{SELLER_FEE_RATE * 100})</Text>
            <Text style={styles.revValue}>{tl(s.sellerFees)}</Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>Online ödemesi alınmış siparişlerden · İşlem hacmi {tl(s.grossVolume)}</Text>
      </Card>

      <SectionTitle title="Sipariş durumları" />
      <Card>
        {(Object.keys(STATUS_META) as OrderStatus[]).map((st) => (
          <Row key={st} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <StatusBadge status={st} />
            <Text style={{ fontWeight: '900', color: colors.ink, fontSize: 16 }}>{byStatus.get(st) ?? 0}</Text>
          </Row>
        ))}
      </Card>

      <SectionTitle title="İllere göre yayındaki ilanlar (ilk 10)" />
      <Card>
        {byDistrict.length === 0 && <Text style={font.small}>Henüz ilan yok.</Text>}
        {byDistrict.map(({ d, n }) => (
          <View key={d} style={{ paddingVertical: 6 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>📍 {d}</Text>
              <Text style={{ fontWeight: '800', color: colors.primaryDark }}>{n}</Text>
            </Row>
            <View style={styles.barBg}>
              <View style={[styles.bar, { width: `${(n / maxD) * 100}%` }]} />
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle title="Son siparişler" />
      {db.orders.slice(0, 5).map((o) => (
        <Card key={o.id} style={{ marginBottom: 10, padding: 12 }} onPress={() => router.push(`/order/${o.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={font.h3} numberOfLines={1}>
                {o.listingTitle}
              </Text>
              <Text style={font.small}>
                {o.code} · {timeAgo(o.createdAt)}
              </Text>
            </View>
            <Text style={{ fontWeight: '900', color: colors.primaryDark }}>{tl(o.buyerTotal)}</Text>
          </Row>
          <View style={{ marginTop: 8 }}>
            <StatusBadge status={o.status} method={o.paymentMethod} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  revRow: { flexDirection: 'row', gap: 12, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 },
  revLabel: { color: colors.peach, fontSize: 12 },
  revValue: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  barBg: { height: 8, borderRadius: 4, backgroundColor: colors.creamDeep, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
