import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useFeedback } from '../components/feedback';
import { Button, Card, EmptyState, Field, Header, Screen } from '../components/ui';
import { useStore } from '../lib/store';
import { font } from '../lib/theme';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { actions } = useStore();
  const { run } = useFeedback();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setLoading(true);
    const ok = await run(() => actions.requestPasswordReset(email));
    setLoading(false);
    if (ok) setSent(true);
  };

  return (
    <Screen header={<Header title="Şifremi unuttum" />}>
      <Card>
        {sent ? (
          <EmptyState
            emoji="📬"
            title="E-postanı kontrol et"
            text={`Bu adrese kayıtlı bir hesap varsa ${email.trim()} adresine şifre sıfırlama bağlantısı gönderdik. Bağlantı uygulamayı açıp yeni şifre belirlemeni sağlar.`}
            action="Giriş ekranına dön"
            onAction={() => router.replace('/login')}
          />
        ) : (
          <>
            <Text style={[font.body, { marginBottom: 16 }]}>Hesabına kayıtlı e-posta adresini yaz; sana şifreni sıfırlaman için bir bağlantı gönderelim.</Text>
            <Field label="E-posta" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Button title="Sıfırlama Bağlantısı Gönder" icon="send" onPress={submit} loading={loading} />
          </>
        )}
      </Card>
    </Screen>
  );
}
