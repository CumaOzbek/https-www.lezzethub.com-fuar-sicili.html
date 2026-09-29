import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { ConsentCheck, LegalLink, LocationFields } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { Button, Card, EmptyState, Field, Header, Notice, Row, Screen, type IconName } from '../components/ui';
import type { AccountIntent } from '../lib/api';
import { useStore } from '../lib/store';
import { colors, font, radius } from '../lib/theme';

const INTENTS: { value: AccountIntent; title: string; text: string; icon: IconName }[] = [
  { value: 'buyer', title: 'Alıcı', text: 'Ev yemeği sipariş etmek istiyorum', icon: 'bag-handle-outline' },
  { value: 'seller', title: 'Satıcı', text: 'Yemeklerimi satmak istiyorum (hijyen belgesi gerekir)', icon: 'storefront-outline' },
  { value: 'courier', title: 'Kurye', text: 'Teslimat yapmak istiyorum (A2/B ehliyet gerekir)', icon: 'bicycle-outline' },
];

const NEXT_STEP: Record<AccountIntent, string> = {
  buyer: '',
  seller: 'Giriş yaptıktan sonra hijyen belgeni yükleyerek satıcı başvurunu tamamla.',
  courier: 'Giriş yaptıktan sonra ehliyet bilgilerini yükleyerek kurye başvurunu tamamla.',
};

export default function Register() {
  const { actions } = useStore();
  const { run } = useFeedback();
  const [intent, setIntent] = useState<AccountIntent>('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loc, setLoc] = useState({ province: '', district: '', neighborhood: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    await run(async () => {
      const res = await actions.register({ name, email, password, ...loc, acceptedTerms, kvkkConsent, intent });
      if (res.needsEmailConfirmation) {
        setConfirmEmail(email.trim());
        return;
      }
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
      if (intent !== 'buyer') router.push(`/apply/${intent}`);
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
            text={`${confirmEmail} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsin. ${NEXT_STEP[intent]}`}
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
      <Screen header={<Header title="Kayıt ol" subtitle="Türkiye’nin her yerinden komşularınla buluş" />}>
        <Text style={[font.h3, { marginBottom: 10 }]}>Hesap türü</Text>
        <View style={{ gap: 8, marginBottom: 14 }}>
          {INTENTS.map((i) => {
            const active = intent === i.value;
            return (
              <Pressable
                key={i.value}
                onPress={() => setIntent(i.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primarySoft : colors.card,
                }}
              >
                <Ionicons name={i.icon} size={24} color={active ? colors.primary : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 15 }}>{i.title}</Text>
                  <Text style={font.small}>{i.text}</Text>
                </View>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.primary : colors.muted} />
              </Pressable>
            );
          })}
        </View>
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
          <Text style={[font.h3, { marginTop: 6, marginBottom: 10 }]}>📍 Konumun</Text>
          <LocationFields value={loc} onChange={setLoc} />
          <Notice tone="teal" icon="shield-checkmark-outline" text="Ana sayfada önce kendi ilçendeki ilanları görürsün. Açık adresin ve telefonun herkese açık değildir; yalnızca siparişin karşı tarafıyla paylaşılır." />
        </Card>

        <Text style={[font.h3, { marginTop: 18, marginBottom: 10 }]}>Onaylar (zorunlu)</Text>
        <ConsentCheck checked={acceptedTerms} onChange={setAcceptedTerms}>
          18 yaşından büyüğüm; <LegalLink doc="terms" label="Kullanım Koşulları" />’nı ve <LegalLink doc="privacy" label="KVKK Aydınlatma Metni" />’ni okudum, kabul ediyorum.
        </ConsentCheck>
        <ConsentCheck checked={kvkkConsent} onChange={setKvkkConsent}>
          Kişisel verilerimin <LegalLink doc="consent" label="Açık Rıza Metni" />’nde belirtilen şekilde işlenmesine ve aktarılmasına açık rıza veriyorum.
        </ConsentCheck>
        {intent !== 'buyer' && (
          <Notice
            tone="honey"
            icon="document-text-outline"
            text={
              intent === 'seller'
                ? 'Satıcı hesabı için bir sonraki adımda e-Devlet onaylı hijyen eğitimi belgeni yükleyip Satıcı Beyanı’nı onaylaman gerekecek. Belgen onaylanana kadar ilan yayınlayamazsın.'
                : 'Kurye hesabı için bir sonraki adımda A2 veya B sınıfı ehliyetini yükleyip Kurye Beyanı’nı onaylaman gerekecek.'
            }
          />
        )}

        <Button title="Hesap Oluştur" icon="sparkles-outline" onPress={submit} loading={loading} disabled={!acceptedTerms || !kvkkConsent} style={{ marginTop: 16 }} />
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
