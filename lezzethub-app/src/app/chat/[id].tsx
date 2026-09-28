import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoginRequired } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Avatar, EmptyState, Header, IconButton, StatusBadge } from '../../components/ui';
import * as api from '../../lib/api';
import { chatTime } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, radius, shadowSoft } from '../../lib/theme';

const QUICK = ['Merhaba 👋', 'Siparişiniz hazır ✅', 'Yola çıktım 🛵', 'Teşekkürler 🙏'];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me, mutate } = useStore();
  const { run } = useFeedback();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const order = db.orders.find((o) => o.id === id);
  const messages = db.messages.filter((m) => m.orderId === id);
  const unreadForMe = me ? messages.filter((m) => m.receiverId === me.id && !m.read).length : 0;

  useEffect(() => {
    if (me && unreadForMe > 0) mutate((d) => api.markChatRead(d, me.id, id));
  }, [unreadForMe, me, id, mutate]);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Mesajlar" />
        <LoginRequired />
      </View>
    );
  }
  if (!order || (order.buyerId !== me.id && order.sellerId !== me.id)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="Mesajlar" />
        <EmptyState emoji="💬" title="Sohbet bulunamadı" />
      </View>
    );
  }

  const other = db.users.find((u) => u.id === (order.buyerId === me.id ? order.sellerId : order.buyerId));
  const send = (body: string) => {
    if (!body.trim()) return;
    run(() => {
      mutate((d) => api.sendMessage(d, me.id, order.id, body));
      setText('');
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.cream }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title={other?.name ?? 'Kullanıcı'}
        subtitle={`${order.listingTitle} · ${order.code}`}
        right={<IconButton name="receipt-outline" onPress={() => router.push(`/order/${order.id}`)} accessibilityLabel="Sipariş detayı" />}
      />
      <View style={styles.statusBar}>
        <View style={{ alignSelf: 'center' }}>
          <StatusBadge status={order.status} />
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m) => {
          if (m.senderId === 'system') {
            return (
              <View key={m.id} style={styles.system}>
                <Text style={styles.systemText}>{m.text}</Text>
                <Text style={[styles.time, { textAlign: 'center' }]}>{chatTime(m.createdAt)}</Text>
              </View>
            );
          }
          const mine = m.senderId === me.id;
          return (
            <View key={m.id} style={[styles.row, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              {!mine && other && <Avatar uri={other.avatar} name={other.name} size={28} />}
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.msg, mine && { color: '#fff' }]}>{m.text}</Text>
                <View style={styles.meta}>
                  <Text style={[styles.time, mine && { color: colors.creamDeep }]}>{chatTime(m.createdAt)}</Text>
                  {mine && <Ionicons name={m.read ? 'checkmark-done' : 'checkmark'} size={13} color={m.read ? '#fff' : colors.creamDeep} />}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {QUICK.map((q) => (
            <Pressable key={q} onPress={() => send(q)} style={styles.quick}>
              <Text style={{ color: colors.primaryDark, fontWeight: '700', fontSize: 13 }}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Mesaj yaz…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            onSubmitEditing={() => send(text)}
            blurOnSubmit={false}
          />
          <Pressable onPress={() => send(text)} style={[styles.send, !text.trim() && { opacity: 0.5 }]} accessibilityLabel="Gönder">
            <Ionicons name="send" size={19} color="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  statusBar: { alignItems: 'center', paddingBottom: 6 },
  list: { padding: 14, gap: 10, width: '100%', maxWidth: 680, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '78%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 18, ...shadowSoft },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: 5 },
  msg: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 3 },
  time: { fontSize: 10.5, color: colors.muted },
  system: { alignSelf: 'center', backgroundColor: colors.creamDeep, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 12, maxWidth: '90%' },
  systemText: { fontSize: 12.5, color: colors.primaryDark, fontWeight: '700', textAlign: 'center' },
  composer: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 12, paddingTop: 8 },
  quick: { backgroundColor: colors.creamDeep, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 11 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, width: '100%', maxWidth: 680, alignSelf: 'center' },
  input: {
    flex: 1, maxHeight: 110, minHeight: 44, backgroundColor: colors.cream, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11,
    fontSize: 15, color: colors.ink, borderWidth: 1, borderColor: colors.line, outlineStyle: 'none',
  } as object,
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
