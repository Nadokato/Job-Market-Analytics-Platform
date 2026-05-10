import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

const CITY_PATTERNS = [
  'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng',
  'Bắc Ninh', 'Bình Dương', 'Đồng Nai', 'Khánh Hòa', 'Kiên Giang',
  'Nghệ An', 'Thanh Hóa', 'Hải Dương', 'Thái Nguyên', 'Vĩnh Phúc',
  'Thái Bình', 'Long An', 'Tiền Giang', 'An Giang', 'Bình Định',
  'Lâm Đồng', 'Đắk Lắk', 'Quảng Ninh', 'Quảng Nam', 'Thừa Thiên Huế',
  'Bà Rịa - Vũng Tàu', 'Vũng Tàu', 'Hưng Yên', 'Nam Định', 'Hà Nam',
  'Ninh Bình', 'Phú Thọ', 'Yên Bái', 'Lào Cai', 'Sơn La', 'Điện Biên',
  'Lai Châu', 'Hòa Bình', 'Bắc Giang', 'Lạng Sơn', 'Tuyên Quang',
  'Cao Bằng', 'Bắc Kạn', 'Hà Giang', 'Quảng Bình', 'Quảng Trị',
  'Quảng Ngãi', 'Bình Thuận', 'Ninh Thuận', 'Phú Yên', 'Bình Phước',
  'Tây Ninh', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long', 'Đồng Tháp',
  'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Gia Lai',
  'Kon Tum', 'Đắk Nông', 'Toàn quốc', 'Nước ngoài',
];

const isValidInfo = (val?: string) => {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  return !(lower === 'n/a' || lower === 'không có thông tin' || lower === 'không yêu cầu' ||
    lower === 'null' || lower === 'undefined' || lower === '-' || lower === '');
};

const splitLocations = (val?: string): string[] => {
  if (!val) return [];
  const cleaned = val.replace(/^(làm việc:\s*|nơi làm việc:\s*|khu vực:\s*|tại:\s*)/i, '').trim();
  const parts = cleaned.split(/[,;]|(?<!Bà Rịa) - (?!Vũng Tàu)/).map((p) => p.trim()).filter(Boolean);
  const cities: string[] = [];
  for (const part of parts) {
    const matched = CITY_PATTERNS.find((city) => part.toLowerCase().includes(city.toLowerCase()));
    if (matched && !cities.includes(matched)) cities.push(matched);
    else if (!matched && part.length > 1 && part.length <= 60) {
      const shortPart = part.split(/()[[\]]/)[0].trim();
      if (shortPart && !cities.includes(shortPart)) cities.push(shortPart);
    }
  }
  return cities.length > 0 ? cities : (cleaned ? [cleaned] : []);
};

let globalOptionsCache: any[] | null = null;
let lastOptionsCacheTime = 0;
const OPTIONS_CACHE_TTL = 60 * 60 * 1000; // 1 giờ

const getAllJobsForOptions = async () => {
  const now = Date.now();
  if (globalOptionsCache && (now - lastOptionsCacheTime < OPTIONS_CACHE_TTL)) {
    return globalOptionsCache;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let allJobs: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('jobs')
      .select('dia_diem, nganh_nghe')
      .range(offset, offset + limit - 1);

    if (error || !data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }

  globalOptionsCache = allJobs;
  lastOptionsCacheTime = now;
  return allJobs;
};

// GET /api/v1/jobs/options
export async function GET(_req: NextRequest) {
  try {
    const allJobs = await getAllJobsForOptions();

    // Locations
    const locationSet = new Set<string>();
    allJobs.forEach((j) => {
      splitLocations(j.dia_diem || j.location || '').forEach((city) => {
        if (isValidInfo(city)) locationSet.add(city);
      });
    });
    const locations = Array.from(locationSet).sort((a, b) => a.localeCompare(b, 'vi'));

    // Categories
    const categorySet = new Set<string>();
    allJobs.forEach((j) => {
      (j.nganh_nghe || '').split(',').forEach((c: string) => {
        const t = c.trim();
        if (t && isValidInfo(t)) categorySet.add(t);
      });
    });
    const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'vi'));

    return NextResponse.json({ locations, categories }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
    });
  } catch (err) {
    console.error('[/api/v1/jobs/options] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
