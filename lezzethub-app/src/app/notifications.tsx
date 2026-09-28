import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LoginRequired } from '../components/domain';
import { EmptyState, Header, Screen } from '../components/ui';
import { timeAgo } from '../lib/format';
import { useStore } from '../lib/store';
import { colors, font, radius, shadowSoft } from '../lib/theme';

export default function Notifications() {
  const { db, me, mutate } = useStore();
  const list = me ? db.notifications.filter((n) => n.userId === me.id) : [];
  // Ekran açıldığındaki okunmamışları vurgulamak için ilk halini sakla.
  const [unreadAtOpen] = useState(() => new Set(list.filter((n) => !n.read).map((n) => n.id)));
  const hasUnread = list.some((n) => !n.read);

  useEffect(() => {
    if (me && hasUnread) {
      mutate((d) => d.notifications.forEach((n) => n.userId === me.id && (n.read = true)));
    }
  }, [me, hasUnread, mutate]);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Bildirimler" />
        <LoginRequired />
      </View>
    );
  }

  return (
    <Screen header={<Header title="Bildirimler" subtitle="Sipariş ve mesaj güncellemeleri" />}>
      {list.length === 0 ? (
        <EmptyState emoji="🔔" title="Bildirimin yok" text="Sipariş durumları ve yeni mesajlar burada görünecek." />
      ) : (
        list.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => n.orderId && router.push(n.title.startsWith('💬') && me.role !== 'admin' ? `/chat/${n.orderId}` : `/order/${n.orderId}`)}
            style={({ pressed }) => [styles.item, unreadAtOpen.has(n.id) && styles.unread, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.icon}>
              <Ionicons name={n.title.startsWith('💬') ? 'chatbubble-ellipses' : n.orderId ? 'receipt' : 'sparkles'} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={font.h3}>{n.title}</Text>
              <Text style={[font.small, { marginTop: 2, lineHeight: 18 }]}>{n.body}</Text>
              <Text style={[font.tiny, { marginTop: 4 }]}>{timeAgo(n.createdAt)}</Text>
            </View>
            {unreadAtOpen.has(n.id) && <View style={styles.dot} />}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...shadowSoft },
  unread: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: colors.peach },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.creamDeep, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
});
