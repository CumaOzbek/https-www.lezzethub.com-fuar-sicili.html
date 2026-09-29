import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { DistrictPicker, LoginRequired, ProvincePicker } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { Avatar, Badge, Button, Card, EmptyState, Header, Notice, Row, Screen } from '../components/ui';
import { couriersNear } from '../lib/api';
import { LICENSE_LABEL } from '../lib/format';
import { useStore } from '../lib/store';
import { colors, font } from '../lib/theme';

const telUrl = (phone: string) => `tel:${phone}`;
const waUrl = (phone: string, text: string) => `https://wa.me/90${phone.replace(/^0/, '')}?text=${encodeURIComponent(text)}`;
const prettyPhone = (p: string) => p.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4');

/** Yakındaki onaylı kuryeler: aynı ilçeye hizmet verenler ve müsait olanlar önce listelenir. */
export default function Couriers() {
  const { db, me } = useStore();
  const { toast } = useFeedback();
  const [province, setProvince] = useState(me?.province ?? '');
  const [district, setDistrict] = useState(me?.district ?? '');
  const list = useMemo(() => (province ? couriersNear(db, province, district) : []), [db, province, district]);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Kurye Bul" />
        <LoginRequired text="Kuryelerin iletişim bilgilerini görmek için giriş yapmalısın." />
      </View>
    );
  }

  const open = (url: string) => Linking.openURL(url).catch(() => toast('Bu cihazda bağlantı açılamadı.', 'error'));
  const nearby = list.filter((x) => x.servesDistrict);
  const others = list.filter((x) => !x.servesDistrict);

  return (
    <Screen header={<Header title="Kurye Bul" subtitle="Yakınındaki onaylı kuryelerle iletişime geç" />}>
      <Card>
        <ProvincePicker
          value={province}
          onChange={(p) => {
            setProvince(p);
            setDistrict('');
          }}
        />
        <DistrictPicker province={province} value={district} onChange={setDistrict} />
      </Card>
      <View style={{ marginTop: 12 }}>
        <Notice
          tone="honey"
          icon="information-circle-outline"
          text="Kuryeler bağımsızdır; ücret ve teslim saatini kuryeyle doğrudan konuşun. Kurye ücreti online ödemeye dahil değildir. Tüm kuryelerin A2/B ehliyeti LezzetKAT tarafından kontrol edilmiştir."
        />
      </View>
      {list.length === 0 ? (
        <EmptyState
          emoji="🛵"
          title="Bu bölgede henüz kurye yok"
          text="Kurye olarak kayıt olup komşularına teslimat yapabilirsin."
          action={me.courierStatus === 'none' ? 'Kurye olarak başvur' : undefined}
          onAction={() => router.push('/apply/courier')}
        />
      ) : (
        <>
          {(district
            ? [
                { title: `${district} ilçesine hizmet verenler`, items: nearby },
                { title: `${province} ilindeki diğer kuryeler`, items: others },
              ]
            : [{ title: `${province} ilindeki kuryeler`, items: list }]
          )
            .filter((g) => g.items.length)
            .map((g) => (
              <View key={g.title}>
                <Text style={[font.h3, { marginTop: 18, marginBottom: 10 }]}>{g.title}</Text>
                {g.items.map(({ courier: c, user: u }) => (
                  <Card key={c.userId} style={{ marginBottom: 12 }}>
                    <Row gap={12}>
                      <Avatar uri={u.avatar} name={u.name} size={48} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={font.h3} numberOfLines={1}>
                          {u.name}
                        </Text>
                        <Text style={font.small} numberOfLines={1}>
                          📍 {u.neighborhood}, {u.district}
                        </Text>
                      </View>
                      <Badge label={c.available ? 'Müsait' : 'Meşgul'} tone={c.available ? 'green' : 'gray'} icon={c.available ? 'radio-button-on' : 'pause-circle-outline'} />
                    </Row>
                    <Row gap={6} style={{ marginTop: 10, flexWrap: 'wrap' }}>
                      <Badge label={LICENSE_LABEL[c.licenseClass]} tone="blue" icon={c.vehicle === 'motorcycle' ? 'bicycle' : 'car-outline'} />
                      <Badge label="Ehliyeti onaylı" tone="teal" icon="shield-checkmark-outline" />
                    </Row>
                    <Text style={[font.small, { marginTop: 8 }]}>
                      <Ionicons name="navigate-outline" size={12} color={colors.muted} /> Hizmet ilçeleri: {c.serviceDistricts.join(', ')}
                    </Text>
                    {c.userId !== me.id && (
                      <Row gap={8} style={{ marginTop: 12 }}>
                        <Button title={prettyPhone(c.phone)} icon="call-outline" small onPress={() => open(telUrl(c.phone))} style={{ flex: 1 }} />
                        <Button
                          title="WhatsApp"
                          icon="logo-whatsapp"
                          small
                          variant="secondary"
                          onPress={() => open(waUrl(c.phone, `Merhaba ${u.name}, LezzetKAT üzerinden ulaşıyorum. ${me.district} bölgesinde bir teslimat için müsait misiniz?`))}
                          style={{ flex: 1 }}
                        />
                      </Row>
                    )}
                  </Card>
                ))}
              </View>
            ))}
        </>
      )}
      {me.courierStatus === 'none' && list.length > 0 && (
        <Button title="Ben de kurye olmak istiyorum" icon="bicycle-outline" variant="ghost" onPress={() => router.push('/apply/courier')} style={{ marginTop: 8 }} />
      )}
    </Screen>
  );
}
