import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeliveryIcons, ListingCard, categoryOf } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { PhotoCarousel } from '../../components/photos';
import { ReportSheet } from '../../components/ReportSheet';
import { Avatar, Badge, Button, Card, EmptyState, Header, InfoRow, LocationBadge, Notice, Row, StickyFooter } from '../../components/ui';
import { calcBreakdown } from '../../lib/commission';
import { DELIVERY_LABEL, SHIPPING_PAYER_LABEL, shippingPayerText, tl } from '../../lib/format';
import { canSharePhoto, shareListing, shareListingPhoto } from '../../lib/share';
import { useBlockedIds, useStore } from '../../lib/store';
import { colors, font, radius, shadowSoft } from '../../lib/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me } = useStore();
  const { run, toast } = useFeedback();
  const blocked = useBlockedIds();
  const insets = useSafeAreaInsets();
  const [reporting, setReporting] = useState(false);
  const listing = db.listings.find((l) => l.id === id);
  const seller = listing && db.users.find((u) => u.id === listing.ownerId);

  if (!listing || !seller) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <Header title="İlan" />
        <EmptyState emoji="🔎" title="İlan bulunamadı" text="Bu ilan kaldırılmış olabilir." action="Keşfet’e dön" onAction={() => router.replace('/')} />
      </View>
    );
  }

  const isOwner = me?.id === seller.id;
  const isAdmin = me?.role === 'admin';
  const isBlocked = blocked.has(seller.id);
  const cat = categoryOf(listing.category);
  const otherProvince = !!me && !isOwner && me.province !== listing.province;
  const otherDistrict = !!me && !isOwner && !otherProvince && me.district !== listing.district;
  const ships = listing.delivery.filter((d) => d !== 'pickup');
  const buyerPrice = calcBreakdown(listing.price, 1).buyerTotal;
  const more = db.listings.filter((l) => l.ownerId === seller.id && l.id !== listing.id && l.status === 'active').slice(0, 3);
  const available = listing.status === 'active' && seller.active && !isBlocked;
  const completedSales = db.orders.filter((o) => o.sellerId === seller.id && o.status === 'completed').length;

  const share = () =>
    run(async () => {
      const r = await shareListing(listing, seller);
      if (r === 'copied') toast('İlan bağlantısı panoya kopyalandı', 'success');
    });
  const sharePhoto = () => run(() => shareListingPhoto(listing), undefined);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.maxW}>
          <View>
            <PhotoCarousel listing={listing} height={320} />
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.roundBtn} accessibilityLabel="Geri">
                <Ionicons name="chevron-back" size={22} color={colors.ink} />
              </Pressable>
              <Row gap={8}>
                <Pressable onPress={share} style={styles.roundBtn} accessibilityLabel="Paylaş">
                  <Ionicons name="share-social-outline" size={20} color={colors.ink} />
                </Pressable>
                {isOwner ? (
                  <Pressable onPress={() => router.push({ pathname: '/listing-form', params: { id: listing.id } })} style={styles.roundBtn} accessibilityLabel="Düzenle">
                    <Ionicons name="create-outline" size={20} color={colors.ink} />
                  </Pressable>
                ) : (
                  me &&
                  !isAdmin && (
                    <Pressable onPress={() => setReporting(true)} style={styles.roundBtn} accessibilityLabel="Şikayet et">
                      <Ionicons name="flag-outline" size={19} color={colors.ink} />
                    </Pressable>
                  )
                )}
              </Row>
            </View>
          </View>

          <View style={styles.sheet}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Badge label={`${cat.emoji} ${cat.label}`} tone="teal" />
              {listing.status !== 'active' && <Badge label={listing.removedByAdmin ? 'Yayından kaldırıldı' : 'Pasif'} tone="gray" icon="eye-off-outline" />}
            </Row>
            <Text style={[font.h1, { marginTop: 10 }]}>{listing.title}</Text>
            <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <Text style={styles.price}>{tl(listing.price)}</Text>
              <LocationBadge province={listing.province} district={listing.district} neighborhood={listing.neighborhood} />
            </Row>
            <Text style={[font.body, { marginTop: 14 }]}>{listing.description}</Text>

            <Card style={{ marginTop: 18, padding: 12 }}>
              <InfoRow icon="time-outline" label="Müsaitlik / hazırlanma süresi" value={listing.prepTime} />
              <View style={styles.infoDivider} />
              <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, alignItems: 'center' }}>
                <Ionicons name="cube-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={font.tiny}>Teslimat seçenekleri</Text>
                  <View style={{ marginTop: 4 }}>
                    <DeliveryIcons delivery={listing.delivery} labels />
                  </View>
                </View>
              </View>
              {ships.length > 0 && (
                <>
                  <View style={styles.infoDivider} />
                  <InfoRow
                    icon={listing.shippingPayer === 'seller' ? 'gift-outline' : 'wallet-outline'}
                    label={`${ships.map((d) => DELIVERY_LABEL[d]).join(' / ')} ücreti · ${SHIPPING_PAYER_LABEL[listing.shippingPayer]}`}
                    value={shippingPayerText(ships.includes('cargo') ? 'cargo' : 'courier', listing.shippingPayer)}
                  />
                </>
              )}
              <View style={styles.infoDivider} />
              <InfoRow icon="shield-checkmark-outline" label="Satıcı doğrulaması" value="E-Devlet onaylı hijyen belgesi LezzetHub tarafından kontrol edildi" />
            </Card>

            {isOwner && (
              <Card style={[styles.promo]}>
                <Row gap={10} style={{ alignItems: 'flex-start' }}>
                  <View style={styles.promoIcon}>
                    <Ionicons name="megaphone-outline" size={20} color={colors.accentDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={font.h3}>İlanını tanıt</Text>
                    <Text style={[font.small, { marginTop: 2, lineHeight: 18 }]}>
                      WhatsApp gruplarında, durumunda veya Instagram hikâyende paylaş; komşuların tek dokunuşla sipariş versin.
                    </Text>
                  </View>
                </Row>
                <Row gap={8} style={{ marginTop: 12 }}>
                  <Button title="Bağlantıyı paylaş" icon="share-social-outline" small onPress={share} style={{ flex: 1 }} />
                  {canSharePhoto() && listing.images.length > 0 && (
                    <Button title="Fotoğrafı paylaş" icon="image-outline" variant="secondary" small onPress={sharePhoto} style={{ flex: 1 }} />
                  )}
                </Row>
                {listing.images.length === 0 && (
                  <Text style={[font.tiny, { marginTop: 8 }]}>İpucu: İlanına yemeğinin fotoğrafını ekle; fotoğraflı ilanlar daha çok sipariş alır.</Text>
                )}
              </Card>
            )}

            {otherProvince && (
              <View style={{ marginTop: 14 }}>
                <Notice
                  title="Farklı ildeki satıcı"
                  text={
                    listing.delivery.includes('cargo')
                      ? `Satıcı ${listing.province} ilinde. Bu ilan kargoyla ${me!.province} iline gönderilebilir.`
                      : `Satıcı ${listing.province} ilinde ve kargo ile gönderim yapmıyor. Yalnızca elden teslim veya yerel kurye ile alınabilir.`
                  }
                  icon="navigate-circle-outline"
                />
              </View>
            )}
            {otherDistrict && (
              <View style={{ marginTop: 14 }}>
                <Notice
                  title="Farklı ilçedeki satıcı"
                  text={`Satıcı ${listing.district} ilçesinde, sen ${me!.district} ilçesindesin. Teslimat süresi ve kurye ücreti için sipariş sonrası satıcıyla mesajlaşabilirsin.`}
                  icon="navigate-circle-outline"
                />
              </View>
            )}
            {isBlocked && (
              <View style={{ marginTop: 14 }}>
                <Notice tone="gray" icon="ban-outline" title="Bu satıcıyı engelledin" text="Engeli Profil → Engellenen kullanıcılar bölümünden kaldırabilirsin." />
              </View>
            )}

            <Text style={[font.h3, { marginTop: 22, marginBottom: 10 }]}>Satıcı</Text>
            <Card onPress={() => router.push(`/user/${seller.id}`)} style={{ padding: 14 }}>
              <Row gap={12}>
                <Avatar uri={seller.avatar} name={seller.name} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{seller.name}</Text>
                  <LocationBadge province={seller.province} district={seller.district} neighborhood={seller.neighborhood} compact />
                  {!!seller.availability && (
                    <Text style={[font.small, { marginTop: 2 }]} numberOfLines={1}>
                      🕒 {seller.availability}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Row>
              {completedSales > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Badge label={`${completedSales} tamamlanmış sipariş`} tone="green" icon="checkmark-done" />
                </View>
              )}
              {!!seller.bio && (
                <Text style={[font.small, { marginTop: 10, lineHeight: 18 }]} numberOfLines={3}>
                  “{seller.bio}”
                </Text>
              )}
            </Card>

            <View style={styles.trust}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.inkSoft, fontSize: 13, lineHeight: 18 }}>
                Ödemen yönetici onayıyla kesinleşir ve satıcıya ancak sipariş onaylandıktan sonra ödeme adımına geçilir.
              </Text>
            </View>

            {more.length > 0 && (
              <>
                <Text style={[font.h3, { marginTop: 22, marginBottom: 10 }]}>Satıcının diğer ilanları</Text>
                {more.map((l) => (
                  <ListingCard key={l.id} listing={l} compact />
                ))}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {!isAdmin && (
        <StickyFooter>
          {isOwner ? (
            <Button title="İlanı Düzenle" icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/listing-form', params: { id: listing.id } })} />
          ) : (
            <Row gap={12}>
              <View>
                <Text style={font.tiny}>Hizmet bedeli dahil</Text>
                <Text style={{ fontWeight: '900', fontSize: 18, color: colors.ink }}>{tl(buyerPrice)}</Text>
              </View>
              <Button
                title={available ? 'Randevulu Sipariş Ver' : 'Şu an sipariş alınmıyor'}
                icon="calendar-outline"
                disabled={!available}
                style={{ flex: 1 }}
                onPress={() => router.push(me ? { pathname: '/order/new', params: { listingId: listing.id } } : '/login')}
              />
            </Row>
          )}
        </StickyFooter>
      )}

      {me && !isOwner && (
        <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="listing" targetId={listing.id} userId={seller.id} userName={seller.name} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  maxW: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(250,247,242,0.95)', alignItems: 'center', justifyContent: 'center', ...shadowSoft },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -28, padding: 18 },
  price: { fontSize: 26, fontWeight: '900', color: colors.accentDark },
  infoDivider: { height: 1, backgroundColor: colors.line, marginHorizontal: 4 },
  promo: { marginTop: 14, padding: 14, backgroundColor: colors.accentSoft },
  promoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  trust: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft },
});
