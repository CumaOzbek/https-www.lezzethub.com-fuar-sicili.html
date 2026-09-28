import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { DistrictPicker, NeighborhoodInput } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { Button, Card, EmptyState, Field, Header, Notice, Row, Screen } from '../components/ui';
import { useStore } from '../lib/store';
import { colors, font } from '../lib/theme';

export default function Register() {
  const { actions } = useStore();
  const { run } = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    await run(async () => {
      const res = await actions.register({ name, email, password, district, neighborhood, acceptedTerms });
      if (res.needsEmailConfirmation) {
        setConfirmEmail(email.trim());
        return;
      }
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    });
    setLoading(false);
  };

  if (confirmEmail) {
    return (
      <Screen header={<Header title="E-postanı doğrula" />}>
        <Card>
          <EmptyState
            emoji="📬"
            title="Neredeyse bitti!"
            text={`${confirmEmail} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsin.`}
            action="Giriş ekranına git"
            onAction={() => router.replace('/login')}
          />
          <Text style={[font.small, { textAlign: 'center' }]}>E-posta gelmediyse gereksiz (spam) klasörünü kontrol et.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen header={<Header title="Kayıt ol" subtitle="Hatay’daki komşularınla buluş" />}>
        <Card>
          <Field label="Ad Soyad" icon="person-outline" value={name} onChangeText={setName} placeholder="Ayşe Demir" autoComplete="name" />
          <Field label="E-posta" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field
            label="Şifre"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="En az 6 karakter"
            secureTextEntry={!show}
            autoComplete="new-password"
            right={
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} accessibilityLabel={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} />
              </Pressable>
            }
          />
          <Text style={[font.h3, { marginTop: 6, marginBottom: 10 }]}>📍 Konumun (Hatay)</Text>
          <DistrictPicker
            value={district}
            onChange={(d) => {
              setDistrict(d);
              setNeighborhood('');
            }}
          />
          <NeighborhoodInput district={district} value={neighborhood} onChange={setNeighborhood} />
          <Notice tone="teal" icon="shield-checkmark-outline" text="Ana sayfada varsayılan olarak kendi ilçendeki ilanları görürsün. Açık adresin herkese açık değildir; yalnızca siparişin karşı tarafıyla paylaşılır." />

          <Pressable onPress={() => setAcceptedTerms((v) => !v)} style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }}>
            <Ionicons name={acceptedTerms ? 'checkbox' : 'square-outline'} size={22} color={acceptedTerms ? colors.primary : colors.muted} />
            <Text style={{ flex: 1, color: colors.inkSoft, lineHeight: 20 }}>
              18 yaşından büyüğüm;{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => router.push('/legal/terms')}>
                Kullanım Koşulları
              </Text>
              ’nı ve{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => router.push('/legal/privacy')}>
                Gizlilik Politikası / KVKK Aydınlatma Metni
              </Text>
              ’ni okudum, kabul ediyorum.
            </Text>
          </Pressable>

          <Button title="Hesap Oluştur" icon="sparkles-outline" onPress={submit} loading={loading} disabled={!acceptedTerms} style={{ marginTop: 16 }} />
        </Card>
        <Row style={{ justifyContent: 'center', marginTop: 18 }} gap={4}>
          <Text style={font.body}>Zaten hesabın var mı?</Text>
          <Pressable onPress={() => router.replace('/login')} hitSlop={6}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>Giriş yap</Text>
          </Pressable>
        </Row>
        <View style={{ height: 8 }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
