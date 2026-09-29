// supabase/kurulum.sql dosyasını dört SQL dosyasından üretir: npm run db:bundle
// (SQL dosyalarından biri değiştiğinde çalıştırın; test:db bu dosyanın güncel olduğunu kontrol eder.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url);
const dir = path.resolve(path.dirname(self), '../supabase');
const header = `-- =====================================================================
-- LezzetHub — TEK DOSYADA VERİTABANI KURULUMU
-- Bu dosyanın TAMAMINI kopyalayıp Supabase → SQL Editor → New query alanına
-- yapıştır ve Run'a bas. (locations + schema + storage + realtime birlikte)
-- Tekrar çalıştırmak güvenlidir; mevcut verileri silmez.
-- Bu dosya scripts/build-kurulum.mjs ile üretilir; elle düzenlemeyin.
-- =====================================================================
`;
export function buildKurulum() {
  return (
    header +
    ['locations.sql', 'schema.sql', 'storage.sql', 'realtime.sql']
      .map((f) => `\n-- ##################### ${f} #####################\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n`)
      .join('')
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  fs.writeFileSync(path.join(dir, 'kurulum.sql'), buildKurulum());
  console.log('supabase/kurulum.sql güncellendi');
}
