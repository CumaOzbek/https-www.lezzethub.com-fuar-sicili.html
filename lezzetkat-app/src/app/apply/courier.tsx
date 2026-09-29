import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { DocumentUpload } from '../../components/documents';
import { ConsentCheck, LegalLink, LoginRequired, MultiDistrictPicker, ProvincePicker } from '../../components/domain';
import { useFeedback } from '../../components/feedback';
import { Badge, Button, Card, Chip, Field, Header, InfoRow, Notice, Row, Screen, StickyFooter, Toggle } from '../../components/ui';
import type { PickedDocument } from '../../lib/documents';
import { LICENSE_LABEL, VERIFICATION_LABEL } from '../../lib/format';
import { SAMPLE_LICENSE_DOC } from '../../lib/sample-docs';
import { useStore } from '../../lib/store';
import { font } from '../../lib/theme';
import type { CourierProfile, LicenseClass } from '../../lib/types';

/** Kurye başvurusu (A2/B ehliyet zorunlu) ve onay sonrası kurye paneli. */
export default function CourierApplication() {
  const { db, me } = useStore();
  const [editing, setEditing] = useState(false);

  if (!me) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Kurye Başvurusu" />
        <LoginRequired text="Kurye olmak için giriş yapmalısın." />
      </View>
    );
  }
  const profile = db.couriers.find((c) => c.userId === me.id);
  if (!editing && profile && (me.courierStatus === 'approved' || me.courierStatus === 'pending')) {
    return <CourierPanel profile={profile} onEdit={() => setEditing(true)} />;
  }
  return <CourierForm onDone={() => setEditing(false)} canCancel={editing} />;
}

function CourierPanel({ profile, onEdit }: { profile: CourierProfile; onEdit: () => void }) {
  const { me, actions } = useStore();
  const { run } = useFeedback();
  const [districts, setDistricts] = useState(profile.serviceDistricts);
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const approved = me?.courierStatus === 'approved';
  const dirty = phone !== profile.phone || districts.join('|') !== profile.serviceDistricts.join('|');

  const save = async () => {
    setSaving(true);
    await run(() => actions.updateCourierProfile({ serviceDistricts: districts, phone }), 'Kurye bilgilerin güncellendi.');
    setSaving(false);
  };

  return (
    <Screen header={<Header title="Kurye Panelim" subtitle={approved ? 'Yakınındaki kullanıcılar seni görebilir' : 'Başvurun inceleniyor'} />}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Badge label={VERIFICATION_LABEL[me!.courierStatus]} tone={approved ? 'green' : 'yellow'} icon={approved ? 'shield-checkmark' : 'time-outline'} />
          <Badge label={LICENSE_LABEL[profile.licenseClass]} tone="blue" icon={profile.vehicle === 'motorcycle' ? 'bicycle' : 'car-outline'} />
        </Row>
        <Text style={[font.body, { marginTop: 10 }]}>
          {approved
            ? 'Ehliyetin onaylandı. Hizmet verdiğin ilçelerdeki satıcı ve alıcılar Kurye Bul ekranında seni görüp telefonla arayabilir.'
            : 'Ehliyetin yönetici tarafından kontrol ediliyor. Onaylandığında kurye listesinde görüneceksin.'}
        </Text>
        <InfoRow icon="business-outline" label="Hizmet ili" value={profile.serviceProvince} />
      </Card>
      {approved && (
        <View style={{ marginTop: 14 }}>
          <Toggle
            label={profile.available ? 'Şu an müsaitim' : 'Şu an müsait değilim'}
            description={profile.available ? 'Listede “Müsait” olarak görünüyorsun.' : 'Listede görünürsün ama “Meşgul” olarak işaretlenirsin.'}
            icon="radio-outline"
            value={profile.available}
            onChange={(v) => run(() => actions.updateCourierProfile({ available: v }), v ? 'Müsait olarak görünüyorsun.' : 'Meşgul olarak işaretlendin.')}
          />
        </View>
      )}
      <Card style={{ marginTop: 4 }}>
        <MultiDistrictPicker province={profile.serviceProvince} value={districts} onChange={setDistricts} />
        <Field label="Telefon (kullanıcılara gösterilir)" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05XX XXX XX XX" />
        <Button title="Kaydet" icon="save-outline" onPress={save} loading={saving} disabled={!dirty} />
      </Card>
      <Button title="Ehliyet / başvuru bilgilerini güncelle" icon="refresh-outline" variant="ghost" onPress={onEdit} style={{ marginTop: 10 }} />
      {approved && <Button title="Kurye listesini gör" icon="people-outline" variant="outline" onPress={() => router.push('/couriers')} />}
    </Screen>
  );
}

function CourierForm({ onDone, canCancel }: { onDone: () => void; canCancel: boolean }) {
  const { db, me, actions } = useStore();
  const { run } = useFeedback();
  const previous = db.couriers.find((c) => c.userId === me!.id);
  const rejected = db.verifications.find((v) => v.userId === me!.id && v.kind === 'courier' && v.status === 'rejected');
  const [licenseClass, setLicenseClass] = useState<LicenseClass | null>(previous?.licenseClass ?? null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [doc, setDoc] = useState<PickedDocument | null>(null);
  const [phone, setPhone] = useState(previous?.phone ?? me!.phone);
  const [province, setProvince] = useState(previous?.serviceProvince ?? me!.province);
  const [districts, setDistricts] = useState<string[]>(previous?.serviceDistricts ?? [me!.district]);
  const [declaration, setDeclaration] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const ok = await run(
      () =>
        actions.submitCourierApplication({
          licenseClass: licenseClass as LicenseClass,
          licenseNumber,
          docUri: doc?.uri ?? '',
          docType: doc?.type ?? 'image',
          phone,
          serviceProvince: province,
          serviceDistricts: districts,
          acceptDocumentConsent: consent,
          acceptDeclaration: declaration,
        }),
      'Kurye başvurun alındı. Onaylandığında bildirim göndereceğiz.',
    );
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen
        header={<Header title="Kurye Başvurusu" subtitle="A2 veya B sınıfı ehliyet zorunludur" />}
        footer={
          <StickyFooter>
            <Button title="Başvuruyu Gönder" icon="send-outline" onPress={submit} loading={saving} disabled={!licenseClass || !doc || !declaration || !consent} />
          </StickyFooter>
        }
      >
        {rejected?.adminNote && (
          <View style={{ marginBottom: 12 }}>
            <Notice tone="red" icon="close-circle-outline" title="Önceki başvurun reddedildi" text={`Gerekçe: ${rejected.adminNote}`} />
          </View>
        )}
        <Card>
          <Text style={[font.h3, { marginBottom: 10 }]}>Ehliyet sınıfı *</Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {(['A2', 'B'] as LicenseClass[]).map((c) => (
              <Chip key={c} label={LICENSE_LABEL[c]} icon={c === 'A2' ? 'bicycle' : 'car-outline'} active={licenseClass === c} onPress={() => setLicenseClass(c)} />
            ))}
          </Row>
          <Text style={[font.small, { marginTop: 8, marginBottom: 12 }]}>Kuryelik için yalnızca A2 (motosiklet) veya B (otomobil) sınıfı sürücü belgesi kabul edilir.</Text>
          <Field label="Sürücü belgesi numarası *" icon="id-card-outline" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" placeholder="Belgenin ön yüzündeki numara" />
          <Field label="Telefon *" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05XX XXX XX XX" hint="Onaylandığında kurye arayan kullanıcılara gösterilir." />
        </Card>
        <View style={{ height: 14 }} />
        <DocumentUpload
          title="Ehliyet fotoğrafı"
          hint="Sürücü belgenin ön yüzünü, sınıf ve geçerlilik tarihi okunacak şekilde yükle. Kan grubu alanını kapatabilirsin."
          value={doc}
          onChange={setDoc}
          sample={SAMPLE_LICENSE_DOC}
        />
        <Card>
          <Text style={[font.h3, { marginBottom: 10 }]}>Hizmet bölgen</Text>
          <ProvincePicker
            label="Hizmet ili *"
            value={province}
            onChange={(p) => {
              if (p === province) return;
              setProvince(p);
              setDistricts([]);
            }}
          />
          <MultiDistrictPicker label="Hizmet ilçeleri *" province={province} value={districts} onChange={setDistricts} />
          <Text style={font.small}>Bu ilçelerdeki satıcı ve alıcılar seni “Kurye Bul” ekranında görür ve seninle iletişime geçebilir.</Text>
        </Card>

        <Text style={[font.h3, { marginTop: 18, marginBottom: 10 }]}>Zorunlu beyan ve onaylar</Text>
        <ConsentCheck checked={declaration} onChange={setDeclaration}>
          <LegalLink doc="courier" label="Kurye Beyanı ve Sorumluluk Taahhüdü" />’nü okudum; ehliyetimin geçerli olduğunu, trafik mevzuatına uyacağımı ve teslimatlardan doğacak sonuçlardan bizzat sorumlu olduğumu kabul ediyorum.
        </ConsentCheck>
        <ConsentCheck checked={consent} onChange={setConsent}>
          Ehliyetimin doğrulama amacıyla işlenmesine ve telefon numaramın kurye arayan kullanıcılarla paylaşılmasına <LegalLink doc="consent" label="Açık Rıza Metni" /> kapsamında açık rıza veriyorum.
        </ConsentCheck>
        {canCancel && <Button title="Vazgeç" variant="ghost" onPress={onDone} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
