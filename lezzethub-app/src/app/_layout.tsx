import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '../components/feedback';
import { Loading } from '../components/ui';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../lib/theme';

function RootStack() {
  const { ready } = useStore();
  if (!ready) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="listing-form" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="order/new" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
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
