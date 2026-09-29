// Türkiye il / ilçe / mahalle verisini uygulama ve veritabanı için üretir.
// Kaynak: turkey-neighbourhoods (MIT, https://github.com/muratgozel/turkey-neighbourhoods)
// Kullanım:
//   npm pack turkey-neighbourhoods && tar xzf turkey-neighbourhoods-*.tgz
//   node scripts/generate-locations.mjs package/src/data
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('Kullanım: node scripts/generate-locations.mjs <turkey-neighbourhoods/src/data>');
const read = (f) => JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));

const collator = new Intl.Collator('tr', { sensitivity: 'base' });
const sortTr = (arr) => [...new Set(arr)].sort(collator.compare);

const cities = read('cityList.json'); // [{code, name}]
const districts = read('districtsByCityCode.json'); // {code: [district]}
const neighbourhoods = read('neighbourhoods.json'); // [[code, city, district, name, postal]]

const clean = (s) =>
  s
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+(Mah|Mahallesi)\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const provinces = [...cities].sort((a, b) => collator.compare(a.name, b.name));
const out = path.resolve('src/data');
const nbDir = path.join(out, 'neighbourhoods');
fs.mkdirSync(nbDir, { recursive: true });

// 1) İl ve ilçeler (uygulamaya gömülü, ~20 KB)
const lines = [
  '// Bu dosya scripts/generate-locations.mjs ile üretilir; elle düzenlemeyin.',
  '// Kaynak: turkey-neighbourhoods (MIT).',
  '',
  '/** [plaka kodu, il adı] — alfabetik. */',
  `export const PROVINCE_LIST: [string, string][] = ${JSON.stringify(provinces.map((c) => [c.code, c.name]))};`,
  '',
  '/** Plaka koduna göre ilçeler — alfabetik. */',
  `export const DISTRICTS_BY_CODE: Record<string, string[]> = ${JSON.stringify(
    Object.fromEntries(provinces.map((c) => [c.code, sortTr(districts[c.code] ?? [])])),
  )};`,
  '',
];
fs.writeFileSync(path.join(out, 'locations.ts'), lines.join('\n'));

// 2) Mahalleler: il başına bir parça (gerektiğinde yüklenir)
const byCity = new Map();
for (const [code, , district, name] of neighbourhoods) {
  if (!byCity.has(code)) byCity.set(code, new Map());
  const m = byCity.get(code);
  if (!m.has(district)) m.set(district, []);
  const n = clean(name);
  if (n) m.get(district).push(n);
}
let total = 0;
for (const c of provinces) {
  const m = byCity.get(c.code) ?? new Map();
  const body = sortTr([...m.keys()])
    .map((d) => `${d}\t${sortTr(m.get(d)).join('|')}`)
    .join('\n');
  total += body.length;
  fs.writeFileSync(
    path.join(nbDir, `p${c.code}.ts`),
    `// Üretilmiş dosya: ${c.name} ilçe ve mahalleleri (ilçe<TAB>mahalle|mahalle...).\nexport default ${JSON.stringify(body)};\n`,
  );
}
const loaders = provinces.map((c) => `  '${c.code}': () => import('./p${c.code}'),`).join('\n');
fs.writeFileSync(
  path.join(nbDir, 'index.ts'),
  `// Üretilmiş dosya. Her il ayrı parça olarak yalnızca gerektiğinde yüklenir.\n` +
    `export const NEIGHBOURHOOD_LOADERS: Record<string, () => Promise<{ default: string }>> = {\n${loaders}\n};\n`,
);

// 3) Veritabanı doğrulama tablosu
const esc = (s) => s.replace(/'/g, "''");
const rows = provinces.flatMap((c) => sortTr(districts[c.code] ?? []).map((d) => `('${esc(c.name)}','${esc(d)}')`));
fs.writeFileSync(
  path.resolve('supabase/locations.sql'),
  [
    '-- Üretilmiş dosya (scripts/generate-locations.mjs). Türkiye il ve ilçeleri.',
    '-- schema.sql’den ÖNCE çalıştırın.',
    'create table if not exists public.tr_districts (province text not null, district text not null, primary key (province, district));',
    'insert into public.tr_districts (province, district) values',
    rows.join(',\n') + '\non conflict do nothing;',
    '',
  ].join('\n'),
);
console.log(`${provinces.length} il, ${rows.length} ilçe, mahalle verisi ${(total / 1024).toFixed(0)} KB`);
