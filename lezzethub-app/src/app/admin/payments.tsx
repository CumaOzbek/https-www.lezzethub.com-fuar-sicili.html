import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { PriceBreakdown } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Card, EmptyState, Row, Screen, Segmented } from '../../components/ui';
import * as api from '../../lib/api';
import { calcBreakdown } from '../../lib/commission';
import { DELIVERY_LABEL, appointmentText, timeAgo, tl } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';
import type { PaymentStatus } from '../../lib/types';

const TONE: Record<PaymentStatus, { label: string; tone: 'yellow' | 'green' | 'red' }> = {
  pending: { label: 'Onay bekliyor', tone: 'yellow' },
  approved: { label: 'Onaylandı', tone: 'green' },
  rejected: { label: 'Reddedildi', tone: 'red' },
};

export default function AdminPayments() {
  const { db, me, mutate } = useStore();
  const { run, confirm } = useFeedback();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  if (!me) return null;

  const list = db.payments.filter((p) => (tab === 'pending' ? p.status === 'pending' : p.status !== 'pending'));
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? 'Silinmiş kullanıcı';

  const decide = async (orderId: string, approve: boolean) => {
    const r = await confirm({
      title: approve ? 'Ödemeyi onayla' : 'Ödemeyi reddet',
      message: approve ? 'Ödeme onaylanacak; alıcı ve satıcıya bildirim gönderilecek.' : 'Sipariş reddedildi olarak işaretlenecek.',
      confirmText: approve ? 'Onayla' : 'Reddet',
      destructive: !approve,
      inputPlaceholder: approve ? undefined : 'Red gerekçesi (isteğe bağlı)',
    });
    if (r.ok) {
      await run(() => mutate((d) => api.orderAction(d, me, orderId, approve ? 'paymentApprove' : 'paymentReject', r.note || undefined)), approve ? 'Ödeme onaylandı ✅' : 'Ödeme reddedildi');
    }
  };

  return (
    <Screen header={<AdminHeader title="Ödeme Onayları" subtitle="Uygulama içi ödeme yok — yalnızca onay / red işaretlemesi" />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Bekleyen', count: db.payments.filter((p) => p.status === 'pending').length },
          { value: 'history', label: 'Geçmiş', count: db.payments.filter((p) => p.status !== 'pending').length },
        ]}
      />
      <View style={{ height: 14 }} />
      {list.length === 0 && <EmptyState emoji="✅" title={tab === 'pending' ? 'Bekleyen ödeme yok' : 'Henüz karar verilmiş ödeme yok'} />}
      {list.map((p) => {
        const o = db.orders.find((x) => x.id === p.orderId);
        if (!o) return null;
        return (
          <Card key={p.id} style={{ marginBottom: 14 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={font.h3} numberOfLines={1} onPress={() => router.push(`/order/${o.id}`)}>
                  {o.listingTitle}
                </Text>
                <Text style={font.small}>
                  {o.code} · {timeAgo(p.createdAt)}
                </Text>
              </View>
              <Badge label={TONE[p.status].label} tone={TONE[p.status].tone} />
            </Row>
            <View style={{ marginTop: 10, gap: 3 }}>
              <Text style={{ color: colors.inkSoft }}>🛍 Alıcı: {name(o.buyerId)}</Text>
              <Text style={{ color: colors.inkSoft }}>👩‍🍳 Satıcı: {name(o.sellerId)}</Text>
              <Text style={{ color: colors.inkSoft }}>
                🗓 {appointmentText(o.appointment)} · {DELIVERY_LABEL[o.delivery]}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <PriceBreakdown b={calcBreakdown(o.unitPrice, o.quantity)} unitPrice={o.unitPrice} quantity={o.quantity} perspective="admin" />
            </View>
            {p.status === 'pending' ? (
              <Row gap={10} style={{ marginTop: 14 }}>
                <Button title="Reddet" icon="close" variant="danger" style={{ flex: 1 }} onPress={() => decide(o.id, false)} />
                <Button title={`Onayla · ${tl(p.amount)}`} icon="checkmark" variant="success" style={{ flex: 2 }} onPress={() => decide(o.id, true)} />
              </Row>
            ) : (
              <Text style={[font.small, { marginTop: 10 }]}>
                Karar: {p.decidedAt ? timeAgo(p.decidedAt) : '—'}
                {p.adminNote ? ` · Not: ${p.adminNote}` : ''}
              </Text>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
