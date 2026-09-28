// Fotoğraf çekme/seçme, sıkıştırma ve saklama yardımcıları.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { ApiError, uid } from './api';

const IS_WEB = Platform.OS === 'web';
/** Uzun kenar için hedef genişlik. Web demo modunda tarayıcı depolaması sınırlı olduğundan daha küçük. */
const TARGET_WIDTH = IS_WEB ? 960 : 1440;
const JPEG_QUALITY = IS_WEB ? 0.62 : 0.72;
/** Web demo modunda tek bir fotoğrafın base64 boyut sınırı (~700 KB). */
const MAX_WEB_DATA_URI = 950_000;

export type PhotoSource = 'camera' | 'library';

export class PhotoPermissionError extends ApiError {}

interface PickOptions {
  /** Galeriden birden fazla seçime izin ver (kırpma kapanır). */
  multiple?: boolean;
  /** Çoklu seçimde en fazla kaç fotoğraf. */
  limit?: number;
  /** Tek fotoğrafta kırpma oranı. */
  aspect?: [number, number];
}

/** Kameradan veya galeriden fotoğraf alır, sıkıştırır ve yerel adreslerini döner. İptalde boş dizi. */
export async function pickPhotos(source: PhotoSource, opts: PickOptions = {}): Promise<string[]> {
  const multiple = source === 'library' && !!opts.multiple && (opts.limit ?? 2) > 1;
  const base: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: !multiple && !IS_WEB,
    aspect: opts.aspect,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? opts.limit : undefined,
    orderedSelection: multiple,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new PhotoPermissionError('Kamera izni verilmedi. Telefonunun Ayarlar bölümünden LezzetHub için kamera iznini açabilirsin.');
    }
    result = await ImagePicker.launchCameraAsync(base);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(base);
  }
  if (result.canceled || !result.assets?.length) return [];

  const assets = multiple && opts.limit ? result.assets.slice(0, opts.limit) : result.assets;
  const out: string[] = [];
  for (const a of assets) out.push(await compress(a.uri, a.width));
  return out;
}

/** Fotoğrafı yeniden boyutlandırıp JPEG olarak sıkıştırır. */
async function compress(uri: string, width?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > TARGET_WIDTH) ctx.resize({ width: TARGET_WIDTH });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: IS_WEB });
  if (IS_WEB) {
    if (!saved.base64) return saved.uri;
    if (saved.base64.length > MAX_WEB_DATA_URI) throw new ApiError('Fotoğraf çok büyük. Lütfen daha küçük bir fotoğraf seç.');
    return `data:image/jpeg;base64,${saved.base64}`;
  }
  return saved.uri;
}

const isRemoteUrl = (uri: string) => /^https?:\/\//.test(uri);

/**
 * Yerel modda fotoğrafı kalıcı klasöre kopyalar. Seçici/sıkıştırıcı çıktıları önbellek klasöründedir
 * ve işletim sistemi tarafından silinebilir. Web'de veri adresi zaten kalıcıdır.
 */
export async function persistLocalPhoto(uri: string): Promise<string> {
  if (IS_WEB || isRemoteUrl(uri) || uri.startsWith('data:')) return uri;
  const dir = new Directory(Paths.document, 'photos');
  if (uri.startsWith(dir.uri)) return uri;
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, `${uid()}.jpg`);
  await new File(uri).copy(target);
  return target.uri;
}

/** Yükleme için fotoğrafın ham baytlarını okur. */
export async function readPhotoBytes(uri: string): Promise<Uint8Array> {
  if (IS_WEB || uri.startsWith('data:') || uri.startsWith('blob:')) {
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new File(uri).bytes();
}

/** Sunucuya yüklenmesi gereken (henüz uzak adresi olmayan) fotoğraf mı? */
export const needsUpload = (uri: string) => !isRemoteUrl(uri);
