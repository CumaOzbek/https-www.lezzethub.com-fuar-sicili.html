# Google Play Console — Hazır Cevaplar ve Görseller

Bu klasör, Google Play Console'da doldurman gereken tüm alanların hazır metinlerini ve görsellerini içerir.
`SITE` yazan yerlere gizlilik politikası sayfasını yayınladığın adresi yaz (ör. `https://lezzetkat.netlify.app`).

## 1. Görseller (bu klasörde)

| Alan | Dosya | Şart |
|---|---|---|
| Uygulama simgesi | `icon-512.png` | 512×512 PNG |
| Öne çıkan grafik | `feature-graphic-1024x500.png` | 1024×500 |
| Telefon ekran görüntüleri | `screenshots/01…08.png` | 1080×1920, en az 2 tane (8 tane hazır) |

## 2. Mağaza girişi (Ana mağaza girişi)

**Uygulama adı** (en fazla 30 karakter):
```
LezzetKAT: Ev Yemekleri
```

**Kısa açıklama** (en fazla 80 karakter):
```
Mahallendeki ev aşçılarından randevulu ev yemeği siparişi ver, yemeğini sat.
```

**Tam açıklama:**
```
LezzetKAT, mahallendeki ev aşçılarını yemek sevenlerle buluşturan ev yemeği pazaryeridir. Türkiye’nin 81 ilinde, il–ilçe–mahalle bazında çalışır.

🍲 EV YEMEĞİ SİPARİŞ ET
• Bulunduğun ilçedeki ev yemeklerini keşfet; mantı, sarma, künefe, çorba ve daha fazlası
• Randevulu sipariş: gün ve saat seç, elden teslim, kurye veya kargo ile al
• Her ilanda alerjen, son tüketim ve saklama bilgisi
• Satıcıyla sipariş içi mesajlaşma
• Pilot dönemde hizmet bedeli yok: ödemeyi teslimatta doğrudan satıcıya yaparsın

👩‍🍳 YEMEĞİNİ SAT
• Yemeklerinin fotoğrafını çek, ilanını dakikalar içinde yayınla
• İlanını WhatsApp ve Instagram’da paylaş
• Siparişleri onayla, takvimini sen belirle
• Satıcı olmak için e-Devlet onaylı hijyen belgesi ve gıda işletmesi kayıt numarası gerekir

🛵 KURYE OL VEYA KURYE BUL
• A2/B ehliyetli kuryeler hizmet verdikleri ilçelerde listelenir
• Yakınındaki onaylı kuryeye telefon veya WhatsApp ile ulaş

🛡 GÜVEN VE GIDA GÜVENLİĞİ
• Tüm satıcıların hijyen belgesi yönetici tarafından kontrol edilir
• Yüksek riskli ürünlerin satışı yasaktır
• Hijyen şikayeti gelen ilan inceleme bitene kadar otomatik olarak yayından kaldırılır
• Şikayet ve engelleme, KVKK uyumlu gizlilik, uygulama içinden hesap silme

LezzetKAT bir aracı platformdur; yemekler kayıtlı ev aşçıları tarafından hazırlanır.
İletişim: ozbek.info@gmail.com
```

**Kategori:** Yiyecek ve İçecek
**İletişim e-postası:** ozbek.info@gmail.com

## 3. Uygulama içeriği (Politika → Uygulama içeriği)

| Bölüm | Cevap |
|---|---|
| Gizlilik politikası | `SITE/legal/privacy` |
| Reklamlar | Hayır, reklam içermiyor |
| Uygulama erişimi | "Bazı işlevler kısıtlı" → aşağıdaki test hesabı notunu yaz |
| İçerik derecelendirmesi | Aşağıdaki anket cevapları |
| Hedef kitle | 18 yaş ve üzeri (çocuklara yönelik değil) |
| Haber uygulaması | Hayır |
| COVID-19 / sağlık uygulaması | Hayır |
| Devlet uygulaması | Hayır |
| Finansal özellikler | Hiçbiri (pilot dönemde ödeme uygulamadan geçmez) |
| Veri güvenliği | Aşağıdaki tablo |
| Hesap silme URL'si | `SITE/legal/delete` |

### Uygulama erişimi — test hesabı notu
Önce canlı uygulamada iki hesap oluştur: bir alıcı, bir de satıcı. Satıcı başvurusunu admin panelinden onayla. Sonra şu notu yaz:
```
Giriş: E-posta ve şifre ile.
Alıcı hesabı: [e-posta] / [şifre]
Satıcı hesabı (onaylı): [e-posta] / [şifre]
Satıcı olmak için hijyen belgesi yüklemek ve yönetici onayı gerekir; bu nedenle onaylı bir satıcı hesabı verilmiştir.
Ödeme uygulama üzerinden alınmaz; alıcı teslimatta doğrudan satıcıya öder.
```

### İçerik derecelendirmesi anketi
- Kategori: **Diğer tüm uygulama türleri**
- Şiddet, cinsellik, küfür, uyuşturucu, kumar: **Hayır**
- Kullanıcılar birbiriyle etkileşim kurabiliyor veya içerik paylaşabiliyor mu: **Evet** (mesajlaşma, ilan)
- Kullanıcıların konumu diğer kullanıcılarla paylaşılıyor mu: **Hayır** (yalnızca kullanıcının yazdığı mahalle/ilçe gösterilir, cihaz konumu kullanılmaz)
- Dijital ürün satın alma: **Hayır**

### Veri güvenliği formu
Genel sorular:
- Veri topluyor veya paylaşıyor mu: **Evet**
- Tüm veriler aktarım sırasında şifreleniyor mu: **Evet** (HTTPS)
- Kullanıcılar verilerinin silinmesini isteyebilir mi: **Evet** (uygulama içinden + `SITE/legal/delete`)
- Üçüncü taraflarla paylaşım: **Hayır** (altyapı sağlayıcısı Supabase "hizmet sağlayıcı" sayılır, paylaşım değildir)

Toplanan veri türleri (hepsi: **Toplanır**, **Paylaşılmaz**, amaç: **Uygulama işlevselliği** ve **Hesap yönetimi**):

| Veri türü | Zorunlu mu | Not |
|---|---|---|
| Kişisel bilgiler → Ad | Zorunlu | |
| Kişisel bilgiler → E-posta adresi | Zorunlu | |
| Kişisel bilgiler → Telefon numarası | İsteğe bağlı | Satıcı ve kurye için zorunlu |
| Kişisel bilgiler → Adres | İsteğe bağlı | Kurye/kargo teslimatı için |
| Kişisel bilgiler → Diğer bilgiler | İsteğe bağlı | Hijyen belgesi no, gıda işletmesi kayıt no, ehliyet no (yalnızca satıcı/kurye) |
| Finansal bilgiler → Diğer finansal bilgiler | İsteğe bağlı | IBAN (yalnızca satıcı) |
| Finansal bilgiler → Satın alma geçmişi | Zorunlu | Siparişler |
| Mesajlar → Diğer uygulama içi mesajlar | İsteğe bağlı | Sipariş sohbeti |
| Fotoğraflar ve videolar → Fotoğraflar | İsteğe bağlı | İlan ve profil fotoğrafı, belge görüntüleri |
| Uygulama etkinliği → Diğer kullanıcı tarafından oluşturulan içerik | İsteğe bağlı | İlanlar, şikayetler |

Konum (cihaz konumu), kişiler, takvim, sağlık, cihaz kimlikleri: **Toplanmaz**.

## 4. Test ve yayın
1. `LezzetKAT-Yayinla.bat` → **3** ile `.aab` dosyasını üret.
2. Play Console → **Test → Kapalı test** → yeni kanal → `.aab` yükle → sürüm notu: `İlk sürüm`.
3. Test kullanıcıları: en az **12 kişinin Gmail adresi** ekle, gelen bağlantıyı onlara gönder.
4. **14 gün** boyunca testte kal; ardından **Üretim erişimi başvurusu** yap.
