import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFeedback } from '../components/feedback';
import { Logo } from '../components/Logo';
import { Button, Field, Row } from '../components/ui';
import { DEMO_ACCOUNTS } from '../lib/seed';
import { useStore } from '../lib/store';
import { colors, font, radius, shadow } from '../lib/theme';

export default function Login() {
  const { login } = useStore();
  const { run } = useFeedback();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e = email, p = password) => {
    setLoading(true);
    await run(async () => {
      const user = await login(e, p);
      // Admin ve kullanıcı aynı ekrandan girer, role göre yönlendirilir.
      if (router.canDismiss()) router.dismissAll();
      router.replace(user.role === 'admin' ? '/admin' : '/');
    }, 'Giriş başarılı, hoş geldin!');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
          <View style={styles.inner}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.cream} />
            </Pressable>
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <Logo size={52} inverted tagline />
            </View>
          </View>
        </View>

        <View style={[styles.inner, { paddingHorizontal: 16, marginTop: -36 }]}>
          <View style={styles.card}>
            <Text style={font.h2}>Giriş yap</Text>
            <Text style={[font.small, { marginTop: 4, marginBottom: 18 }]}>Alıcı, satıcı ve yöneticiler aynı ekrandan giriş yapar.</Text>
            <Field label="E-posta" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field
              label="Şifre"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              secureTextEntry={!show}
              onSubmitEditing={() => submit()}
              right={
                <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.muted} />
                </Pressable>
              }
            />
            <Button title="Giriş Yap" icon="log-in-outline" onPress={() => submit()} loading={loading} style={{ marginTop: 4 }} />
            <Row style={{ justifyContent: 'center', marginTop: 16 }} gap={4}>
              <Text style={font.body}>Hesabın yok mu?</Text>
              <Pressable onPress={() => router.replace('/register')} hitSlop={6}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>Kayıt ol</Text>
              </Pressable>
            </Row>
          </View>

          <View style={styles.demo}>
            <Row gap={6} style={{ marginBottom: 10 }}>
              <Ionicons name="flask-outline" size={16} color={colors.primaryDark} />
              <Text style={{ fontWeight: '800', color: colors.primaryDark }}>Demo hesaplarla hızlı giriş</Text>
            </Row>
            {DEMO_ACCOUNTS.map((a) => (
              <Pressable
                key={a.email}
                onPress={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                  submit(a.email, a.password);
                }}
                style={({ pressed }) => [styles.demoRow, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: colors.ink }}>{a.label}</Text>
                  <Text style={font.small}>
                    {a.email} · {a.hint}
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={24} color={colors.primary} />
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.replace('/')} style={{ alignSelf: 'center', padding: 16 }}>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>Giriş yapmadan ilanlara göz at →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: colors.primary, paddingBottom: 60, paddingHorizontal: 16, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, ...shadow },
  demo: { backgroundColor: colors.creamDeep, borderRadius: radius.lg, padding: 14, marginTop: 16 },
  demoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginTop: 6 },
});
