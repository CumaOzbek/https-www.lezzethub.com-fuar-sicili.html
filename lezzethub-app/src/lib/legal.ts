// Gizlilik politikası ve kullanım koşulları.
// ÖNEMLİ: Bu metinler bir başlangıç şablonudur. Yayından önce [köşeli parantez] içindeki alanları
// doldurun ve metinleri bir hukuk danışmanına kontrol ettirin.
import { SUPPORT_EMAIL } from './config';

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

const CONTROLLER = '[Şirket unvanı / işletme sahibi adı], [adres], Hatay';

export const LEGAL_DOCS: Record<'privacy' | 'terms', LegalDoc> = {
  privacy: {
    title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
    updated: '28 Eylül 2026',
    sections: [
      {
        heading: '1. Veri sorumlusu',
        body: `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu ${CONTROLLER}’dır. Sorularınız ve başvurularınız için: ${SUPPORT_EMAIL}`,
      },
      {
        heading: '2. İşlenen kişisel veriler',
        body:
          '• Kimlik ve iletişim: ad soyad, e-posta adresi.\n' +
          '• Konum: ilçe, mahalle ve (isteğe bağlı) açık adres.\n' +
          '• Profil: fotoğraf, kısa tanıtım, müsaitlik bilgisi.\n' +
          '• İlan içerikleri: yemek fotoğrafları, açıklamalar, fiyatlar.\n' +
          '• İşlem bilgileri: siparişler, randevular, ödeme onay kayıtları, uygulama içi mesajlar.\n' +
          '• Teknik veriler: oturum bilgileri ve hata kayıtları.\n' +
          'Uygulama kart bilgisi toplamaz; uygulama içinde ödeme alınmaz.',
      },
      {
        heading: '3. İşleme amaçları ve hukuki sebepler',
        body:
          'Verileriniz; hesabınızı oluşturmak ve yönetmek, alıcı ile satıcıyı ilçe ve mahalle bazında buluşturmak, siparişleri ve randevuları yürütmek, ödeme onaylarını kaydetmek, taraflar arası mesajlaşmayı sağlamak, güvenliği ve kötüye kullanımın önlenmesini sağlamak, yasal yükümlülükleri yerine getirmek amacıyla işlenir. ' +
          'Hukuki sebepler: sözleşmenin kurulması ve ifası (KVKK m.5/2-c), hukuki yükümlülük (m.5/2-ç), meşru menfaat (m.5/2-f) ve gerektiğinde açık rızanızdır.',
      },
      {
        heading: '4. Kimler görebilir?',
        body:
          '• Adınız, profil fotoğrafınız, ilçe/mahalleniz ve ilanlarınız herkese açıktır.\n' +
          '• E-posta adresiniz ve açık adresiniz herkese açık değildir.\n' +
          '• Açık adresiniz yalnızca ilgili siparişin karşı tarafıyla paylaşılır: kurye siparişinde alıcının adresi satıcıya; elden teslimde satıcının adresi, satıcı siparişi onayladıktan sonra alıcıya gösterilir.\n' +
          '• Mesajlar yalnızca siparişin alıcısı ve satıcısı tarafından görülebilir.',
      },
      {
        heading: '5. Aktarım ve saklama',
        body:
          'Veriler, altyapı hizmeti aldığımız bulut sağlayıcısının (Supabase) sunucularında saklanır; bu sunucular yurt dışında bulunabilir. Yurt dışına aktarım KVKK m.9’a uygun olarak yapılır. ' +
          'Verileriniz hesabınız açık olduğu sürece ve yasal saklama süreleri boyunca tutulur. Hesabınızı sildiğinizde profiliniz, ilanlarınız ve bildirimleriniz silinir; karşı tarafın kayıtlarında bulunan geçmiş siparişler, kimliğiniz kaldırılarak saklanabilir.',
      },
      {
        heading: '6. Haklarınız',
        body:
          'KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. ' +
          `Hesabınızı uygulamada Profil → Hesabımı Sil adımıyla dilediğiniz an silebilirsiniz. Diğer talepler için ${SUPPORT_EMAIL} adresine yazabilirsiniz.`,
      },
      {
        heading: '7. Çocuklar',
        body: 'LezzetHub 18 yaşından küçüklere yönelik değildir. 18 yaşından küçükseniz uygulamayı kullanmayın.',
      },
    ],
  },
  terms: {
    title: 'Kullanım Koşulları',
    updated: '28 Eylül 2026',
    sections: [
      {
        heading: '1. Hizmetin tanımı',
        body: `LezzetHub, Hatay ilinde ev yemeği hazırlayan satıcılarla alıcıları buluşturan bir aracı platformdur. Platformu ${CONTROLLER} işletir. LezzetHub yemeklerin hazırlayıcısı veya satıcısı değildir.`,
      },
      {
        heading: '2. Üyelik',
        body: 'Üye olmak için 18 yaşını doldurmuş olmanız ve doğru bilgi vermeniz gerekir. Hesabınızın güvenliğinden siz sorumlusunuz.',
      },
      {
        heading: '3. Satıcıların sorumlulukları',
        body:
          '• Yemekleri hijyen kurallarına ve gıda mevzuatına uygun hazırlamak.\n' +
          '• İlan açıklamasında içerik ve alerjenleri doğru belirtmek.\n' +
          '• İlan fotoğraflarının kendi hazırladığı yemeğe ait ve gerçeği yansıtır olması.\n' +
          '• Kendi vergi ve yasal yükümlülüklerini yerine getirmek.',
      },
      {
        heading: '4. Sipariş, ödeme ve hizmet bedeli',
        body:
          'Siparişler randevuludur ve satıcı onayıyla kesinleşir. Uygulama içinde doğrudan ödeme alınmaz; ödeme adımı platform yöneticisinin onayıyla işaretlenir. ' +
          'Alıcıdan ürün tutarının %10’u, satıcıdan %15’i hizmet bedeli olarak alınır; tutarlar sipariş ekranında satır satır gösterilir. İptal ve iade koşulları sipariş aşamasına göre taraflarca ve platform desteğiyle çözülür.',
      },
      {
        heading: '5. Yasak içerik ve davranışlar',
        body:
          'Hakaret, taciz, nefret söylemi, müstehcenlik, yanıltıcı veya başkasına ait fotoğraf, dolandırıcılık ve yasa dışı ürün satışı kesinlikle yasaktır; bu tür içeriklere karşı sıfır tolerans uygulanır. ' +
          'Uygunsuz ilan veya kullanıcıları uygulamadaki “Şikayet et” özelliğiyle bildirebilir, kullanıcıları engelleyebilirsiniz. Şikayetler en geç 24 saat içinde incelenir; kuralları ihlal eden içerikler kaldırılır ve hesaplar kapatılabilir.',
      },
      {
        heading: '6. Sorumluluğun sınırı',
        body: 'LezzetHub, satıcıların hazırladığı yemeklerin içeriğinden, kalitesinden ve teslimatından doğrudan sorumlu değildir; ancak şikayetleri inceler ve gerekli önlemleri alır.',
      },
      {
        heading: '7. Değişiklikler ve iletişim',
        body: `Koşullar güncellenebilir; önemli değişiklikler uygulamada duyurulur. İletişim: ${SUPPORT_EMAIL}. Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır ve Hatay mahkemeleri yetkilidir.`,
      },
    ],
  },
};
