import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { pickDocument, type DocumentSource, type PickedDocument } from '../lib/documents';
import { PhotoPermissionError } from '../lib/photos';
import { useStore } from '../lib/store';
import { colors, font, radius } from '../lib/theme';
import type { Verification } from '../lib/types';
import { useFeedback } from './feedback';
import { Button, Row } from './ui';

/** Belge yükleme alanı: kamera, galeri veya PDF. Demo modunda örnek belge seçeneği de sunulur. */
export function DocumentUpload({
  title,
  hint,
  value,
  onChange,
  sample,
  allowPdf = true,
}: {
  title: string;
  hint: string;
  value: PickedDocument | null;
  onChange: (doc: PickedDocument | null) => void;
  /** Demo modunda kullanılacak örnek belge (veri adresi). */
  sample?: string;
  allowPdf?: boolean;
}) {
  const { mode } = useStore();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<DocumentSource | null>(null);

  const pick = async (source: DocumentSource) => {
    setBusy(source);
    try {
      const doc = await pickDocument(source, { demo: mode === 'local' });
      if (doc) onChange(doc);
    } catch (e) {
      toast(e instanceof PhotoPermissionError || e instanceof Error ? e.message : 'Belge seçilemedi.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.box}>
      <Row style={{ marginBottom: 6 }}>
        <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
        <Text style={[font.h3, { flex: 1 }]}>
          {title}
          <Text style={{ color: colors.danger }}> *</Text>
        </Text>
      </Row>
      <Text style={[font.small, { marginBottom: 12 }]}>{hint}</Text>
      {value ? (
        <View style={styles.preview}>
          {value.type === 'image' ? (
            <Image source={{ uri: value.uri }} style={styles.thumb} resizeMode="cover" accessibilityLabel="Yüklenen belge" />
          ) : (
            <View style={[styles.thumb, styles.pdf]}>
              <Ionicons name="document-text" size={36} color={colors.danger} />
              <Text style={{ fontWeight: '800', color: colors.danger }}>PDF</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={{ fontWeight: '800', color: colors.success }}>Belge eklendi</Text>
            </Row>
            <Text style={[font.small, { marginTop: 4 }]} numberOfLines={2}>
              {value.name}
            </Text>
            <Pressable onPress={() => onChange(null)} hitSlop={8} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Kaldır</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Row gap={8}>
            <Button title="Fotoğraf çek" icon="camera-outline" variant="secondary" small onPress={() => pick('camera')} loading={busy === 'camera'} style={{ flex: 1 }} />
            <Button title="Galeri" icon="images-outline" variant="secondary" small onPress={() => pick('library')} loading={busy === 'library'} style={{ flex: 1 }} />
          </Row>
          {allowPdf && <Button title="PDF / dosya seç" icon="document-outline" variant="outline" small onPress={() => pick('file')} loading={busy === 'file'} />}
          {mode === 'local' && sample && (
            <Button title="Örnek belge kullan (demo)" icon="flask-outline" variant="ghost" small onPress={() => onChange({ uri: sample, type: 'image', name: 'ornek-belge.jpg' })} />
          )}
        </View>
      )}
    </View>
  );
}

/** Admin incelemesi için belge görüntüleyici (canlı modda kısa süreli imzalı bağlantı). */
export function DocumentPreview({ verification }: { verification: Verification }) {
  const { actions } = useStore();
  const [url, setUrl] = useState<{ id: string; uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    actions
      .documentUrl(verification)
      .then((uri) => alive && setUrl({ id: verification.id, uri }))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Belge açılamadı.'));
    return () => {
      alive = false;
    };
  }, [actions, verification]);

  if (error) return <Text style={[font.small, { color: colors.danger }]}>{error}</Text>;
  if (!url || url.id !== verification.id) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />;
  if (verification.docType === 'pdf') {
    return <Button title="PDF belgeyi aç" icon="document-text-outline" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(url.uri)} />;
  }
  return (
    <Pressable onPress={() => WebBrowser.openBrowserAsync(url.uri).catch(() => {})} accessibilityLabel="Belgeyi büyüt">
      <Image source={{ uri: url.uri }} style={styles.full} resizeMode="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', marginBottom: 14 },
  preview: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 96, height: 72, borderRadius: radius.md, backgroundColor: colors.creamDeep },
  pdf: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerBg },
  full: { width: '100%', height: 260, borderRadius: radius.md, backgroundColor: colors.creamDeep },
});
