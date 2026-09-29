import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { DocumentUpload } from '../../components/documents';
import { ConsentCheck, LegalLink, LoginRequired } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Card, Field, Header, InfoRow, Notice, Screen, StickyFooter } from '../../components/ui';
import { formatIban } from '../../lib/api';
import type { PickedDocument } from '../../lib/documents';
import { VERIFICATION_LABEL } from '../../lib/format';
import { SAMPLE_HYGIENE_DOC } from '../../lib/sample-docs';
import { useStore } from '../../lib/store';
import { font } from '../../lib/theme';

/** Satıcı başvurusu: e-Devlet onaylı hijyen belgesi + IBAN + zorunlu mevzuat beyanı ve açık rıza. */
export default function SellerApplication() {
  const { db, me, actions } = useStore();
  const { run } = useFeedback();
  const [doc, setDoc] = useState<PickedDocument | null>(null);
  const [barcode, setBarcode] = useState('');
  const [iban, setIban] = useState('');
  const [ibanHolder, setIbanHolder] = useState(me?.name ?? '');
  const [declaration, setDeclaration] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Satıcı Başvurusu" />
        <LoginRequired text="Satıcı başvurusu için giriş yapmalısın." />
      </View>
    );
  }

  const current = db.verifications.find((v) => v.userId === me.id && v.kind === 'seller');
  const status = me.sellerStatus;

  if (!editing && (status === 'approved' || status === 'pending')) {
    return (
      <Screen header={<Header title="Satıcı Başvurusu" />}>
        <Card>
          <Badge label={VERIFICATION_LABEL[status]} tone={status === 'approved' ? 'green' : 'yellow'} icon={status === 'approved' ? 'shield-checkmark' : 'time-outline'} />
          <Text style={[font.h2, { marginTop: 10 }]}>{status === 'approved' ? 'Satıcı hesabın onaylı ✅' : 'Başvurun inceleniyor'}</Text>
          <Text style={[font.body, { marginTop: 6 }]}>
            {status === 'approved'
              ? 'Hijyen belgen onaylandı. İlan verip satış yapabilirsin.'
              : 'Hijyen belgen yönetici tarafından e-Devlet üzerinden kontrol ediliyor. Sonuç bildirim olarak gelecek (genellikle 1 iş günü).'}
          </Text>
          {current && (
            <View style={{ marginTop: 10 }}>
              <InfoRow icon="barcode-outline" label="e-Devlet doğrulama no" value={current.docNumber} />
              <InfoRow icon="card-outline" label="Ödeme alınacak IBAN" value={current.iban ? `${formatIban(current.iban)} · ${current.ibanHolder}` : undefined} />
            </View>
          )}
          {status === 'approved' ? (
            <Button title="İlan Ver" icon="add-circle-outline" onPress={() => router.replace('/listing-form')} style={{ marginTop: 14 }} />
          ) : (
            <Button title="Belgeyi güncelle" icon="refresh-outline" variant="outline" onPress={() => setEditing(true)} style={{ marginTop: 14 }} />
          )}
        </Card>
      </Screen>
    );
  }

  const submit = async () => {
    setSaving(true);
    const ok = await run(
      () =>
        actions.submitSellerApplication({
          docUri: doc?.uri ?? '',
          docType: doc?.type ?? 'image',
          barcode,
          iban,
          ibanHolder,
          acceptDeclaration: declaration,
          acceptDocumentConsent: consent,
        }),
      'Başvurun alındı. Onaylandığında bildirim göndereceğiz.',
    );
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen
        header={<Header title="Satıcı Başvurusu" subtitle="Satış yapmadan önce zorunlu adımlar" />}
        footer={
          <StickyFooter>
            <Button title="Başvuruyu Gönder" icon="send-outline" onPress={submit} loading={saving} disabled={!doc || !declaration || !consent} />
          </StickyFooter>
        }
      >
        {status === 'rejected' && current?.adminNote && (
          <View style={{ marginBottom: 12 }}>
            <Notice tone="red" icon="close-circle-outline" title="Önceki başvurun reddedildi" text={`Gerekçe: ${current.adminNote}. Belgeni düzeltip yeniden gönderebilirsin.`} />
          </View>
        )}
        <Notice
          tone="teal"
          icon="shield-checkmark-outline"
          text="Tüm satıcıların e-Devlet üzerinden doğrulanabilen hijyen eğitimi belgesi yüklemesi ve mevzuat beyanını onaylaması zorunludur. Belgen onaylanana kadar ilanların yayınlanmaz."
        />
        <View style={{ height: 14 }} />
        <DocumentUpload
          title="E-Devlet onaylı hijyen belgesi"
          hint="e-Devlet → “Hijyen Eğitimi Belgesi Sorgulama” veya belgeni veren kurumun barkodlu çıktısını PDF ya da net bir fotoğraf olarak yükle."
          value={doc}
          onChange={setDoc}
          sample={SAMPLE_HYGIENE_DOC}
        />
        <Card>
          <Field
            label="e-Devlet doğrulama (barkod) numarası *"
            icon="barcode-outline"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Belgenin altındaki barkod numarası"
            autoCapitalize="characters"
            hint="Belgenin gerçekliği bu numarayla e-Devlet Belge Doğrulama üzerinden kontrol edilir."
          />
          <Field
            label="IBAN (kazancının aktarılacağı hesap) *"
            icon="card-outline"
            value={iban}
            onChangeText={(t) => setIban(t.toUpperCase())}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
          />
          <Field label="Hesap sahibinin adı soyadı *" icon="person-outline" value={ibanHolder} onChangeText={setIbanHolder} hint="IBAN kendi adına kayıtlı olmalıdır." />
        </Card>

        <Text style={[font.h3, { marginTop: 18, marginBottom: 10 }]}>Zorunlu beyan ve onaylar</Text>
        <ConsentCheck checked={declaration} onChange={setDeclaration}>
          <LegalLink doc="seller" label="Satıcı Beyanı ve Sorumluluk Taahhüdü" />’nü okudum. T.C. Sağlık Bakanlığı ve gıda mevzuatına ilişkin tüm risk ve koşulları kabul ediyor, sattığım ürünlerden doğacak tüm sonuçlardan bizzat sorumlu olduğumu beyan ediyorum.
        </ConsentCheck>
        <ConsentCheck checked={consent} onChange={setConsent}>
          Hijyen belgemin ve IBAN bilgilerimin doğrulama ve ödeme amacıyla işlenmesine <LegalLink doc="consent" label="Açık Rıza Metni" /> kapsamında açık rıza veriyorum.
        </ConsentCheck>
        {editing && <Button title="Vazgeç" variant="ghost" onPress={() => setEditing(false)} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
