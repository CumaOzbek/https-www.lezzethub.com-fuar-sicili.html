import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Card, EmptyState, Notice, Row, Screen, Segmented } from '../../components/ui';
import { formatIban, payoutSummary } from '../../lib/api';
import { STATUS_META, chatTime, timeAgo, tl } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';
import type { PaymentStatus } from '../../lib/types';

const TONE: Record<PaymentStatus, { label: string; tone: 'yellow' | 'green' | 'red' | 'gray' }> = {
  pending: { label: 'Bekliyor', tone: 'yellow' },
  succeeded: { label: 'Başarılı', tone: 'green' },
  failed: { label: 'Başarısız', tone: 'red' },
  refunded: { label: 'İade edildi', tone: 'gray' },
};

export default function AdminPayments() {
  const { db, me, mode, actions } = useStore();
  const { run, confirm, toast } = useFeedback();
  const [tab, setTab] = useState<'payouts' | 'transactions'>('payouts');
  const payouts = useMemo(() => payoutSummary(db), [db]);
  if (!me) return null;

  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? 'Silinmiş kullanıcı';

  const markPaid = async (sellerName: string, orderIds: string[], total: number) => {
    const r = await confirm({
      title: 'Satıcı ödemesini işaretle',
      message: `${sellerName} için ${tl(total)} tutarındaki havale/EFT’yi yaptıysan onayla. Satıcıya bildirim gönderilecek.`,
      confirmText: 'Aktarıldı',
    });
    if (r.ok) await run(() => actions.adminMarkPayout(orderIds), 'Satıcı ödemesi işaretlendi 💸');
  };

  const refund = async (orderId: string, amount: number) => {
    const r = await confirm({
      title: 'İade et',
      message: `${tl(amount)} alıcının kartına iade edilecek ve sipariş iptal edilecek.`,
      confirmText: 'İade Et',
      destructive: true,
      inputPlaceholder: 'İade gerekçesi',
    });
    if (r.ok) await run(() => actions.adminRefundOrder(orderId, r.note), 'Ödeme iade edildi');
  };

  const payments = [...db.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Screen header={<AdminHeader title="Ödemeler" subtitle={mode === 'local' ? 'Demo: test kartı ödemeleri' : 'iyzico online ödemeler ve satıcı aktarımları'} />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'payouts', label: 'Satıcı ödemeleri', count: payouts.length },
          { value: 'transactions', label: 'İşlemler', count: payments.length },
        ]}
      />
      <View style={{ height: 14 }} />
      {db.settings.paymentMode === 'offline' && (
        <View style={{ marginBottom: 12 }}>
          <Notice
            tone="green"
            icon="leaf-outline"
            title="Pilot mod"
            text="Yeni siparişlerde ödeme teslimatta doğrudan satıcıya yapılır; bu ekranda yalnızca online ödemeli (eski veya ileride açılacak) siparişler görünür."
          />
        </View>
      )}

      {tab === 'payouts' && (
        <>
          <Notice
            tone="teal"
            icon="information-circle-outline"
            text="Tamamlanan siparişlerin satıcı net tutarı (%15 hizmet bedeli düşülmüş) aşağıda satıcı bazında listelenir. Havale/EFT’yi yaptıktan sonra “Aktarıldı” olarak işaretle."
          />
          <View style={{ height: 12 }} />
          {payouts.length === 0 && <EmptyState emoji="✅" title="Bekleyen satıcı ödemesi yok" />}
          {payouts.map((p) => (
            <Card key={p.sellerId} style={{ marginBottom: 14 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>
                  {p.seller?.name ?? 'Silinmiş kullanıcı'}
                </Text>
                <Text style={{ fontWeight: '900', color: colors.success, fontSize: 18 }}>{tl(p.total)}</Text>
              </Row>
              {p.verification?.iban ? (
                <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: '700', letterSpacing: 0.5 }}>{formatIban(p.verification.iban)}</Text>
                    <Text style={font.small}>{p.verification.ibanHolder}</Text>
                  </View>
                  <Button
                    title="Kopyala"
                    icon="copy-outline"
                    small
                    variant="ghost"
                    onPress={() => Clipboard.setStringAsync(p.verification!.iban!).then(() => toast('IBAN kopyalandı', 'success'))}
                  />
                </Row>
              ) : (
                <Text style={[font.small, { color: colors.danger, marginTop: 8 }]}>Onaylı IBAN bulunamadı.</Text>
              )}
              <View style={{ marginTop: 10, gap: 4 }}>
                {p.orders.map((o) => (
                  <Text key={o.id} style={font.small} onPress={() => router.push(`/order/${o.id}`)}>
                    • {o.code} · {o.listingTitle} · {tl(o.sellerNet)}
                  </Text>
                ))}
              </View>
              <Button
                title="Aktarıldı olarak işaretle"
                icon="checkmark-done"
                variant="success"
                disabled={!p.verification?.iban}
                onPress={() => markPaid(p.seller?.name ?? 'Satıcı', p.orders.map((o) => o.id), p.total)}
                style={{ marginTop: 12 }}
              />
            </Card>
          ))}
        </>
      )}

      {tab === 'transactions' && (
        <>
          {payments.length === 0 && <EmptyState emoji="💳" title="Henüz ödeme yok" />}
          {payments.map((p) => {
            const o = db.orders.find((x) => x.id === p.orderId);
            if (!o) return null;
            return (
              <Card key={p.id} style={{ marginBottom: 12 }} onPress={() => router.push(`/order/${o.id}`)}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={font.h3} numberOfLines={1}>
                      {o.listingTitle}
                    </Text>
                    <Text style={font.small}>
                      {o.code} · {timeAgo(p.createdAt)} · {STATUS_META[o.status].label}
                    </Text>
                  </View>
                  <Badge label={TONE[p.status].label} tone={TONE[p.status].tone} />
                </Row>
                <Text style={{ color: colors.inkSoft, marginTop: 8 }}>
                  🛍 {name(o.buyerId)} → 👩‍🍳 {name(o.sellerId)}
                </Text>
                <Text style={{ color: colors.ink, fontWeight: '800', marginTop: 4 }}>
                  {tl(p.amount)} · {p.cardAssociation?.replace('_', ' ') ?? 'Kart'}
                  {p.cardLast4 ? ` •••• ${p.cardLast4}` : ''} · {p.provider === 'test' ? 'Test' : 'iyzico'}
                </Text>
                {!!p.errorMessage && p.status === 'failed' && <Text style={[font.small, { color: colors.danger, marginTop: 2 }]}>{p.errorMessage}</Text>}
                {p.status === 'refunded' && (
                  <Text style={[font.small, { marginTop: 2 }]}>
                    İade: {p.refundedAt ? chatTime(p.refundedAt) : '—'}
                    {p.refundNote ? ` · ${p.refundNote}` : ''}
                  </Text>
                )}
                {p.status === 'succeeded' && o.status === 'paid' && (
                  <Button title="İptal et ve iade yap" icon="return-down-back-outline" variant="danger" small onPress={() => refund(o.id, p.amount)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
                )}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
