import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { LoginRequired, PriceBreakdown } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Button, Card, EmptyState, Field, Header, InfoRow, Notice, Row, Screen, StickyFooter } from '../../components/ui';
import { canPay } from '../../lib/api';
import { calcBreakdown } from '../../lib/commission';
import { DELIVERY_LABEL, appointmentText, shippingPayerText, tl } from '../../lib/format';
import { TEST_CARDS } from '../../lib/seed';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';

const formatCard = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Online ödeme. Canlı modda iyzico güvenli ödeme sayfası açılır; demo modunda test kartıyla simüle edilir. */
export default function Pay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me, mode, actions } = useStore();
  const { run, toast } = useFeedback();
  const [holder, setHolder] = useState(me?.name ?? '');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [paying, setPaying] = useState(false);
  const order = db.orders.find((o) => o.id === id);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Ödeme" />
        <LoginRequired />
      </View>
    );
  }
  if (!order || order.buyerId !== me.id) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Ödeme" />
        <EmptyState emoji="🧾" title="Sipariş bulunamadı" />
      </View>
    );
  }
  if (!canPay(order, me)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Ödeme" />
        <EmptyState
          emoji={order.status === 'paid' || order.status === 'completed' ? '✅' : '⏳'}
          title={order.status === 'paid' || order.status === 'completed' ? 'Bu siparişin ödemesi yapıldı' : 'Bu sipariş için şu anda ödeme yapılamaz'}
          text={order.status === 'seller_pending' ? 'Satıcı siparişi onayladıktan sonra ödeme yapabilirsin.' : undefined}
          action="Siparişe dön"
          onAction={() => router.replace(`/order/${order.id}`)}
        />
      </View>
    );
  }

  const b = calcBreakdown(order.unitPrice, order.quantity);

  const payTest = async () => {
    setPaying(true);
    const ok = await run(() => actions.payWithTestCard!(order.id, { holder, number, expiry, cvc }), 'Ödemen alındı 🎉');
    setPaying(false);
    if (ok) router.replace(`/order/${order.id}`);
  };

  const payOnline = async () => {
    setPaying(true);
    try {
      const r = await actions.payOnline!(order.id);
      if (r.status === 'success') {
        toast(r.message, 'success');
        router.replace(`/order/${order.id}`);
      } else if (r.status === 'failure') {
        toast(r.message, 'error');
      } else if (r.status === 'cancelled') {
        toast(r.message, 'info');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ödeme başlatılamadı.', 'error');
    } finally {
      setPaying(false);
    }
  };

  const demo = mode === 'local';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen
        header={<Header title="Online Ödeme" subtitle={`Sipariş ${order.code}`} />}
        footer={
          <StickyFooter>
            <Button
              title={demo ? `Test kartıyla öde · ${tl(order.buyerTotal)}` : `Güvenli ödeme sayfasına git · ${tl(order.buyerTotal)}`}
              icon="lock-closed"
              onPress={demo ? payTest : payOnline}
              loading={paying}
            />
          </StickyFooter>
        }
      >
        <Card>
          <Text style={font.h3}>{order.listingTitle}</Text>
          <InfoRow icon="calendar-outline" label="Randevu" value={appointmentText(order.appointment)} />
          <InfoRow icon="cube-outline" label="Teslimat" value={DELIVERY_LABEL[order.delivery]} />
          {order.delivery !== 'pickup' && <InfoRow icon="wallet-outline" label="Gönderim ücreti" value={shippingPayerText(order.delivery, order.shippingPayer)} />}
        </Card>
        <View style={{ height: 14 }} />
        <PriceBreakdown b={b} unitPrice={order.unitPrice} quantity={order.quantity} perspective="buyer" />

        {demo ? (
          <>
            <View style={{ marginTop: 14 }}>
              <Notice
                tone="honey"
                icon="flask-outline"
                title="Demo modu: gerçek ödeme alınmaz"
                text="Canlı sürümde bu adımda iyzico güvenli ödeme sayfası (3D Secure) açılır. Denemek için aşağıdaki test kartlarından birini kullan."
              />
            </View>
            <Row gap={8} style={{ marginTop: 10 }}>
              <Button
                title="Başarılı test kartı"
                small
                variant="secondary"
                icon="checkmark-circle-outline"
                style={{ flex: 1 }}
                onPress={() => {
                  setNumber(TEST_CARDS.success);
                  setExpiry('12/30');
                  setCvc('123');
                }}
              />
              <Button
                title="Reddedilen kart"
                small
                variant="outline"
                icon="close-circle-outline"
                style={{ flex: 1 }}
                onPress={() => {
                  setNumber(TEST_CARDS.declined);
                  setExpiry('12/30');
                  setCvc('123');
                }}
              />
            </Row>
            <Card style={{ marginTop: 12 }}>
              <Field label="Kart üzerindeki isim" icon="person-outline" value={holder} onChangeText={setHolder} autoComplete="name" />
              <Field label="Kart numarası" icon="card-outline" value={number} onChangeText={(t) => setNumber(formatCard(t))} keyboardType="number-pad" placeholder="0000 0000 0000 0000" maxLength={19} />
              <Row gap={10}>
                <Field label="Son kullanma" value={expiry} onChangeText={(t) => setExpiry(formatExpiry(t))} keyboardType="number-pad" placeholder="AA/YY" maxLength={5} style={{ flex: 1 }} />
                <Field label="CVC" value={cvc} onChangeText={(t) => setCvc(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="123" secureTextEntry style={{ flex: 1 }} />
              </Row>
              <Text style={font.tiny}>Kart numarası saklanmaz; yalnızca son 4 hane sipariş kaydına eklenir.</Text>
            </Card>
          </>
        ) : (
          <Card style={{ marginTop: 14 }}>
            <Row gap={10} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="shield-checkmark" size={26} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>iyzico ile güvenli ödeme</Text>
                <Text style={[font.small, { marginTop: 4, lineHeight: 18 }]}>
                  Kart bilgilerini iyzico’nun güvenli ödeme sayfasına girersin; bankan 3D Secure doğrulaması isteyebilir. Kart bilgilerin LezzetHub’a iletilmez ve saklanmaz. Ödeme tamamlanınca uygulamaya geri dönersin.
                </Text>
              </View>
            </Row>
          </Card>
        )}
        <Pressable onPress={() => router.push('/legal/sales')} style={{ marginTop: 14 }}>
          <Text style={[font.small, { textAlign: 'center', color: colors.primary, fontWeight: '700' }]}>Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
