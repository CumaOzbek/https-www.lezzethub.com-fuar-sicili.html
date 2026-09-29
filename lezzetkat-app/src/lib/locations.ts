// Türkiye il / ilçe / mahalle yardımcıları.
// İl ve ilçeler uygulamaya gömülüdür; mahalle önerileri il seçildiğinde parça parça yüklenir.
import { useEffect, useState } from 'react';

import { DISTRICTS_BY_CODE, PROVINCE_LIST } from '../data/locations';
import { NEIGHBOURHOOD_LOADERS } from '../data/neighbourhoods';

export interface Province {
  code: string;
  name: string;
}

export const PROVINCES: Province[] = PROVINCE_LIST.map(([code, name]) => ({ code, name }));

/** Konum filtresinde tüm Türkiye. */
export const ALL_TURKEY = 'Türkiye Geneli';
/** Konum filtresinde seçili ilin tüm ilçeleri. */
export const ALL_DISTRICTS = 'Tüm ilçeler';

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
const byName = new Map(PROVINCES.map((p) => [trLower(p.name), p]));

export const findProvince = (name: string | undefined) => (name ? byName.get(trLower(name.trim())) : undefined);

/** İlin ilçeleri (alfabetik); il bulunamazsa boş dizi. */
export function districtsOf(province: string | undefined): string[] {
  const p = findProvince(province);
  return p ? (DISTRICTS_BY_CODE[p.code] ?? []) : [];
}

export const isValidProvince = (province: string) => !!findProvince(province);

export const isValidDistrict = (province: string, district: string) => districtsOf(province).includes(district);

/* ------------------------------ Mahalleler ------------------------------ */

const cache = new Map<string, Record<string, string[]>>();

function parse(body: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of body.split('\n')) {
    const [district, names = ''] = line.split('\t');
    if (district) out[district] = names ? names.split('|') : [];
  }
  return out;
}

/** İlin ilçe → mahalle listesini yükler (ilk seferde ağ/dosyadan, sonra önbellekten). */
export async function loadNeighbourhoods(province: string): Promise<Record<string, string[]>> {
  const p = findProvince(province);
  if (!p) return {};
  const hit = cache.get(p.code);
  if (hit) return hit;
  const loader = NEIGHBOURHOOD_LOADERS[p.code];
  if (!loader) return {};
  const data = parse((await loader()).default);
  cache.set(p.code, data);
  return data;
}

/** Seçili il ve ilçenin mahalle listesini döner; yüklenene kadar boş dizi. */
export function useNeighbourhoods(province: string | undefined, district: string | undefined): string[] {
  const [data, setData] = useState<{ key: string; list: string[] }>({ key: '', list: [] });
  const key = `${province ?? ''}|${district ?? ''}`;
  useEffect(() => {
    let alive = true;
    if (!province || !district) return;
    loadNeighbourhoods(province)
      .then((all) => {
        if (alive) setData({ key, list: all[district] ?? [] });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [province, district, key]);
  return data.key === key ? data.list : [];
}

/** Mahalle önerileri: yazılana göre önce baş harf eşleşmesi, sonra içerenler. */
export function suggestNeighborhoods(pool: string[], query: string, limit = 8): string[] {
  const q = trLower(query.trim());
  if (!q) return pool.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const n of pool) {
    const l = trLower(n);
    if (l === q) continue;
    if (l.startsWith(q)) starts.push(n);
    else if (l.includes(q)) contains.push(n);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function matchesText(haystack: string, needle: string) {
  return trLower(haystack).includes(trLower(needle.trim()));
}

export const locationLabel = (l: { neighborhood: string; district: string; province: string }) =>
  `${l.neighborhood}, ${l.district}/${l.province}`;
