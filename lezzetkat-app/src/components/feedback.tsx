import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import { colors, radius, shadow } from '../lib/theme';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** Doluysa kullanıcıdan isteğe bağlı bir not istenir (ör. red gerekçesi). */
  inputPlaceholder?: string;
}

interface FeedbackValue {
  toast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  confirm: (opts: ConfirmOptions) => Promise<{ ok: boolean; note: string }>;
  /** Bir işlemi çalıştırır, ApiError'ları toast olarak gösterir. Başarılıysa true döner. */
  run: (fn: () => unknown | Promise<unknown>, success?: string) => Promise<boolean>;
}

// Web'de yerel animasyon sürücüsü yok; uyarıyı önlemek için yalnızca iOS/Android'de kullanılır.
const NATIVE_DRIVER = Platform.OS !== 'web';

const Ctx = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toastState, setToastState] = useState<{ message: string; kind: 'success' | 'error' | 'info' } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (r: { ok: boolean; note: string }) => void }) | null>(null);
  const [note, setNote] = useState('');

  const toast = useCallback<FeedbackValue['toast']>(
    (message, kind = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setToastState({ message, kind });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: NATIVE_DRIVER }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: NATIVE_DRIVER }).start(() => setToastState(null));
      }, 2600);
    },
    [opacity],
  );

  const confirm = useCallback<FeedbackValue['confirm']>(
    (opts) =>
      new Promise((resolve) => {
        setNote('');
        setDialog({ ...opts, resolve });
      }),
    [],
  );

  const run = useCallback<FeedbackValue['run']>(
    async (fn, success) => {
      try {
        await fn();
        if (success) toast(success, 'success');
        return true;
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Beklenmeyen bir hata oluştu.', 'error');
        if (!(e instanceof ApiError)) console.warn(e);
        return false;
      }
    },
    [toast],
  );

  const close = (ok: boolean) => {
    dialog?.resolve({ ok, note: note.trim() });
    setDialog(null);
  };

  const toastBg = toastState?.kind === 'error' ? colors.danger : toastState?.kind === 'info' ? colors.ink : colors.success;

  return (
    <Ctx.Provider value={{ toast, confirm, run }}>
      {children}
      {toastState && (
        <Animated.View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + 10, opacity }]}>
          <View style={[styles.toast, { backgroundColor: toastBg }]}>
            <Text style={styles.toastText}>{toastState.message}</Text>
          </View>
        </Animated.View>
      )}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{dialog?.title}</Text>
            {!!dialog?.message && <Text style={styles.dialogMsg}>{dialog.message}</Text>}
            {!!dialog?.inputPlaceholder && (
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={dialog.inputPlaceholder}
                placeholderTextColor={colors.muted}
                style={styles.input}
                multiline
              />
            )}
            <View style={styles.actions}>
              <Pressable onPress={() => close(false)} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: colors.inkSoft }]}>{dialog?.cancelText ?? 'Vazgeç'}</Text>
              </Pressable>
              <Pressable
                onPress={() => close(true)}
                style={[styles.btn, { backgroundColor: dialog?.destructive ? colors.danger : colors.primary }]}
              >
                <Text style={[styles.btnText, { color: '#fff' }]}>{dialog?.confirmText ?? 'Onayla'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
  toast: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.pill, maxWidth: 480, ...shadow },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(43,26,16,0.45)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, width: '100%', maxWidth: 420, alignSelf: 'center', ...shadow },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  dialogMsg: { fontSize: 15, color: colors.inkSoft, marginTop: 8, lineHeight: 21 },
  input: {
    marginTop: 14, minHeight: 70, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12,
    fontSize: 15, color: colors.ink, backgroundColor: colors.cream, textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  btn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: radius.pill },
  btnGhost: { backgroundColor: colors.neutralBg },
  btnText: { fontWeight: '700', fontSize: 15 },
});
