import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text } from 'react-native';

import { DistrictPicker, NeighborhoodInput } from '../components/domain';
import { useFeedback } from '../components/feedback';
import { Button, Card, Header, Notice, Field, Row, Screen } from '../components/ui';
import { useStore } from '../lib/store';
import { colors, font } from '../lib/theme';

export default function Register() {
  const { register } = useStore();
  const { run } = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    await run(async () => {
      await register({ name, email, password, district, neighborhood });
      if (router.canDismiss()) router.dismissAll();
      router.replace('/');
    }, 'Hesabın oluşturuldu! 🎉');
    setLoading(false);
  };

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
            right={
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
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
          <Notice tone="orange" icon="shield-checkmark-outline" text="Ana sayfada varsayılan olarak kendi ilçendeki ilanları görürsün. Konumunu dilediğin zaman profilinden değiştirebilirsin." />
          <Button title="Hesap Oluştur" icon="sparkles-outline" onPress={submit} loading={loading} style={{ marginTop: 16 }} />
        </Card>
        <Row style={{ justifyContent: 'center', marginTop: 18 }} gap={4}>
          <Text style={font.body}>Zaten hesabın var mı?</Text>
          <Pressable onPress={() => router.replace('/login')} hitSlop={6}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>Giriş yap</Text>
          </Pressable>
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
