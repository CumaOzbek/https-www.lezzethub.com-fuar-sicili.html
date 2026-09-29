// Aydınlatma metni, açık rıza, kullanım koşulları, satıcı/kurye beyanları ve mesafeli satış metni.
// ÖNEMLİ: Bu metinler bir başlangıç şablonudur. Yayından önce [köşeli parantez] içindeki alanları
// doldurun ve metinleri mutlaka bir hukuk danışmanına kontrol ettirin.
import { SUPPORT_EMAIL } from './config';
import { ALLERGENS, PROHIBITED_FOODS } from './types';

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

export type LegalKey = 'privacy' | 'consent' | 'terms' | 'seller' | 'courier' | 'sales' | 'food';

const ALLERGEN_LIST = ALLERGENS.map((a) => '• ' + a.label).join('\n');
const PROHIBITED_LIST = PROHIBITED_FOODS.map((p) => '• ' + p).join('\n');

const CONTROLLER = '[Şirket unvanı], [MERSİS no], [adres]';
const UPDATED = '28 Eylül 2026';

export const LEGAL_DOCS: Record<LegalKey, LegalDoc> = {
  privacy: {
    title: 'KVKK Aydınlatma Metni ve Gizlilik Politikası',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Veri sorumlusu',
        body: `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu ${CONTROLLER}’dır. Başvurularınız için: ${SUPPORT_EMAIL}`,
      },
      {
        heading: '2. İşlenen kişisel veriler',
        body:
          '• Kimlik ve iletişim: ad soyad, e-posta, telefon.\n' +
          '• Konum: il, ilçe, mahalle ve açık adres.\n' +
          '• Satıcılar için: hijyen eğitimi belgesi ve e-Devlet doğrulama numarası, gıda işletmesi kayıt numarası, IBAN ve hesap sahibi adı.\n' +
          '• Kuryeler için: sürücü belgesi (A2/B) görüntüsü ve belge numarası, hizmet bölgesi, telefon.\n' +
          '• İlan içerikleri: yemek fotoğrafları, açıklamalar, fiyatlar.\n' +
          '• İşlem bilgileri: siparişler, randevular, ödeme kayıtları (kartın yalnızca son 4 hanesi), kargo takip bilgisi, uygulama içi mesajlar.\n' +
          '• Onay kayıtları: koşulların, açık rızanın ve beyanların kabul edildiği tarih.\n' +
          '• Teknik veriler: oturum bilgileri, IP adresi ve hata kayıtları.',
      },
      {
        heading: '3. İşleme amaçları ve hukuki sebepler',
        body:
          'Verileriniz; üyeliğin kurulması ve yönetimi, alıcı–satıcı–kurye eşleştirmesi, siparişlerin, online ödemelerin, iadelerin ve satıcı ödemelerinin yürütülmesi, satıcı ve kurye belgelerinin doğrulanması, taraflar arası mesajlaşma, güvenlik ve kötüye kullanımın önlenmesi ile yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir. ' +
          'Hukuki sebepler: sözleşmenin kurulması ve ifası (KVKK m.5/2-c), hukuki yükümlülük (m.5/2-ç), bir hakkın tesisi ve korunması (m.5/2-e), meşru menfaat (m.5/2-f) ve Açık Rıza Metni’nde belirtilen işlemler için açık rızanızdır.',
      },
      {
        heading: '4. Kimler görebilir?',
        body:
          '• Adınız, profil fotoğrafınız, il/ilçe/mahalleniz ve ilanlarınız herkese açıktır.\n' +
          '• E-posta, telefon ve açık adresiniz herkese açık değildir; yalnızca ilgili siparişin karşı tarafıyla paylaşılır.\n' +
          '• Onaylı kuryelerin adı, araç türü, hizmet ilçeleri ve telefonu, kurye arayan giriş yapmış kullanıcılara gösterilir.\n' +
          '• Hijyen belgesi, ehliyet ve IBAN bilgileri yalnızca sizin ve platform yöneticilerinin erişebildiği özel depoda tutulur.\n' +
          '• Mesajlar yalnızca siparişin alıcısı ve satıcısı tarafından görülebilir.',
      },
      {
        heading: '5. Aktarım ve saklama',
        body:
          'Pilot dönemde ödemeler uygulama üzerinden alınmaz. Online ödeme açıldığında kart bilgileriniz uygulamaya girilmez; ödeme, lisanslı ödeme kuruluşu iyzico’nun güvenli ödeme sayfasında alınır ve kart verisi platformda saklanmaz. ' +
          'Veriler altyapı sağlayıcımızın (Supabase) sunucularında saklanır; bu sunucular yurt dışında bulunabilir ve aktarım KVKK m.9’a uygun olarak yapılır. ' +
          'Verileriniz üyelik süresince ve ilgili mevzuattaki saklama süreleri (ör. ticari kayıtlar için 10 yıl) boyunca tutulur; süre sonunda silinir, yok edilir veya anonim hale getirilir.',
      },
      {
        heading: '6. Haklarınız',
        body:
          'KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, aktarıldığı üçüncü kişileri bilme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Açık rızanızı dilediğiniz an geri alabilirsiniz; bu durumda açık rızaya dayalı hizmetler (ör. satıcı veya kurye hesabı) sona erer. ' +
          `Hesabınızı Profil → Hesabımı Sil adımıyla silebilirsiniz. Diğer talepler için ${SUPPORT_EMAIL} adresine yazabilirsiniz.`,
      },
      {
        heading: '7. Çocuklar',
        body: 'LezzetHub 18 yaşından küçüklere yönelik değildir.',
      },
    ],
  },
  consent: {
    title: 'Kişisel Verilerin İşlenmesine İlişkin Açık Rıza Metni',
    updated: UPDATED,
    sections: [
      {
        heading: 'Açık rıza verdiğim işlemler',
        body:
          'KVKK Aydınlatma Metni’ni okudum. Aşağıdaki işlemler için özgür irademle açık rıza veriyorum:\n\n' +
          '• Kişisel verilerimin, altyapı hizmeti alınan bulut sağlayıcısının yurt dışındaki sunucularında saklanması ve bu amaçla yurt dışına aktarılması.\n' +
          '• Konum bilgimin (il, ilçe, mahalle) yakınımdaki alıcı, satıcı ve kuryelerle eşleşme amacıyla kullanılması.\n' +
          '• Satıcı olursam: hijyen eğitimi belgemin ve IBAN bilgilerimin doğrulama ve ödeme amacıyla işlenmesi.\n' +
          '• Kurye olursam: sürücü belgemin doğrulama amacıyla işlenmesi ve telefon numaramın kurye arayan kullanıcılarla paylaşılması.',
      },
      {
        heading: 'Önemli bilgi',
        body:
          'Sürücü belgesinde kan grubu gibi özel nitelikli kişisel veri bulunabilir. Yüklemeden önce bu alanı kapatabilirsiniz; doğrulama için sınıf, belge numarası ve geçerlilik tarihinin okunabilmesi yeterlidir. ' +
          'Açık rızanızı dilediğiniz an geri alabilirsiniz. Geri alma, geri alma tarihinden önceki işlemleri etkilemez.',
      },
    ],
  },
  terms: {
    title: 'Kullanım Koşulları',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Hizmetin tanımı',
        body: `LezzetHub, Türkiye genelinde ev yemeği hazırlayan satıcılarla alıcıları ve bağımsız kuryeleri buluşturan bir aracı hizmet sağlayıcıdır. Platformu ${CONTROLLER} işletir. LezzetHub yemeklerin üreticisi veya satıcısı değildir; satış sözleşmesi alıcı ile satıcı arasında kurulur.`,
      },
      {
        heading: '2. Üyelik',
        body:
          'Üye olmak için 18 yaşını doldurmuş olmanız, doğru bilgi vermeniz, Kullanım Koşulları’nı ve Aydınlatma Metni’ni kabul etmeniz ve Açık Rıza Metni’ne onay vermeniz gerekir. Hesabınızın güvenliğinden siz sorumlusunuz.',
      },
      {
        heading: '3. Satıcılar',
        body:
          'Satış yapmak için e-Devlet üzerinden doğrulanabilir hijyen eğitimi belgesinin yüklenmesi, Tarım ve Orman Bakanlığı gıda işletmesi kayıt numarasının beyan edilmesi, Satıcı Beyanı ve Sorumluluk Taahhüdü’nün onaylanması ve belgenin platform tarafından onaylanması zorunludur. Her ilanda alerjenler, son tüketim/saklama bilgisi ve yasaklı ürün içermediği beyanı zorunludur. Satıcı; gıda güvenliği, hijyen, etiketleme, alerjen bildirimi, vergi ve diğer yasal yükümlülüklerden bizzat sorumludur.',
      },
      {
        heading: '4. Kuryeler',
        body:
          'Kurye olarak listelenmek için geçerli A2 veya B sınıfı sürücü belgesinin yüklenmesi ve Kurye Beyanı’nın onaylanması zorunludur. Kuryeler LezzetHub’ın çalışanı değildir; teslimat ücreti ve koşulları kurye ile onu arayan kullanıcı arasında belirlenir.',
      },
      {
        heading: '5. Sipariş, teslimat ve ödeme',
        body:
          'Siparişler randevuludur ve satıcının onayıyla kesinleşir. Siparişin ödeme yöntemi sipariş ekranında gösterilir:\n' +
          '• Teslimatta ödeme (pilot dönem): Ödeme uygulama üzerinden alınmaz; alıcı ürün bedelini teslimatta doğrudan satıcıya (nakit veya IBAN) öder. LezzetHub ödemeye aracılık etmez, parayı tahsil etmez ve bu dönemde hizmet bedeli almaz. Ödemeye ilişkin uyuşmazlıklar taraflar arasındadır; LezzetHub şikayetleri inceleyip gerekli önlemleri (ilan kaldırma, hesap kapatma) alır.\n' +
          '• Online ödeme (ileride): Ödeme, lisanslı ödeme kuruluşu iyzico’nun güvenli ödeme sayfasında kartla alınır; alıcıdan ürün tutarının %10’u, satıcıdan %15’i hizmet bedeli alınır ve satıcının net kazancı sipariş tamamlandıktan sonra IBAN’ına aktarılır. Online ödemeye geçiş en az 30 gün önce duyurulur.\n' +
          'Teslimat elden, kurye veya kargo ile yapılır. Kurye/kargo ücretini ilanda belirtildiği gibi alıcı veya satıcı üstlenir. İptal ve iadeler Mesafeli Satış Sözleşmesi’ndeki koşullara göre yapılır.',
      },
      {
        heading: '6. Yasaklı ürünler ve hijyen şikayetleri',
        body:
          'Gıda Güvenliği Kuralları’nda listelenen yüksek riskli ürünlerin satışı yasaktır; kargo yalnızca oda sıcaklığında dayanıklı ürünlerde kullanılabilir. ' +
          'Bir ilan hakkında ürünü satın almış bir alıcıdan veya iki farklı kullanıcıdan hijyen / gıda güvenliği şikayeti geldiğinde ilan inceleme tamamlanana kadar otomatik olarak yayından kaldırılır. Gerekli görülen durumlarda yetkili makamlara (ALO 174 Gıda Hattı, İl Tarım ve Orman Müdürlüğü) bildirim yapılır.',
      },
      {
        heading: '7. Yasak içerik ve davranışlar',
        body:
          'Hakaret, taciz, nefret söylemi, müstehcenlik, yanıltıcı veya başkasına ait fotoğraf, sahte belge, dolandırıcılık ve yasa dışı ürün satışı yasaktır; bu tür içeriklere karşı sıfır tolerans uygulanır. ' +
          'Uygunsuz ilan veya kullanıcıları “Şikayet et” özelliğiyle bildirebilir, kullanıcıları engelleyebilirsiniz. Şikayetler en geç 24 saat içinde incelenir; ihlal eden içerikler kaldırılır, hesaplar kapatılabilir ve gerektiğinde yetkili makamlara bildirilir.',
      },
      {
        heading: '8. Sorumluluğun sınırı',
        body:
          'LezzetHub, satıcıların hazırladığı yemeklerin içeriğinden, hijyeninden ve kalitesinden, kuryelerin ve kargo firmalarının teslimat hizmetinden doğrudan sorumlu değildir. Belge onayı, belgenin görünür bilgilerinin kontrolünden ibarettir ve satıcının veya kuryenin yasal yükümlülüklerini ortadan kaldırmaz.',
      },
      {
        heading: '9. Değişiklikler ve iletişim',
        body: `Koşullar güncellenebilir; önemli değişiklikler uygulamada duyurulur. İletişim: ${SUPPORT_EMAIL}. Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır; tüketiciler Tüketici Hakem Heyetleri ve Tüketici Mahkemelerine başvurabilir.`,
      },
    ],
  },
  seller: {
    title: 'Satıcı Beyanı ve Sorumluluk Taahhüdü',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Belge beyanı',
        body:
          'Yüklediğim hijyen eğitimi belgesinin ve beyan ettiğim gıda işletmesi kayıt numarasının bana ait, gerçek ve geçerli olduğunu; belgenin veya kaydın iptal edilmesi ya da süresinin dolması halinde satışı durdurup platformu derhal bilgilendireceğimi beyan ederim. Sahte veya başkasına ait belge ya da numara kullanmanın hukuki ve cezai sonuçlarından bizzat sorumluyum.',
      },
      {
        heading: '2. Mevzuata uyum',
        body:
          'T.C. Sağlık Bakanlığı’nın hijyen ve halk sağlığına ilişkin mevzuatını (Hijyen Eğitimi Yönetmeliği dahil) ve gıda üretimi, satışı ve denetimine ilişkin mevzuatı (5996 sayılı Kanun, Türk Gıda Kodeksi ve Tarım ve Orman Bakanlığı düzenlemeleri) bildiğimi; gerekli kayıt, izin ve bildirimleri yapmanın kendi sorumluluğumda olduğunu kabul ederim.',
      },
      {
        heading: '3. Riskler ve koşullar',
        body:
          'Ev ortamında hazırlanan gıdaların; bozulma, çapraz bulaşma, alerjen, yanlış saklama ve taşıma gibi sağlık riskleri taşıdığını biliyorum. Yemekleri hijyen kurallarına uygun hazırlayacağımı, içerik ve alerjenleri ilanda eksiksiz ve doğru belirteceğimi, soğuk zinciri ve uygun ambalajı sağlayacağımı, son tüketim ve saklama bilgisini alıcıya bildireceğimi, Gıda Güvenliği Kuralları’ndaki yasaklı ürünleri satmayacağımı ve soğuk zincir gerektiren ürünleri kargoyla göndermeyeceğimi taahhüt ederim. Hijyen şikayeti halinde ilanımın incelemeye alınabileceğini ve yetkili makamlara bildirilebileceğini kabul ederim.',
      },
      {
        heading: '4. Sorumluluk',
        body:
          'Sattığım ürünlerin neden olabileceği her türlü sağlık sorunu, zarar, idari para cezası ve yasal yaptırımın sorumluluğunun tamamen bana ait olduğunu; LezzetHub’ın yalnızca aracı hizmet sağlayıcı olduğunu ve bu nedenle LezzetHub’a yöneltilebilecek talep ve zararları karşılayacağımı kabul ederim.',
      },
      {
        heading: '5. Vergi ve ödemeler',
        body:
          'Satışlarımdan doğan vergi ve diğer mali yükümlülükler bana aittir. Net kazancımın, sipariş tamamlandıktan sonra beyan ettiğim ve adıma kayıtlı IBAN’a aktarılmasını kabul ederim.',
      },
    ],
  },
  courier: {
    title: 'Kurye Beyanı ve Sorumluluk Taahhüdü',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Sürücü belgesi',
        body:
          'Yüklediğim A2 veya B sınıfı sürücü belgesinin bana ait ve geçerli olduğunu; belgemin iptal edilmesi, askıya alınması veya süresinin dolması halinde kurye hizmetini derhal durduracağımı ve platformu bilgilendireceğimi beyan ederim.',
      },
      {
        heading: '2. Trafik ve gıda taşıma kuralları',
        body:
          '2918 sayılı Karayolları Trafik Kanunu başta olmak üzere trafik mevzuatına, araç sigorta ve muayene yükümlülüklerine uyacağımı; yiyecekleri temiz, kapalı ve uygun ısıda taşıyacağımı taahhüt ederim.',
      },
      {
        heading: '3. Bağımsızlık ve sorumluluk',
        body:
          'LezzetHub’ın çalışanı olmadığımı, teslimat ücretini ve koşulları beni arayan kullanıcıyla kendim belirlediğimi; vergi, sigorta ve diğer yasal yükümlülüklerimin ve teslimat sırasında doğabilecek kaza, hasar ve gecikmelerin sorumluluğunun bana ait olduğunu kabul ederim.',
      },
      {
        heading: '4. İletişim bilgisi',
        body: 'Onaylandığımda adımın, araç türümün, hizmet ilçelerimin ve telefon numaramın kurye arayan kullanıcılara gösterileceğini biliyorum. Müsaitliğimi kurye panelinden kapatabilirim.',
      },
    ],
  },
  sales: {
    title: 'Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Taraflar',
        body:
          'Satıcı: sipariş ekranında adı gösterilen LezzetHub satıcısı. Alıcı: siparişi veren LezzetHub üyesi. Aracı hizmet sağlayıcı: ' +
          `${CONTROLLER} (LezzetHub). İletişim: ${SUPPORT_EMAIL}.`,
      },
      {
        heading: '2. Konu, fiyat ve ödeme',
        body:
          'Sözleşmenin konusu, sipariş ekranında adı, adedi, birim fiyatı, alerjenleri, son tüketim/saklama bilgisi ve toplam tutarı gösterilen üründür. Tüm fiyatlara KDV dahildir. Teslimatta ödemeli siparişlerde toplam tutar ürün bedelidir ve teslimatta doğrudan satıcıya ödenir. Online ödemeli siparişlerde toplam tutar; ürün bedeli ile %10 alıcı hizmet bedelinden oluşur ve iyzico güvenli ödeme sayfasında kartla ödenir. Kurye/kargo ücreti ilanda “alıcı öder” olarak belirtilmişse toplam tutara dahil değildir.',
      },
      {
        heading: '3. Teslimat',
        body:
          'Ürün, sipariş ekranında seçilen randevu zamanında elden, kurye veya kargo ile teslim edilir. Kargo gönderilerinde takip numarası sipariş ekranında paylaşılır. Teslimat masrafı ilanda belirtildiği şekilde alıcı veya satıcıya aittir.',
      },
      {
        heading: '4. Cayma hakkı',
        body:
          'Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca çabuk bozulabilen veya son kullanma tarihi geçebilecek mallar ile tüketicinin kişisel ihtiyaçları doğrultusunda hazırlanan mallarda cayma hakkı kullanılamaz. Ev yemekleri bu kapsamdadır.',
      },
      {
        heading: '5. İptal ve iade',
        body:
          'Satıcı onayından önce ve ödemeden önce sipariş ücretsiz iptal edilebilir. Ödeme sonrası; ürünün hiç teslim edilmemesi, ayıplı, bozuk veya ilandan farklı olması halinde LezzetHub desteğine başvurabilirsiniz. Online ödemeli siparişlerde haklı bulunan taleplerde tutar ödemenin yapıldığı karta iade edilir. Teslimatta ödemeli siparişlerde iade satıcı tarafından yapılır; LezzetHub uyuşmazlığın çözümüne yardımcı olur ve kurallara uymayan satıcının hesabını kapatabilir. Ürünü teslim almadan ödeme yapmamanızı öneririz.',
      },
      {
        heading: '6. Şikayet ve uyuşmazlık',
        body: `Şikayetlerinizi ${SUPPORT_EMAIL} adresine iletebilirsiniz. Parasal sınırlar dahilinde Tüketici Hakem Heyetleri, aşan durumlarda Tüketici Mahkemeleri yetkilidir.`,
      },
    ],
  },
  food: {
    title: 'Gıda Güvenliği Kuralları ve Yasaklı Ürünler',
    updated: UPDATED,
    sections: [
      {
        heading: '1. Satıcı olma şartları',
        body:
          '• E-Devlet üzerinden doğrulanabilir hijyen eğitimi belgesi.\n' +
          '• İl/İlçe Tarım ve Orman Müdürlüğü’nden alınan gıda işletmesi kayıt numarası (5996 sayılı Kanun). Numara ilanlarda alıcılara gösterilir.\n' +
          '• Satıcı Beyanı ve Sorumluluk Taahhüdü’nün onayı.',
      },
      {
        heading: '2. Satışı yasak ürünler',
        body: PROHIBITED_LIST + '\n\nSatıcı her ilanı kaydederken ürünün bu listede yer almadığını onaylar. Aykırı ilanlar kaldırılır ve hesap kapatılabilir.',
      },
      {
        heading: '3. Her ilanda zorunlu bilgiler',
        body:
          '• Alerjenler (Türk Gıda Kodeksi’ndeki 14 alerjen grubu) ya da ürünün alerjen içermediğinin açık beyanı:\n' + ALLERGEN_LIST + '\n' +
          '• Son tüketim ve saklama bilgisi (ör. “Buzdolabında 2 gün”).\n' +
          '• İçerik ve porsiyon bilgisini içeren açıklama.',
      },
      {
        heading: '4. Kargo ve taşıma',
        body:
          'Kargo yalnızca oda sıcaklığında dayanıklı, soğuk zincir gerektirmeyen ürünlerde (ör. kuru tatlılar, unlu mamuller, nar ekşisi, reçel) seçilebilir. Sulu yemekler, sütlü/kremalı tatlılar, et ve tavuk yemekleri ile dondurulmuş ürünler yalnızca elden teslim veya kısa mesafeli kurye ile teslim edilir. Ürünler kapalı, temiz ve gıdaya uygun ambalajda teslim edilmelidir.',
      },
      {
        heading: '5. Hijyen şikayetleri',
        body:
          'Ürünü satın almış bir alıcıdan veya iki farklı kullanıcıdan hijyen / gıda güvenliği şikayeti gelen ilan, inceleme bitene kadar otomatik olarak yayından kaldırılır; satıcı ilanı kendisi yeniden açamaz. Yönetici 24 saat içinde inceler. Gıda zehirlenmesi şüphesinde alıcıların sağlık kuruluşuna başvurması ve ALO 174 Gıda Hattı’na bildirmesi önerilir.',
      },
    ],
  },
};
