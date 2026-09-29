import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../lib/store';
import { colors, font, noOutline, radius } from '../lib/theme';
import { REPORT_REASONS, type ReportReason } from '../lib/types';
import { useFeedback } from './feedback';
import { Button, Notice, Row } from './ui';

/** İlan veya kullanıcı şikayeti; isteğe bağlı olarak kullanıcıyı engelleme. */
export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  userId,
  userName,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: 'listing' | 'user';
  targetId: string;
  /** Engellenebilecek kullanıcı (ilan sahibi veya sohbetteki kişi). */
  userId?: string;
  userName?: string;
}) {
  const { actions } = useStore();
  const { run } = useFeedback();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setReason(null);
    setNote('');
    setBlock(false);
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    const ok = await run(async () => {
      await actions.report({ targetType, targetId, reason, note });
      if (block && userId) await actions.blockUser(userId);
    }, block ? 'Şikayetin alındı ve kullanıcı engellendi.' : 'Şikayetin alındı. Ekibimiz 24 saat içinde inceleyecek.');
    setBusy(false);
    if (ok) close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Row gap={8}>
          <Ionicons name="flag" size={20} color={colors.danger} />
          <Text style={font.h2}>{targetType === 'listing' ? 'İlanı şikayet et' : 'Kullanıcıyı şikayet et'}</Text>
        </Row>
        <Text style={[font.small, { marginTop: 4, marginBottom: 12 }]}>Şikayetler gizlidir; karşı tarafa kimin bildirdiği gösterilmez.</Text>
        {REPORT_REASONS.map((r) => (
          <Pressable key={r.key} onPress={() => setReason(r.key)} style={[styles.option, reason === r.key && styles.optionActive]} accessibilityRole="radio" accessibilityState={{ checked: reason === r.key }}>
            <Ionicons name={reason === r.key ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === r.key ? colors.primary : colors.muted} />
            <Text style={{ color: colors.ink, fontSize: 15, flex: 1 }}>{r.label}</Text>
          </Pressable>
        ))}
        {reason === 'hygiene' && (
          <View style={{ marginBottom: 8 }}>
            <Notice
              tone="red"
              icon="medkit-outline"
              text="Sağlık sorunu yaşadıysan önce bir sağlık kuruluşuna başvur. Gıda şikayetlerini ALO 174 Gıda Hattı’na da bildirebilirsin. Ürünü satın aldıysan şikayetin ilanı inceleme bitene kadar hemen yayından kaldırır."
            />
          </View>
        )}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Açıklama (isteğe bağlı)"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          style={styles.input}
        />
        {!!userId && (
          <Pressable onPress={() => setBlock((b) => !b)} style={styles.blockRow} accessibilityRole="checkbox" accessibilityState={{ checked: block }}>
            <Ionicons name={block ? 'checkbox' : 'square-outline'} size={22} color={block ? colors.primary : colors.muted} />
            <Text style={{ flex: 1, color: colors.inkSoft }}>
              {userName ? `${userName} adlı kullanıcıyı da engelle` : 'Bu kullanıcıyı da engelle'} (ilanlarını görmezsin, mesajlaşamazsınız)
            </Text>
          </Pressable>
        )}
        <Row gap={10} style={{ marginTop: 14 }}>
          <Button title="Vazgeç" variant="outline" onPress={close} style={{ flex: 1 }} />
          <Button title="Gönder" icon="send" variant="primary" onPress={submit} disabled={!reason} loading={busy} style={{ flex: 1 }} />
        </Row>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,42,41,0.45)' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingTop: 10, width: '100%', maxWidth: 640, alignSelf: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.peach, alignSelf: 'center', marginBottom: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.card, marginBottom: 6, borderWidth: 1, borderColor: colors.line },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  input: { marginTop: 6, minHeight: 70, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.ink, backgroundColor: colors.card, textAlignVertical: 'top', ...noOutline },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
});
