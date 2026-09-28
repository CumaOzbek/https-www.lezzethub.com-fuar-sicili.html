import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore, useUnread } from '../lib/store';
import { colors } from '../lib/theme';
import { useFeedback } from './feedback';
import { Logo } from './Logo';
import { IconButton, Row } from './ui';

export function AdminHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { logout } = useStore();
  const unread = useUnread();
  const { confirm } = useFeedback();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerInner}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Logo size={32} inverted />
          <Row gap={8}>
            <IconButton name="notifications-outline" badge={unread.notifications} onPress={() => router.push('/notifications')} color={colors.primaryDark} bg={colors.cream} accessibilityLabel="Bildirimler" />
            <IconButton
              name="log-out-outline"
              color={colors.primaryDark}
              bg={colors.cream}
              accessibilityLabel="Çıkış"
              onPress={async () => {
                const { ok } = await confirm({ title: 'Çıkış yap', message: 'Yönetici oturumu kapatılacak.', confirmText: 'Çıkış Yap' });
                if (ok) {
                  logout();
                  router.replace('/');
                }
              }}
            />
          </Row>
        </Row>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26, marginBottom: 6 },
  headerInner: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 14 },
  subtitle: { color: colors.creamDeep, fontSize: 13, marginTop: 2 },
});
