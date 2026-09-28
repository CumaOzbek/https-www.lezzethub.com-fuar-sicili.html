import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LoginRequired, OrderCard } from '../../components/domain';
import { Chip, EmptyState, Header, Screen, Segmented } from '../../components/ui';
import { useStore } from '../../lib/store';
import { font } from '../../lib/theme';
import type { OrderStatus } from '../../lib/types';

type Filter = 'all' | 'active' | 'done' | 'closed';
const FILTERS: { key: Filter; label: string; statuses?: OrderStatus[] }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Devam eden', statuses: ['seller_pending', 'approved', 'payment_pending', 'paid'] },
  { key: 'done', label: 'Tamamlanan', statuses: ['completed'] },
  { key: 'closed', label: 'İptal / Red', statuses: ['rejected', 'cancelled'] },
];

export default function Orders() {
  const { db, me } = useStore();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'buyer' | 'seller'>(params.tab === 'seller' ? 'seller' : 'buyer');
  const [filter, setFilter] = useState<Filter>('all');

  // Panelden belirli bir sekmeyle gelindiğinde sekmeyi güncelle.
  const [prevParamTab, setPrevParamTab] = useState(params.tab);
  if (prevParamTab !== params.tab) {
    setPrevParamTab(params.tab);
    if (params.tab === 'seller' || params.tab === 'buyer') setTab(params.tab);
  }

  const { buying, selling } = useMemo(() => {
    if (!me) return { buying: [], selling: [] };
    return {
      buying: db.orders.filter((o) => o.buyerId === me.id),
      selling: db.orders.filter((o) => o.sellerId === me.id),
    };
  }, [db.orders, me]);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Siparişlerim" back={false} />
        <LoginRequired text="Siparişlerini görmek için giriş yap." />
      </View>
    );
  }

  const list = (tab === 'buyer' ? buying : selling).filter((o) => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return !f.statuses || f.statuses.includes(o.status);
  });
  const pendingSeller = selling.filter((o) => o.status === 'seller_pending').length;

  return (
    <Screen header={<Header title="Siparişlerim" back={false} subtitle="Alıcı ve satıcı olarak tüm siparişlerin" />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'buyer', label: 'Alıcı', count: buying.length },
          { value: 'seller', label: pendingSeller ? `Satıcı • ${pendingSeller} yeni` : 'Satıcı', count: pendingSeller ? undefined : selling.length },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>
      {list.length === 0 ? (
        tab === 'buyer' ? (
          <EmptyState emoji="🛍️" title="Henüz siparişin yok" text="Mahallendeki ev lezzetlerini keşfet ve ilk randevulu siparişini ver." action="Keşfet" onAction={() => router.navigate('/')} />
        ) : (
          <EmptyState emoji="👩‍🍳" title="Henüz sipariş almadın" text="İlan vererek komşularına ev yemeklerini satmaya başla." action="İlan Ver" onAction={() => router.push('/listing-form')} />
        )
      ) : (
        <>
          <Text style={[font.small, { marginBottom: 10 }]}>{list.length} sipariş</Text>
          {list.map((o) => (
            <OrderCard key={o.id} order={o} perspective={tab} />
          ))}
        </>
      )}
    </Screen>
  );
}
