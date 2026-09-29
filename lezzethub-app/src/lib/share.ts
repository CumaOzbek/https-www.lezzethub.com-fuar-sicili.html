// İlan paylaşımı: satıcılar yemeklerini WhatsApp, Instagram vb. üzerinden tanıtabilsin.
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { ApiError, uid } from './api';
import { SHARE_BASE_URL } from './config';
import { tl } from './format';
import type { Listing, User } from './types';

export const listingUrl = (listingId: string) => `${SHARE_BASE_URL}/listing/${listingId}`;

export function listingShareText(listing: Listing, seller?: Pick<User, 'name'>) {
  const desc = listing.description.length > 120 ? listing.description.slice(0, 117) + '…' : listing.description;
  return [
    `🍲 ${listing.title} — ${tl(listing.price)}`,
    `👩‍🍳 ${seller?.name ?? 'LezzetHub satıcısı'} · 📍 ${listing.neighborhood}, ${listing.district}/${listing.province}`,
    desc,
    '',
    `Ev yapımı, randevulu sipariş için LezzetHub’da: ${listingUrl(listing.id)}`,
  ].join('\n');
}

/** İlanı metin + bağlantı olarak paylaşır. Paylaşım menüsü yoksa panoya kopyalar ve 'copied' döner. */
export async function shareListing(listing: Listing, seller?: Pick<User, 'name'>): Promise<'shared' | 'copied' | 'dismissed'> {
  const message = listingShareText(listing, seller);
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: listing.title, text: message });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    await Clipboard.setStringAsync(message);
    return 'copied';
  }
  const res = await Share.share(Platform.OS === 'ios' ? { message, url: listingUrl(listing.id) } : { message, title: listing.title });
  return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
}

export const canSharePhoto = () => Platform.OS !== 'web';

/** İlanın fotoğrafını (hikâye / durum paylaşımı için) paylaşım menüsüyle paylaşır. */
export async function shareListingPhoto(listing: Listing) {
  const cover = listing.images[0];
  if (!cover) throw new ApiError('Bu ilanın fotoğrafı yok. Önce ilana fotoğraf ekle.');
  if (!(await Sharing.isAvailableAsync())) throw new ApiError('Bu cihazda fotoğraf paylaşımı desteklenmiyor.');
  let localUri = cover;
  if (/^https?:\/\//.test(cover)) {
    const file = await File.downloadFileAsync(cover, new File(Paths.cache, `lezzethub-${uid()}.jpg`));
    localUri = file.uri;
  }
  // Metni de panoya koy: Instagram/WhatsApp'ta fotoğrafın altına yapıştırılabilsin.
  await Clipboard.setStringAsync(listingShareText(listing));
  await Sharing.shareAsync(localUri, { mimeType: 'image/jpeg', dialogTitle: listing.title, UTI: 'public.jpeg' });
}
