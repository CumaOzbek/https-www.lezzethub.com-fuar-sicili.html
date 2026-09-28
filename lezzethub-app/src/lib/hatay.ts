// Hatay ilinin 15 ilçesi ve her ilçe için öneri olarak sunulan bilinen mahalleler.
// Liste yalnızca otomatik tamamlama önerisidir; kullanıcı listede olmayan bir mahalle de yazabilir.

export const DISTRICTS = [
  'Antakya',
  'Arsuz',
  'Altınözü',
  'Belen',
  'Defne',
  'Dörtyol',
  'Erzin',
  'Hassa',
  'İskenderun',
  'Kırıkhan',
  'Kumlu',
  'Payas',
  'Reyhanlı',
  'Samandağ',
  'Yayladağı',
] as const;

export type District = (typeof DISTRICTS)[number];

export const ALL_HATAY = 'Hatay Geneli';

export const NEIGHBORHOODS: Record<District, string[]> = {
  Antakya: [
    'Armutlu', 'Cumhuriyet', 'Saraykent', 'Kuyulu', 'Ürgenpaşa', 'Haraparası', 'Kışlasaray',
    'Odabaşı', 'Akevler', 'Emek', 'Esentepe', 'Güzelburç', 'Aksaray', 'Cebrail', 'Karaali',
    'Zenginler', 'Gazi', 'Yavuz Selim', 'Kanatlı', 'Şükrükanatlı', 'Serinyol', 'Narlıca',
  ],
  Arsuz: [
    'Karaağaç', 'Gözcüler', 'Uluçınar', 'Konacık', 'Madenli', 'Akçalı', 'Nardüzü', 'Kale',
    'Karahüseyinli', 'Arpagedik', 'Güzelköy', 'Sarıseki', 'Ekinci',
  ],
  Altınözü: [
    'Yeni', 'Kurtuluş', 'Hacıpaşa', 'Yanıkpınar', 'Babatorun', 'Kuşaklı', 'Tokdemir', 'Enek',
    'Sarıbük', 'Kamberli', 'Günvuran', 'Boynuyoğun',
  ],
  Belen: [
    'Kıcı', 'Müftüler', 'Sarımazı', 'Bakras', 'Güzelyayla', 'Kömürçukuru', 'Atik', 'Halilbey',
    'Ötençay', 'Yenice', 'Soğukoluk',
  ],
  Defne: [
    'Harbiye', 'Sümerler', 'Orhanlı', 'Çekmece', 'Elektrik', 'Hancağız', 'Gümüşgöze', 'Aknehir',
    'Balıkçılar', 'Döver', 'Meydan', 'Özbek', 'Samankaya', 'Tavla', 'Toygar',
  ],
  Dörtyol: [
    'Kuzuculu', 'Karakese', 'Yeşilköy', 'Özerli', 'Kışlalar', 'Altınçağ', 'Çaylı', 'Karacaören',
    'Ocaklı', 'Yenice', 'Numune', 'Sanayi',
  ],
  Erzin: [
    'Başlamış', 'Aşağıburnaz', 'Yukarıburnaz', 'Kuşçu', 'Turunçlu', 'Esentepe', 'Hürriyet',
    'Gökdere', 'Mustafa Kemal', 'Cumhuriyet',
  ],
  Hassa: [
    'Aktepe', 'Akbez', 'Kurtlusoğuksu', 'Demrek', 'Yeşilkent', 'Söğütlüdere', 'Ardıçlı',
    'Kaletepe', 'Tiyekli', 'Yıldırımtepe', 'Hacılar',
  ],
  İskenderun: [
    'Çay', 'Pirireis', 'Savaş', 'Numune', 'Modernevler', 'Denizciler', 'Karaağaç', 'Sakarya',
    'Mustafa Kemal', 'Yunus Emre', 'Dumlupınar', 'Cumhuriyet', 'Barbaros', 'Kurtuluş',
    'Bekbele', 'Akarca', 'Kocatepe', 'Güzelçay',
  ],
  Kırıkhan: [
    'Cumhuriyet', 'Kurtuluş', 'Ceylanlı', 'Kodallı', 'Alaybeyli', 'Muratpaşa', 'Reşatlı',
    'Soğuksu', 'Özkızılkaya', 'Bahçeler', 'Karataş',
  ],
  Kumlu: [
    'Yeni', 'Kavalcık', 'Gökçeoğlu', 'Hamam', 'Akkerpiç', 'Yenişakran', 'Kızıltepe', 'Kırcaoğlu',
  ],
  Payas: [
    'Cumhuriyet', 'Kurtuluş', 'Yenice', 'Karayılan', 'Yeşilyurt', 'Sincan', 'Kalebur',
    'Hürriyet', 'Çınar', 'Merkez',
  ],
  Reyhanlı: [
    'Cumhuriyet', 'Güzelyurt', 'Yenice', 'Kurtuluş', 'Alaybeyli', 'Varışlı', 'Bükülmez',
    'Cilvegözü', 'Konuk', 'Atatürk', 'Mehmet Akif Ersoy',
  ],
  Samandağ: [
    'Mağaracık', 'Çevlik', 'Tekebaşı', 'Yeşilyazı', 'Deniz', 'Sutaşı', 'Kapısuyu', 'Yaylıca',
    'Uzunbağ', 'Karamanlı', 'Vakıflı', 'Tomrukdibi', 'Hıdırbey', 'Şeyhhızır',
  ],
  Yayladağı: [
    'Güveççi', 'Yeditepe', 'Ayışığı', 'Görentepe', 'Kışlak', 'Topraktutan', 'Yukarıokçular',
    'Aşağıokçular', 'Sebenoba', 'Kızılçat',
  ],
};

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');

/** İlçeye göre mahalle önerileri (Türkçe büyük/küçük harf duyarsız). */
export function suggestNeighborhoods(district: string | undefined, query: string, limit = 6): string[] {
  const pool = district && district in NEIGHBORHOODS
    ? NEIGHBORHOODS[district as District]
    : Array.from(new Set(Object.values(NEIGHBORHOODS).flat()));
  const q = trLower(query.trim());
  if (!q) return pool.slice(0, limit);
  const starts = pool.filter((n) => trLower(n).startsWith(q));
  const contains = pool.filter((n) => !trLower(n).startsWith(q) && trLower(n).includes(q));
  return [...starts, ...contains].filter((n) => trLower(n) !== q).slice(0, limit);
}

export function matchesText(haystack: string, needle: string) {
  return trLower(haystack).includes(trLower(needle.trim()));
}
