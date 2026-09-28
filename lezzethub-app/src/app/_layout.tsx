import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '../components/feedback';
import { Button, EmptyState, Loading } from '../components/ui';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../lib/theme';

/** E-posta doğrulama ve şifre sıfırlama bağlantılarıyla açıldığında oturumu kurar. */
function AuthLinkHandler() {
  const { actions } = useStore();
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url || !/access_token|refresh_token/.test(url)) return;
    actions
      .handleAuthRedirect(url)
      .then(() => {
        if (actions.consumePasswordRecovery()) router.replace('/reset-password');
      })
      .catch((e) => console.warn('Bağlantı işlenemedi', e));
  }, [url, actions]);

  // Web'de Supabase bağlantıyı kendisi işler ve olay yayınlar.
  useEffect(
    () =>
      actions.subscribe(() => {
        if (actions.consumePasswordRecovery()) router.replace('/reset-password');
      }),
    [actions],
  );
  return null;
}

function RootStack() {
  const { ready, initError, retryInit } = useStore();
  if (!ready) return <Loading />;
  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.cream, padding: 24 }}>
        <EmptyState emoji="📡" title="Sunucuya bağlanılamadı" text="İnternet bağlantını kontrol edip tekrar dene." />
        <Button title="Tekrar dene" icon="refresh" onPress={retryInit} style={{ alignSelf: 'center' }} />
      </View>
    );
  }
  return (
    <>
      <AuthLinkHandler />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="register" />
        <Stack.Screen name="listing-form" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="order/new" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <FeedbackProvider>
          <StatusBar style="dark" />
          <RootStack />
        </FeedbackProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
