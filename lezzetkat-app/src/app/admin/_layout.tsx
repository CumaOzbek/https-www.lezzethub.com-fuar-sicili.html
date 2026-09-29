import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

function icon(on: IconName, off: IconName) {
  return function TabBarIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? on : off} size={23} color={color} />;
  };
}

export default function AdminLayout() {
  const { me, db } = useStore();
  const bottomInset = Math.max(useSafeAreaInsets().bottom, 8);
  // Çıkış yapıldığında ana sayfaya dön (AdminHeader da '/' adresine yönlendirir).
  if (!me) return <Redirect href="/" />;
  if (me.role !== 'admin') return <Redirect href="/" />;
  const pendingVerifications = db.verifications.filter((v) => v.status === 'pending').length;
  const payoutDue = db.orders.filter((o) => o.status === 'completed' && o.payoutStatus === 'pending').length;
  const openReports = db.reports.filter((r) => r.status === 'open').length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 58 + bottomInset, paddingTop: 6, paddingBottom: bottomInset },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
        tabBarLabelPosition: 'below-icon',
        tabBarBadgeStyle: { backgroundColor: colors.accent, fontSize: 10 },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Özet', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="verifications" options={{ title: 'Onaylar', tabBarIcon: icon('document-text', 'document-text-outline'), tabBarBadge: pendingVerifications || undefined }} />
      <Tabs.Screen name="payments" options={{ title: 'Ödeme', tabBarIcon: icon('card', 'card-outline'), tabBarBadge: payoutDue || undefined }} />
      <Tabs.Screen name="users" options={{ title: 'Üyeler', tabBarIcon: icon('people', 'people-outline') }} />
      <Tabs.Screen name="listings" options={{ title: 'İlanlar', tabBarIcon: icon('restaurant', 'restaurant-outline') }} />
      <Tabs.Screen name="reports" options={{ title: 'Şikayet', tabBarIcon: icon('flag', 'flag-outline'), tabBarBadge: openReports || undefined }} />
    </Tabs>
  );
}
