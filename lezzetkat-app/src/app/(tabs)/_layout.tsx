import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs, router } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '../../components/ui';
import { useStore, useUnread } from '../../lib/store';
import { colors, shadow } from '../../lib/theme';

function icon(on: IconName, off: IconName) {
  return function TabBarIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? on : off} size={23} color={color} />;
  };
}

export default function TabsLayout() {
  const { me, db } = useStore();
  const unread = useUnread();
  const bottomInset = Math.max(useSafeAreaInsets().bottom, 8);
  if (me?.role === 'admin') return <Redirect href="/admin" />;
  const sellerPending = me ? db.orders.filter((o) => o.sellerId === me.id && o.status === 'seller_pending').length : 0;
  const orderBadge = sellerPending + unread.messages;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 58 + bottomInset, paddingTop: 6, paddingBottom: bottomInset },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarLabelPosition: 'below-icon',
        tabBarBadgeStyle: { backgroundColor: colors.accent, fontSize: 10 },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Keşfet', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Siparişler', tabBarIcon: icon('receipt', 'receipt-outline'), tabBarBadge: orderBadge || undefined }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'İlan Ver',
          tabBarIcon: () => (
            <View style={styles.fab}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ),
          tabBarLabelStyle: { fontSize: 11, fontWeight: '800', color: colors.accentDark },
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push(me ? '/listing-form' : '/login');
          },
        }}
      />
      <Tabs.Screen name="dashboard" options={{ title: 'Panelim', tabBarIcon: icon('grid', 'grid-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    marginTop: -22, borderWidth: 4, borderColor: colors.cream, ...shadow,
  },
});
