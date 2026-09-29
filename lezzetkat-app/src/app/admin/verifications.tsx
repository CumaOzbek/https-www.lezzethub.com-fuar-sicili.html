import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AdminHeader } from '../../components/AdminHeader';
import { DocumentPreview } from '../../components/documents';
import { useFeedback } from '../../components/feedback';
import { Avatar, Badge, Button, Card, EmptyState, InfoRow, Notice, Row, Screen, Segmented } from '../../components/ui';
import { formatIban } from '../../lib/api';
import { LICENSE_LABEL, VERIFICATION_LABEL, chatTime } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors, font } from '../../lib/theme';
import type { Verification } from '../../lib/types';

const E_DEVLET_VERIFY_URL = 'https://www.turkiye.gov.tr/belge-dogrulama';

/** Satıcı (hijyen belgesi) ve kurye (A2/B ehliyet) başvurularının incelenmesi. */
export default function AdminVerifications() {
  const { db, me, actions } = useStore();
  const { run, confirm } = useFeedback();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [open, setOpen] = useState<string | null>(null);
  if (!me) return null;

  const list = db.verifications
    .filter((v) => (tab === 'pending' ? v.status === 'pending' : v.status !== 'pending'))
    .sort((a, b) => (tab === 'pending' ? a.submittedAt.localeCompare(b.submittedAt) : (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? '')));

  const decide = async (v: Verification, approve: boolean) => {
    const what = v.kind === 'seller' ? 'satıcı' : 'kurye';
    const r = await confirm({
      title: approve ? `${what[0]!.toLocaleUpperCase('tr-TR')}${what.slice(1)} başvurusunu onayla` : 'Başvuruyu reddet',
      message: approve
        ? v.kind === 'seller'
          ? 'Hijyen belgesini e-Devlet Belge Doğrulama’da barkod numarasıyla kontrol ettiysen onayla. Kullanıcı ilan verebilecek.'
          : 'Ehliyetin A2/B sınıfı ve geçerli olduğunu kontrol ettiysen onayla. Kullanıcı kurye listesinde görünecek.'
        : 'Gerekçe kullanıcıya bildirim olarak gönderilir.',
      confirmText: approve ? 'Onayla' : 'Reddet',
      destructive: !approve,
      inputPlaceholder: approve ? undefined : 'Red gerekçesi (zorunlu), ör. “Belge okunmuyor”',
    });
    if (r.ok) await run(() => actions.adminReviewVerification(v.id, approve, r.note), approve ? 'Başvuru onaylandı ✅' : 'Başvuru reddedildi');
  };

  return (
    <Screen header={<AdminHeader title="Başvurular" subtitle="Hijyen belgesi ve ehliyet doğrulama" />}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Bekleyen', count: db.verifications.filter((v) => v.status === 'pending').length },
          { value: 'done', label: 'Sonuçlanan', count: db.verifications.filter((v) => v.status !== 'pending').length },
        ]}
      />
      <View style={{ height: 14 }} />
      {list.length === 0 && <EmptyState emoji="📄" title={tab === 'pending' ? 'Bekleyen başvuru yok' : 'Henüz sonuçlanan başvuru yok'} />}
      {list.map((v) => {
        const u = db.users.find((x) => x.id === v.userId);
        const expanded = open === v.id || tab === 'pending';
        const courier = v.kind === 'courier' ? db.couriers.find((c) => c.userId === v.userId) : undefined;
        return (
          <Card key={v.id} style={{ marginBottom: 14 }}>
            <Row gap={12}>
              <Avatar uri={u?.avatar} name={u?.name ?? '?'} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={font.h3} numberOfLines={1}>
                  {u?.name ?? 'Silinmiş kullanıcı'}
                </Text>
                <Text style={font.small} numberOfLines={1}>
                  {u ? `${u.neighborhood}, ${u.district}/${u.province}` : ''} · {chatTime(v.submittedAt)}
                </Text>
              </View>
              <Badge label={v.kind === 'seller' ? 'Satıcı' : 'Kurye'} tone={v.kind === 'seller' ? 'orange' : 'blue'} icon={v.kind === 'seller' ? 'storefront-outline' : 'bicycle-outline'} />
            </Row>
            {tab === 'done' && (
              <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
                <Badge label={VERIFICATION_LABEL[v.status]} tone={v.status === 'approved' ? 'green' : 'red'} />
                <Button title={expanded ? 'Gizle' : 'Detay'} variant="ghost" small onPress={() => setOpen(expanded ? null : v.id)} />
              </Row>
            )}
            {expanded && (
              <>
                <View style={{ marginTop: 10 }}>
                  <DocumentPreview verification={v} />
                </View>
                <View style={{ marginTop: 8 }}>
                  {v.kind === 'seller' ? (
                    <>
                      <InfoRow icon="barcode-outline" label="e-Devlet doğrulama (barkod) no" value={v.docNumber} />
                      <InfoRow icon="business-outline" label="Gıda işletmesi kayıt no" value={v.foodRegistrationNo} />
                      <InfoRow icon="card-outline" label="IBAN" value={v.iban ? `${formatIban(v.iban)} · ${v.ibanHolder}` : undefined} />
                    </>
                  ) : (
                    <>
                      <InfoRow icon="id-card-outline" label="Ehliyet sınıfı / no" value={`${v.licenseClass ? LICENSE_LABEL[v.licenseClass] : '—'} · ${v.docNumber}`} />
                      <InfoRow icon="navigate-outline" label="Hizmet bölgesi" value={courier ? `${courier.serviceProvince}: ${courier.serviceDistricts.join(', ')}` : undefined} />
                      <InfoRow icon="call-outline" label="Telefon" value={courier?.phone} />
                    </>
                  )}
                  <InfoRow
                    icon="checkbox-outline"
                    label="Onaylar"
                    value={`Beyan: ${v.declarationAt ? chatTime(v.declarationAt) : '—'} · Açık rıza: ${chatTime(v.documentConsentAt)}${u?.kvkkConsentAt ? ' · KVKK kayıt onayı var' : ''}`}
                  />
                  {!!v.adminNote && <InfoRow icon="chatbox-ellipses-outline" label="Yönetici notu" value={v.adminNote} />}
                </View>
                {v.status === 'pending' && (
                  <>
                    {v.kind === 'seller' && (
                      <View style={{ marginTop: 6 }}>
                        <Notice tone="teal" icon="shield-checkmark-outline" text="Barkod numarasını e-Devlet Belge Doğrulama hizmetinde sorgula, belgedeki ad soyadın kullanıcıyla eşleştiğini ve gıda işletmesi kayıt numarasının İl/İlçe Tarım ve Orman Müdürlüğü kaydıyla uyumlu olduğunu kontrol et." />
                        <Button title="e-Devlet Belge Doğrulama’yı aç" icon="open-outline" variant="ghost" small onPress={() => WebBrowser.openBrowserAsync(E_DEVLET_VERIFY_URL)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
                      </View>
                    )}
                    <Row gap={10} style={{ marginTop: 12 }}>
                      <Button title="Reddet" icon="close" variant="danger" style={{ flex: 1 }} onPress={() => decide(v, false)} />
                      <Button title="Onayla" icon="checkmark" variant="success" style={{ flex: 2 }} onPress={() => decide(v, true)} />
                    </Row>
                  </>
                )}
              </>
            )}
          </Card>
        );
      })}
      <Text style={[font.tiny, { textAlign: 'center', color: colors.muted }]}>Belgeler özel depoda tutulur; yalnızca başvuru sahibi ve yöneticiler görebilir.</Text>
    </Screen>
  );
}
