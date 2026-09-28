import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import { pickPhotos, type PhotoSource } from '../lib/photos';
import { colors, font, radius, shadowSoft } from '../lib/theme';
import { MAX_LISTING_PHOTOS, type Listing, type User } from '../lib/types';
import { ListingImage } from './domain';
import { useFeedback } from './feedback';
import { Avatar, Button, Row } from './ui';

const TIPS = [
  { icon: 'sunny-outline' as const, text: 'Gün ışığında, pencere kenarında çek. Flaş kullanma.' },
  { icon: 'scan-outline' as const, text: 'Tabağı yakından ve ortada çek; arka plan sade olsun.' },
  { icon: 'layers-outline' as const, text: 'Farklı açılar ekle: üstten, yandan ve kesit/porsiyon.' },
  { icon: 'star-outline' as const, text: 'İlk fotoğraf kapak olur; en iştah açıcı olanı seç.' },
];

/** İlan fotoğraflarını yönetir: kamerayla çek, galeriden ekle, kapak seç, sırala, sil. */
export function PhotoManager({
  value,
  onChange,
  category,
  title,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  category: Listing['category'];
  title: string;
}) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showTips, setShowTips] = useState(value.length === 0);
  const remaining = MAX_LISTING_PHOTOS - value.length;

  const add = async (source: PhotoSource) => {
    if (remaining <= 0) return toast(`En fazla ${MAX_LISTING_PHOTOS} fotoğraf ekleyebilirsin.`, 'info');
    setBusy(true);
    try {
      const uris = await pickPhotos(source, { multiple: true, limit: remaining, aspect: [4, 3] });
      if (uris.length) {
        onChange([...value, ...uris].slice(0, MAX_LISTING_PHOTOS));
        toast(uris.length > 1 ? `${uris.length} fotoğraf eklendi` : 'Fotoğraf eklendi', 'success');
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Fotoğraf eklenemedi.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
    setSelected(to);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={styles.label}>
          Yemek fotoğrafları <Text style={{ color: colors.muted, fontWeight: '600' }}>({value.length}/{MAX_LISTING_PHOTOS})</Text>
        </Text>
        <Pressable onPress={() => setShowTips((s) => !s)} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{showTips ? 'İpuçlarını gizle' : '📸 Fotoğraf ipuçları'}</Text>
        </Pressable>
      </Row>

      {showTips && (
        <View style={styles.tips}>
          {TIPS.map((t) => (
            <Row key={t.text} gap={10} style={{ alignItems: 'flex-start', paddingVertical: 3 }}>
              <Ionicons name={t.icon} size={16} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: colors.inkSoft, fontSize: 13, lineHeight: 18 }}>{t.text}</Text>
            </Row>
          ))}
        </View>
      )}

      {value.length === 0 ? (
        <View style={styles.empty}>
          <ListingImage listing={{ images: [], category, title: title || 'x' }} height={120} style={{ borderRadius: radius.md }} />
          <Text style={[font.h3, { marginTop: 12, textAlign: 'center' }]}>Yemeğinin fotoğrafını çek</Text>
          <Text style={[font.small, { textAlign: 'center', marginTop: 4 }]}>Fotoğraflı ilanlar çok daha fazla ilgi görür.</Text>
          <Row gap={10} style={{ marginTop: 14 }}>
            <Button title="Fotoğraf Çek" icon="camera" onPress={() => add('camera')} style={{ flex: 1 }} loading={busy} small />
            <Button title="Galeriden" icon="images-outline" variant="secondary" onPress={() => add('library')} style={{ flex: 1 }} disabled={busy} small />
          </Row>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {value.map((uri, i) => (
              <Pressable
                key={uri + i}
                onPress={() => setSelected(selected === i ? null : i)}
                style={[styles.thumb, selected === i && styles.thumbSelected]}
                accessibilityLabel={`Fotoğraf ${i + 1}`}
              >
                <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {i === 0 ? (
                  <View style={styles.coverBadge}>
                    <Ionicons name="star" size={10} color="#fff" />
                    <Text style={styles.coverText}>KAPAK</Text>
                  </View>
                ) : (
                  <View style={styles.indexBadge}>
                    <Text style={styles.coverText}>{i + 1}</Text>
                  </View>
                )}
              </Pressable>
            ))}
            {remaining > 0 && (
              <>
                <Pressable onPress={() => add('camera')} style={[styles.thumb, styles.addTile]} disabled={busy} accessibilityLabel="Fotoğraf çek">
                  {busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="camera" size={26} color={colors.primary} />}
                  <Text style={styles.addText}>Çek</Text>
                </Pressable>
                <Pressable onPress={() => add('library')} style={[styles.thumb, styles.addTile]} disabled={busy} accessibilityLabel="Galeriden ekle">
                  <Ionicons name="images-outline" size={26} color={colors.primary} />
                  <Text style={styles.addText}>Galeri</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
          {selected !== null && selected < value.length ? (
            <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {selected > 0 && <Button title="Kapak yap" icon="star-outline" variant="secondary" small onPress={() => move(selected, 0)} />}
              <Button title="" icon="arrow-back" variant="outline" small onPress={() => move(selected, selected - 1)} disabled={selected === 0} />
              <Button title="" icon="arrow-forward" variant="outline" small onPress={() => move(selected, selected + 1)} disabled={selected === value.length - 1} />
              <Button
                title="Sil"
                icon="trash-outline"
                variant="danger"
                small
                onPress={() => {
                  onChange(value.filter((_, i) => i !== selected));
                  setSelected(null);
                }}
              />
            </Row>
          ) : (
            <Text style={[font.tiny, { marginTop: 8 }]}>Düzenlemek için bir fotoğrafa dokun. İlk fotoğraf ilanın kapağıdır.</Text>
          )}
        </>
      )}
    </View>
  );
}

/** İlan detayında kaydırmalı fotoğraf galerisi; dokununca tam ekran açılır. */
export function PhotoCarousel({ listing, height = 300 }: { listing: Pick<Listing, 'images' | 'category' | 'title'>; height?: number }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const images = listing.images;

  if (images.length === 0) return <ListingImage listing={listing} height={height} />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={32}>
          {images.map((uri, i) => (
            <Pressable key={uri + i} onPress={() => setViewer(i)} accessibilityLabel={`Fotoğrafı büyüt ${i + 1}`}>
              <Image source={{ uri }} style={{ width, height, backgroundColor: colors.creamDeep }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}
      {images.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
      <View style={styles.counter} pointerEvents="none">
        <Ionicons name="expand-outline" size={12} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
          {index + 1}/{images.length}
        </Text>
      </View>
      <PhotoViewer images={images} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

/** Tam ekran fotoğraf görüntüleyici. */
export function PhotoViewer({ images, index, onClose }: { images: string[]; index: number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [current, setCurrent] = useState(0);
  const open = index !== null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} onShow={() => setCurrent(index ?? 0)}>
      <View style={styles.viewer} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {open && size.w > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (index ?? 0) * size.w, y: 0 }}
            onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / size.w))}
          >
            {images.map((uri, i) => (
              <Image key={uri + i} source={{ uri }} style={{ width: size.w, height: size.h }} resizeMode="contain" />
            ))}
          </ScrollView>
        )}
        <View style={[styles.viewerBar, { top: insets.top + 8 }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {current + 1} / {images.length}
          </Text>
          <Pressable onPress={onClose} style={styles.viewerClose} accessibilityLabel="Kapat" hitSlop={8}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Profil fotoğrafı: kamerayla çek veya galeriden seç. */
export function AvatarPicker({ user, value, onChange }: { user: User; value?: string; onChange: (uri?: string) => void }) {
  const { toast } = useFeedback();
  const choose = async (source: PhotoSource) => {
    try {
      const [uri] = await pickPhotos(source, { aspect: [1, 1] });
      if (uri) onChange(uri);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Fotoğraf seçilemedi.', 'error');
    }
  };
  return (
    <View style={{ alignItems: 'center', marginBottom: 18 }}>
      <Avatar uri={value} name={user.name} size={96} />
      <Row gap={8} style={{ marginTop: 10 }}>
        <Button title="Çek" icon="camera-outline" variant="secondary" small onPress={() => choose('camera')} />
        <Button title="Galeriden" icon="images-outline" variant="secondary" small onPress={() => choose('library')} />
        {!!value && <Button title="Kaldır" icon="trash-outline" variant="ghost" small onPress={() => onChange(undefined)} />}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginLeft: 2 },
  tips: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  empty: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', ...shadowSoft },
  thumb: { width: 104, height: 104, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.creamDeep },
  thumbSelected: { borderWidth: 3, borderColor: colors.primary },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primaryLight, borderStyle: 'dashed', backgroundColor: colors.primarySoft, gap: 4 },
  addText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  coverBadge: { position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  indexBadge: { position: 'absolute', left: 6, top: 6, backgroundColor: 'rgba(30,42,41,0.65)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  coverText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  dots: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  counter: { position: 'absolute', right: 14, bottom: 40, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(30,42,41,0.6)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  viewer: { flex: 1, backgroundColor: '#0d1111' },
  viewerBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
