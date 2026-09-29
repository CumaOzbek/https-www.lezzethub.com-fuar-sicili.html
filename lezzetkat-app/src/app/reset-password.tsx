import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { useFeedback } from '../components/feedback';
import { Button, Card, Field, Header, Screen } from '../components/ui';
import { useStore } from '../lib/store';
import { font } from '../lib/theme';

/** Şifre sıfırlama bağlantısıyla açılır: yeni şifre belirlenir. */
export default function ResetPassword() {
  const { actions, me } = useStore();
  const { run, toast } = useFeedback();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password !== again) return toast('Şifreler birbiriyle aynı değil.', 'error');
    setLoading(true);
    const ok = await run(() => actions.completePasswordReset(password), 'Şifren güncellendi 🎉');
    setLoading(false);
    if (ok) router.replace(me?.role === 'admin' ? '/admin' : '/');
  };

  return (
    <Screen header={<Header title="Yeni şifre belirle" back={false} />}>
      <Card>
        <Text style={[font.body, { marginBottom: 16 }]}>Hesabın için yeni bir şifre belirle. En az 6 karakter olmalı.</Text>
        <Field label="Yeni şifre" icon="key-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Field label="Yeni şifre (tekrar)" icon="key-outline" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" />
        <Button title="Şifreyi Kaydet" icon="checkmark-circle-outline" onPress={submit} loading={loading} disabled={!password || !again} />
      </Card>
    </Screen>
  );
}
