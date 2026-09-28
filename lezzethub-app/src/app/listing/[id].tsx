import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeliveryIcons, ListingCard, ListingImage, categoryOf } from '../../components/domain';
import { Avatar, Badge, Button, Card, EmptyState, Header, InfoRow, LocationBadge, Notice, Row, StickyFooter } from '../../components/ui';
import { calcBreakdown } from '../../lib/commission';
import { tl } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font, radius } from '../../lib/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, me } = useStore();
  const insets = useSafeAreaInsets();
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
  const cat = categoryOf(listing.category);
  const otherDistrict = me && !isOwner && me.district !== listing.district;
  const buyerPrice = calcBreakdown(listing.price, 1).buyerTotal;
  const more = db.listings.filter((l) => l.ownerId === seller.id && l.id !== listing.id && l.status === 'active').slice(0, 3);
  const available = listing.status === 'active' && seller.active;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.maxW}>
          <View>
            <ListingImage listing={listing} height={300} />
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.roundBtn} accessibilityLabel="Geri">
                <Ionicons name="chevron-back" size={22} color={colors.ink} />
              </Pressable>
              {isOwner && (
                <Pressable onPress={() => router.push({ pathname: '/listing-form', params: { id: listing.id } })} style={styles.roundBtn} accessibilityLabel="Düzenle">
                  <Ionicons name="create-outline" size={20} color={colors.ink} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.sheet}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Badge label={`${cat.emoji} ${cat.label}`} />
              {listing.status !== 'active' && <Badge label={listing.removedByAdmin ? 'Yayından kaldırıldı' : 'Pasif'} tone="gray" icon="eye-off-outline" />}
            </Row>
            <Text style={[font.h1, { marginTop: 10 }]}>{listing.title}</Text>
            <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <Text style={styles.price}>{tl(listing.price)}</Text>
              <LocationBadge district={listing.district} neighborhood={listing.neighborhood} />
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
            </Card>

            {otherDistrict && (
              <View style={{ marginTop: 14 }}>
                <Notice
                  title="Farklı ilçedeki satıcı"
                  text={`Satıcı ${listing.district} ilçesinde, sen ${me!.district} ilçesindesin. Teslimat süresi ve kurye ücreti için sipariş sonrası satıcıyla mesajlaşabilirsin.`}
                  icon="navigate-circle-outline"
                />
              </View>
            )}

            <Text style={[font.h3, { marginTop: 22, marginBottom: 10 }]}>Satıcı</Text>
            <Card onPress={() => router.push(`/user/${seller.id}`)} style={{ padding: 14 }}>
              <Row gap={12}>
                <Avatar uri={seller.avatar} name={seller.name} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{seller.name}</Text>
                  <LocationBadge district={seller.district} neighborhood={seller.neighborhood} compact />
                  {!!seller.availability && (
                    <Text style={[font.small, { marginTop: 2 }]} numberOfLines={1}>
                      🕒 {seller.availability}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Row>
              {!!seller.bio && (
                <Text style={[font.small, { marginTop: 10, lineHeight: 18 }]} numberOfLines={3}>
                  “{seller.bio}”
                </Text>
              )}
            </Card>

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
    </View>
  );
}

const styles = StyleSheet.create({
  maxW: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,250,245,0.95)', alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -28, padding: 18 },
  price: { fontSize: 26, fontWeight: '900', color: colors.primary },
  infoDivider: { height: 1, backgroundColor: colors.line, marginHorizontal: 4 },
});
