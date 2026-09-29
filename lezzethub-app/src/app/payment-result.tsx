import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Card, EmptyState, Header, Screen } from '../components/ui';
import { useStore } from '../lib/store';

/** iyzico ödeme sayfasından dönüş (web yönlendirmesi veya lezzethub://payment-result bağlantısı). */
export default function PaymentResult() {
  const { status, order, message } = useLocalSearchParams<{ status?: string; order?: string; message?: string }>();
  const { actions } = useStore();
  const ok = status === 'success';

  useEffect(() => {
    actions.refresh().catch(() => {});
  }, [actions]);

  return (
    <Screen header={<Header title="Ödeme sonucu" back={false} />}>
      <Card>
        <EmptyState
          emoji={ok ? '🎉' : '⚠️'}
          title={ok ? 'Ödemen alındı' : 'Ödeme tamamlanamadı'}
          text={message || (ok ? 'Satıcı hazırlığa başlıyor. Afiyet olsun!' : 'Kartından para çekilmediyse tekrar deneyebilirsin.')}
          action={order ? 'Siparişe git' : 'Siparişlerim'}
          onAction={() => router.replace(order ? `/order/${order}` : '/orders')}
        />
      </Card>
      <View style={{ height: 8 }} />
    </Screen>
  );
}
