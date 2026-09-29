// Belge (hijyen belgesi, ehliyet) seçme ve saklama yardımcıları. Fotoğraf veya PDF kabul edilir.
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { ApiError, uid } from './api';
import { pickPhotos } from './photos';
import type { DocumentType } from './types';

const IS_WEB = Platform.OS === 'web';
/** Sunucuya yüklenebilecek en büyük belge (8 MB; storage.sql ile aynı). */
const MAX_BYTES = 8 * 1024 * 1024;
/** Web demo modunda belge tarayıcıda saklandığından daha küçük sınır. */
const MAX_WEB_DEMO_BYTES = 1.5 * 1024 * 1024;

export interface PickedDocument {
  uri: string;
  type: DocumentType;
  name: string;
}

export type DocumentSource = 'camera' | 'library' | 'file';

/** Kameradan/galeriden fotoğraf veya dosyalardan PDF seçer. İptalde null. */
export async function pickDocument(source: DocumentSource, opts: { demo?: boolean } = {}): Promise<PickedDocument | null> {
  if (source !== 'file') {
    const [uri] = await pickPhotos(source);
    return uri ? { uri, type: 'image', name: 'belge.jpg' } : null;
  }
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png'],
    copyToCacheDirectory: true,
    multiple: false,
    base64: IS_WEB && opts.demo,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const isPdf = a.mimeType === 'application/pdf' || /\.pdf$/i.test(a.name);
  if (!isPdf && !/^image\//.test(a.mimeType ?? '') && !/\.(jpe?g|png)$/i.test(a.name)) throw new ApiError('Belge PDF, JPG veya PNG olmalıdır.');
  const limit = IS_WEB && opts.demo ? MAX_WEB_DEMO_BYTES : MAX_BYTES;
  if (a.size && a.size > limit) throw new ApiError(`Belge çok büyük (en fazla ${Math.round(limit / 1024 / 1024 * 10) / 10} MB).`);
  let uri = a.uri;
  if (IS_WEB && opts.demo && a.base64 && !uri.startsWith('data:')) {
    uri = `data:${a.mimeType ?? (isPdf ? 'application/pdf' : 'image/jpeg')};base64,${a.base64}`;
  }
  return { uri, type: isPdf ? 'pdf' : 'image', name: a.name };
}

/** Yerel modda belgeyi kalıcı klasöre kopyalar (önbellek klasörü işletim sistemince silinebilir). */
export async function persistLocalDocument(uri: string, type: DocumentType): Promise<string> {
  if (IS_WEB || /^(https?:|data:)/.test(uri)) return uri;
  const dir = new Directory(Paths.document, 'documents');
  if (uri.startsWith(dir.uri)) return uri;
  dir.create({ idempotent: true, intermediates: true });
  const target = new File(dir, `${uid()}.${type === 'pdf' ? 'pdf' : 'jpg'}`);
  await new File(uri).copy(target);
  return target.uri;
}

export async function readDocumentBytes(uri: string): Promise<Uint8Array> {
  if (IS_WEB || uri.startsWith('data:') || uri.startsWith('blob:')) {
    const res = await fetch(uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new File(uri).bytes();
}

export const documentContentType = (type: DocumentType) => (type === 'pdf' ? 'application/pdf' : 'image/jpeg');
