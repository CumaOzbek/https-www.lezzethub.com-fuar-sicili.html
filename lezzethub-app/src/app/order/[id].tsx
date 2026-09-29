import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ListingImage, LoginRequired, PriceBreakdown } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Avatar, Badge, Button, Card, EmptyState, Field, Header, InfoRow, LocationBadge, Notice, Row, Screen, StatusBadge } from '../../components/ui';
import * as api from '../../lib/api';
import { calcBreakdown } from '../../lib/commission';
import { DELIVERY_LABEL, ORDER_FLOW, STATUS_META, appointmentText, chatTime, shippingPayerText, tl } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

const STEP_LABELS = ['Sipariş verildi', 'Satıcı onayladı', 'Ödendi', 'Tamamlandı'];

const PAYMENT_STATUS: Record<string, { label: string; tone: 'green' | 'red' | 'yellow' | 'gray' }> = {
  pending: { label: 'Bekliyor', tone: 'yellow' },
  succeeded: { label: 'Başarılı', tone: 'green' },
  failed: { label: 'Başarısız', tone: 'red' },
  refunded: { label: 'İade edildi', tone: 'gray' },
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me, actions: backend } = useStore();
  const { run, confirm } = useFeedback();
  const order = db.orders.find((o) => o.id === id);
  const [company, setCompany] = useState(order?.shippingCompany ?? '');
  const [tracking, setTracking] = useState(order?.trackingCode ?? '');
  const [savingShipment, setSavingShipment] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Sipariş" />
        <LoginRequired />
      </View>
    );
  }
  const allowed = order && (order.buyerId === me.id || order.sellerId === me.id || me.role === 'admin');
  if (!order || !allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Sipariş" />
        <EmptyState emoji="🧾" title="Sipariş bulunamadı" />
      </View>
    );
  }

  const isBuyer = order.buyerId === me.id;
  const isSeller = order.sellerId === me.id;
  const perspective = me.role === 'admin' && !isBuyer && !isSeller ? 'admin' : isBuyer ? 'buyer' : 'seller';
  const buyer = db.users.find((u) => u.id === order.buyerId);
  const seller = db.users.find((u) => u.id === order.sellerId);
  const other = isBuyer ? seller : buyer;
  const listing = db.listings.find((l) => l.id === order.listingId);
  const actions = api.availableActions(order, me);
  const unread = db.messages.filter((m) => m.orderId === order.id && m.receiverId === me.id && !m.read).length;
  const closed = order.status === 'rejected' || order.status === 'cancelled';
  const stepIdx = ORDER_FLOW.indexOf(order.status);
  const lastGood = closed ? ORDER_FLOW.indexOf([...order.history].reverse().find((h) => ORDER_FLOW.includes(h.status))?.status ?? 'seller_pending') : stepIdx;
  const b = calcBreakdown(order.unitPrice, order.quantity);
  const confirmedStage = ['approved', 'paid', 'completed'].includes(order.status);
  const payments = db.payments.filter((p) => p.orderId === order.id);
  const canPay = api.canPay(order, me);
  const shipsToAddress = order.delivery !== 'pickup';

  const saveShipment = async () => {
    setSavingShipment(true);
    await run(() => backend.setShipment(order.id, company, tracking), 'Kargo bilgisi alıcıya iletildi 📦');
    setSavingShipment(false);
  };

  const refund = async () => {
    const r = await confirm({
      title: 'Siparişi iptal et ve iade yap',
      message: `${tl(order.buyerTotal)} alıcının kartına iade edilecek ve sipariş iptal edilecek.`,
      confirmText: 'İade Et',
      destructive: true,
      inputPlaceholder: 'İade gerekçesi (taraflara iletilir)',
    });
    if (r.ok) await run(() => backend.adminRefundOrder(order.id, r.note), 'Ödeme iade edildi');
  };

  const act = async (action: api.OrderAction, opts: { title: string; message: string; confirmText: string; destructive?: boolean; note?: string; success: string }) => {
    const r = await confirm({ title: opts.title, message: opts.message, confirmText: opts.confirmText, destructive: opts.destructive, inputPlaceholder: opts.note });
    if (r.ok) await run(() => backend.orderAction(order.id, action, r.note || undefined), opts.success);
  };

  const userName = (uid: string) => (uid === me.id ? 'Sen' : db.users.find((u) => u.id === uid)?.name ?? 'Sistem');

  return (
    <Screen header={<Header title={`Sipariş ${order.code}`} subtitle={`${new Date(order.createdAt).toLocaleDateString('tr-TR')} tarihinde oluşturuldu`} />}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <StatusBadge status={order.status} />
          <Text style={font.tiny}>{perspective === 'buyer' ? 'Alıcı olarak' : perspective === 'seller' ? 'Satıcı olarak' : 'Yönetici görünümü'}</Text>
        </Row>
        <View style={styles.steps}>
          {ORDER_FLOW.map((s, i) => {
            const done = i <= lastGood;
            const failedHere = closed && i === lastGood + 1;
            return (
              <View key={s} style={styles.step}>
                <View style={styles.stepLineWrap}>
                  <View style={[styles.stepLine, { backgroundColor: i === 0 ? 'transparent' : i <= lastGood ? colors.primary : colors.line }]} />
                  <View style={[styles.stepDot, done && { backgroundColor: colors.primary, borderColor: colors.primary }, failedHere && { backgroundColor: colors.danger, borderColor: colors.danger }]}>
                    {done && <Ionicons name="checkmark" size={12} color="#fff" />}
                    {failedHere && <Ionicons name="close" size={12} color="#fff" />}
                  </View>
                  <View style={[styles.stepLine, { backgroundColor: i === ORDER_FLOW.length - 1 ? 'transparent' : i < lastGood ? colors.primary : colors.line }]} />
                </View>
                <Text style={[styles.stepText, done && { color: colors.ink }]} numberOfLines={2}>
                  {STEP_LABELS[i]}
                </Text>
              </View>
            );
          })}
        </View>
        {closed && (
          <Notice tone={order.status === 'rejected' ? 'red' : 'gray'} icon={order.status === 'rejected' ? 'close-circle-outline' : 'ban-outline'} title={STATUS_META[order.status].label} text={order.statusNote ?? ''} />
        )}
        {order.status === 'approved' && isBuyer && <Notice tone="blue" icon="card-outline" text="Satıcı siparişini onayladı! Kartınla online ödeme yaparak siparişi kesinleştir." />}
        {order.status === 'approved' && isSeller && <Notice tone="blue" icon="hourglass-outline" text="Alıcının online ödemesi bekleniyor. Ödeme alınmadan hazırlığa başlama." />}
        {order.status === 'paid' && isSeller && <Notice tone="green" icon="checkmark-circle-outline" text="Ödeme alındı. Randevu saatine göre hazırlığa başlayabilirsin." />}
        {order.status === 'seller_pending' && isSeller && <Notice tone="yellow" icon="notifications-outline" text="Yeni sipariş talebi! Onaylamadan önce randevu saatine uygun olduğundan emin ol." />}
      </Card>

      {(actions.length > 0 || canPay) && (
        <View style={{ gap: 10, marginTop: 14 }}>
          {actions.includes('approve') && (
            <Button title="Siparişi Onayla" icon="checkmark-circle" variant="success" onPress={() => act('approve', { title: 'Siparişi onayla', message: `${order.quantity} adet “${order.listingTitle}” — ${appointmentText(order.appointment)}`, confirmText: 'Onayla', success: 'Sipariş onaylandı' })} />
          )}
          {canPay && <Button title={`Online Öde · ${tl(order.buyerTotal)}`} icon="card" onPress={() => router.push(`/pay/${order.id}`)} />}
          {actions.includes('refund') && <Button title="İptal et ve karta iade yap" icon="return-down-back-outline" variant="danger" onPress={refund} />}
          {actions.includes('complete') && (
            <Button title="Teslim Edildi · Tamamlandı" icon="checkmark-done" variant="success" onPress={() => act('complete', { title: 'Siparişi tamamla', message: 'Teslimat yapıldıysa siparişi tamamlandı olarak işaretle.', confirmText: 'Tamamlandı', success: 'Sipariş tamamlandı 🧡' })} />
          )}
          <Row gap={10}>
            {actions.includes('reject') && (
              <Button title="Reddet" icon="close" variant="danger" style={{ flex: 1 }} onPress={() => act('reject', { title: 'Siparişi reddet', message: 'Alıcıya bildirim gönderilecek.', confirmText: 'Reddet', destructive: true, note: 'Red gerekçesi (isteğe bağlı)', success: 'Sipariş reddedildi' })} />
            )}
            {actions.includes('cancel') && (
              <Button title="İptal Et" icon="ban-outline" variant="outline" style={{ flex: 1 }} onPress={() => act('cancel', { title: 'Siparişi iptal et', message: 'Bu işlem geri alınamaz.', confirmText: 'İptal Et', destructive: true, note: 'İptal nedeni (isteğe bağlı)', success: 'Sipariş iptal edildi' })} />
            )}
          </Row>
        </View>
      )}

      <Card style={{ marginTop: 14, padding: 12 }} onPress={listing ? () => router.push(`/listing/${listing.id}`) : undefined}>
        <Row gap={12}>
          <View style={{ width: 60, height: 60, borderRadius: 14, overflow: 'hidden' }}>
            <ListingImage listing={listing ?? { category: 'diger', title: order.listingTitle }} height={60} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={font.h3} numberOfLines={1}>
              {order.listingTitle}
            </Text>
            <Text style={font.small}>
              {order.quantity} adet × {order.unitPrice.toLocaleString('tr-TR')} ₺
            </Text>
          </View>
          {listing && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
        </Row>
      </Card>

      {perspective === 'admin' ? (
        <Card style={{ marginTop: 14 }}>
          <Text style={[font.h3, { marginBottom: 8 }]}>Taraflar</Text>
          <InfoRow icon="bag-handle-outline" label="Alıcı" value={buyer ? `${buyer.name} · ${buyer.neighborhood}, ${buyer.district}/${buyer.province}` : '—'} />
          <InfoRow icon="storefront-outline" label="Satıcı" value={seller ? `${seller.name} · ${seller.neighborhood}, ${seller.district}/${seller.province}` : '—'} />
        </Card>
      ) : (
        other && (
          <Card style={{ marginTop: 14 }}>
            <Row gap={12}>
              <Avatar uri={other.avatar} name={other.name} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={font.tiny}>{isBuyer ? 'Satıcı' : 'Alıcı'}</Text>
                <Text style={font.h3}>{other.name}</Text>
                <LocationBadge province={other.province} district={other.district} neighborhood={other.neighborhood} compact />
              </View>
            </Row>
            <Button title={unread ? `Mesajlar (${unread} yeni)` : 'Mesajlaş'} icon="chatbubbles-outline" variant="secondary" onPress={() => router.push(`/chat/${order.id}`)} style={{ marginTop: 12 }} />
          </Card>
        )
      )}

      <Card style={{ marginTop: 14 }}>
        <Text style={[font.h3, { marginBottom: 4 }]}>Randevu & teslimat</Text>
        <InfoRow icon="calendar-outline" label="Randevu" value={appointmentText(order.appointment)} />
        <InfoRow icon={order.delivery === 'courier' ? 'bicycle' : order.delivery === 'cargo' ? 'cube-outline' : 'hand-left-outline'} label="Teslimat yöntemi" value={DELIVERY_LABEL[order.delivery]} />
        {shipsToAddress && <InfoRow icon="location-outline" label="Teslimat adresi (alıcı)" value={order.address} />}
        {shipsToAddress && <InfoRow icon={order.shippingPayer === 'seller' ? 'gift-outline' : 'wallet-outline'} label="Gönderim ücreti" value={shippingPayerText(order.delivery, order.shippingPayer)} />}
        {order.delivery === 'cargo' && (
          <InfoRow
            icon="barcode-outline"
            label="Kargo takip"
            value={order.trackingCode ? `${order.shippingCompany} · ${order.trackingCode}` : order.status === 'paid' ? 'Satıcı kargoya verdiğinde burada görünecek' : undefined}
          />
        )}
        {order.delivery === 'pickup' && (
          <InfoRow
            icon="location-outline"
            label="Teslim alma adresi (satıcı)"
            value={
              isBuyer && !confirmedStage
                ? `${seller?.neighborhood ?? ''}, ${seller?.district ?? ''} · açık adres satıcı onayından sonra görünür`
                : order.pickupAddress || (isSeller ? seller?.address : '') || `${seller?.neighborhood ?? ''}, ${seller?.district ?? ''}`
            }
          />
        )}
        {!!order.note && <InfoRow icon="document-text-outline" label="Not" value={order.note} />}
        {order.delivery === 'courier' && (isBuyer || isSeller) && (order.status === 'approved' || order.status === 'paid') && (
          <Button
            title="Yakındaki kuryeleri gör"
            icon="bicycle-outline"
            variant="secondary"
            small
            onPress={() => router.push('/couriers')}
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
          />
        )}
      </Card>

      {order.delivery === 'cargo' && isSeller && order.status === 'paid' && (
        <Card style={{ marginTop: 14 }}>
          <Text style={[font.h3, { marginBottom: 4 }]}>📦 Kargo bilgisi</Text>
          <Text style={[font.small, { marginBottom: 12 }]}>
            {order.shippingPayer === 'seller' ? 'Kargo ücreti sende. ' : 'Kargo ücreti alıcıda (karşı ödemeli gönderebilirsin). '}
            Kargoya verdikten sonra firma ve takip numarasını gir; alıcıya bildirim gider.
          </Text>
          <Field label="Kargo firması" icon="business-outline" value={company} onChangeText={setCompany} placeholder="Ör. Yurtiçi, Aras, MNG, PTT" />
          <Field label="Takip numarası" icon="barcode-outline" value={tracking} onChangeText={setTracking} autoCapitalize="characters" />
          <Button title={order.trackingCode ? 'Kargo bilgisini güncelle' : 'Kargoya verdim'} icon="send-outline" onPress={saveShipment} loading={savingShipment} />
        </Card>
      )}

      {payments.length > 0 && (
        <Card style={{ marginTop: 14 }}>
          <Text style={[font.h3, { marginBottom: 6 }]}>Ödeme</Text>
          {payments.map((p) => (
            <Row key={p.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>
                  {tl(p.amount)} · {p.cardAssociation ? p.cardAssociation.replace('_', ' ') : 'Kart'}
                  {p.cardLast4 ? ` •••• ${p.cardLast4}` : ''}
                </Text>
                <Text style={font.small}>
                  {chatTime(p.paidAt ?? p.createdAt)} · {p.provider === 'test' ? 'Test ödemesi (demo)' : 'iyzico'}
                  {p.errorMessage && p.status === 'failed' ? ` · ${p.errorMessage}` : ''}
                  {p.refundNote && p.status === 'refunded' ? ` · ${p.refundNote}` : ''}
                </Text>
              </View>
              <Badge label={PAYMENT_STATUS[p.status]!.label} tone={PAYMENT_STATUS[p.status]!.tone} />
            </Row>
          ))}
          {order.status === 'completed' && (isSeller || perspective === 'admin') && (
            <Text style={[font.small, { marginTop: 6 }]}>
              Satıcı ödemesi: {order.payoutStatus === 'paid' ? `IBAN’a aktarıldı (${chatTime(order.payoutAt!)})` : 'Aktarım bekliyor (tamamlanan siparişler düzenli olarak ödenir)'}
            </Text>
          )}
        </Card>
      )}

      <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Hesap dökümü</Text>
      <PriceBreakdown b={b} unitPrice={order.unitPrice} quantity={order.quantity} perspective={perspective} />

      <Text style={[font.h3, { marginTop: 20, marginBottom: 10 }]}>Sipariş geçmişi</Text>
      <Card>
        {[...order.history].reverse().map((h, i) => (
          <Row key={i} gap={10} style={{ alignItems: 'flex-start', paddingVertical: 6 }}>
            <View style={[styles.histDot, { backgroundColor: i === 0 ? colors.primary : colors.peach }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{STATUS_META[h.status].label}</Text>
              <Text style={font.small}>
                {userName(h.by)} · {chatTime(h.at)}
                {h.note ? ` · ${h.note}` : ''}
              </Text>
            </View>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', marginTop: 16, marginBottom: 12 },
  step: { flex: 1, alignItems: 'center' },
  stepLineWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stepLine: { flex: 1, height: 3, borderRadius: 2 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 10.5, fontWeight: '700', color: colors.muted, textAlign: 'center', marginTop: 6, paddingHorizontal: 2 },
  histDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
});
