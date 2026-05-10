import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

// ─── Shared Helpers ────────────────────────────────────────────────────────

const isValidInfo = (val?: string) => {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  if (lower === 'n/a' || lower === 'không có thông tin' || lower === 'không yêu cầu' ||
    lower === 'null' || lower === 'undefined' || lower === '-' || lower === '') return false;
  return true;
};

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

const splitLocations = (val?: string): string[] => {
  if (!val) return [];
  const cleaned = val.replace(/^(làm việc:\s*|nơi làm việc:\s*|khu vực:\s*|tại:\s*)/i, '').trim();
  const parts = cleaned.split(/[,;]|(?<!Bà Rịa) - (?!Vũng Tàu)/).map((p) => p.trim()).filter(Boolean);
  const cities: string[] = [];
  for (const part of parts) {
    const matched = CITY_PATTERNS.find((city) => part.toLowerCase().includes(city.toLowerCase()));
    if (matched) {
      if (!cities.includes(matched)) cities.push(matched);
    } else if (part.length > 1 && part.length <= 60) {
      const shortPart = part.split(/()[[\]]/)[0].trim();
      if (shortPart && !cities.includes(shortPart)) cities.push(shortPart);
    }
  }
  return cities.length > 0 ? cities : (cleaned ? [cleaned] : []);
};

const isForeignCurrency = (raw: string) =>
  /\b(usd|\$|eur|€|gbp|£|jpy|¥|sgd|aud|cad|hkd|krw|thb|myr|inr|cny|rmb|twd|czk|chf)\b/i.test(raw.toLowerCase());

const parseSalaryToMillion = (raw: string): number | null => {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\s+/g, '');
  const trMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  if (trMatch) return parseFloat(trMatch[1].replace(',', '.'));
  const bigNum = lower.match(/^(\d[\d.,]*)\s*(?:vnđ|vnd|đồng|đ)$/);
  if (bigNum) {
    const cleaned = bigNum[1].replace(/[.,]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 100000) return num / 1_000_000;
  }
  return null;
};

const SALARY_RANGES = [
  { label: '0 – 3 triệu', min: 0, max: 3 },
  { label: '3 – 5 triệu', min: 3, max: 5 },
  { label: '5 – 10 triệu', min: 5, max: 10 },
  { label: '10 – 20 triệu', min: 10, max: 20 },
  { label: '20 – 50 triệu', min: 20, max: 50 },
  { label: 'Trên 50 triệu', min: 50, max: Infinity },
];

const getSalaryBuckets = (raw?: string): string[] => {
  if (!isValidInfo(raw)) return [];
  if (isForeignCurrency(raw!)) return [];
  const normalized = (raw || '').toLowerCase();
  const rangeMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)?\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/)
    || normalized.match(/(?:từ\s*)?(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)\s*đến\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  let low: number | null = null, high: number | null = null;
  if (rangeMatch) {
    low = parseSalaryToMillion(rangeMatch[1].trim() + 'tr');
    high = parseSalaryToMillion(rangeMatch[2].trim() + 'tr');
  } else {
    const tokens = (raw || '').match(/\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|vnđ|vnd|đồng|đ)/gi) || [];
    const nums = tokens.map((t) => parseSalaryToMillion(t)).filter((n): n is number => n !== null);
    if (nums.length > 0) { low = Math.min(...nums); high = Math.max(...nums); }
  }
  if (low === null && high === null) return [];
  const lo = low ?? high!; const hi = high ?? low!;
  return SALARY_RANGES.filter((r) => {
    if (r.max === Infinity) return hi > r.min;
    return lo < r.max && hi >= r.min;
  }).map((r) => r.label);
};

const EXP_RANGES = [
  { label: 'Dưới 1 năm', min: 0, max: 1 },
  { label: '1 – 2 năm', min: 1, max: 2 },
  { label: '2 – 5 năm', min: 2, max: 5 },
  { label: 'Trên 5 năm', min: 5, max: Infinity },
];

const parseExpToYears = (raw: string): [number, number] | null => {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/không yêu cầu|chưa có kinh nghiệm/i.test(text)) return [0, 0];
  const duoiMatch = text.match(/dưới\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (duoiMatch) { const val = parseFloat(duoiMatch[1].replace(',', '.')); return [0, /tháng/i.test(duoiMatch[2]) ? val / 12 - 0.01 : val - 0.01]; }
  const trenMatch = text.match(/(?:trên|hơn|ít nhất|tối thiểu)\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (trenMatch) { const val = parseFloat(trenMatch[1].replace(',', '.')); return [/tháng/i.test(trenMatch[2]) ? val / 12 + 0.01 : val + 0.01, Infinity]; }
  const rangeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (rangeMatch) { const lo = parseFloat(rangeMatch[1].replace(',', '.')); const hi = parseFloat(rangeMatch[2].replace(',', '.')); const m = /tháng/i.test(rangeMatch[3]); return [m ? lo / 12 : lo, m ? hi / 12 : hi]; }
  const singleMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (singleMatch) { const val = parseFloat(singleMatch[1].replace(',', '.')); const y = /tháng/i.test(singleMatch[2]) ? val / 12 : val; return [y, y]; }
  return null;
};

const getExpBuckets = (raw?: string): string[] => {
  if (!isValidInfo(raw)) return [];
  const parsed = parseExpToYears(raw!);
  if (!parsed) return [];
  const [lo, hi] = parsed;
  return EXP_RANGES.filter((r) => {
    if (r.max === Infinity) return hi > r.min;
    if (r.label === '2 – 5 năm') return lo <= r.max && hi >= r.min;
    return lo < r.max && hi >= r.min;
  }).map((r) => r.label);
};

const getWorkTypeTags = (raw?: string): string[] => {
  if (!raw || !isValidInfo(raw)) return [];
  const tags: string[] = [];
  const text = raw.trim();
  if (/toàn thời gian|full[.\-\s]?time|toàn phần/i.test(text)) tags.push('Toàn thời gian');
  if (/bán thời gian|part[.\-\s]?time/i.test(text)) tags.push('Bán thời gian');
  if (/thực tập|intern(?:ship)?/i.test(text)) tags.push('Thực tập');
  if (/thời vụ|hợp đồng ngắn hạn|freelance|tạm thời|contract/i.test(text)) tags.push('Thời vụ');
  if (/làm tại nhà|làm ở nhà|remote|hybrid|work from home|wfh/i.test(text)) tags.push('Làm tại nhà');
  if (tags.length === 0) return [text];
  return tags;
};

const getLevels = (raw: string): string[] => {
  const text = raw.trim();
  if (!isValidInfo(text)) return [];
  if (/kỹ thuật viên\s*\/\s*kỹ sư/i.test(text)) return [];
  if (/thực tập sinh\s*\/\s*sinh viên|sinh viên\s*\/\s*thực tập sinh/i.test(text)) return ['Thực tập sinh', 'Sinh viên'];
  if (/trưởng nhóm\s*\/\s*giám sát|giám sát\s*\/\s*trưởng nhóm/i.test(text)) return ['Trưởng nhóm', 'Giám sát'];
  if (/quản lý/i.test(text)) return ['Quản lý'];
  return [text];
};

// ─── Cache all jobs for 5 minutes (server-side) ─────────────────────────────

let globalJobsCache: any[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

const getAllJobsCached = async () => {
  const now = Date.now();
  if (globalJobsCache && (now - lastCacheTime < CACHE_TTL)) {
    return globalJobsCache;
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
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }

  // Deduplication
  const seen = new Set<string>();
  const deduplicated = allJobs.filter((job, idx) => {
    const title = (job.tieu_de || job.title || '').trim().toLowerCase();
    const company = (job.cong_ty || job.company || '').trim().toLowerCase();
    const url = (job.url || '').trim().toLowerCase();
    const key = url || `${title}-${company}-${job.dia_diem || job.location || ''}-${idx}`;
    if (!isValidInfo(key)) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  globalJobsCache = deduplicated;
  lastCacheTime = now;
  return deduplicated;
};

// ─── GET /api/v1/jobs/search ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const keyword = searchParams.get('keyword')?.trim().toLowerCase() || '';
    const locations = searchParams.getAll('locations');
    const categories = searchParams.getAll('categories');
    const workTypes = searchParams.getAll('workTypes');
    const levels = searchParams.getAll('levels');
    const experiences = searchParams.getAll('experiences');
    const salaryBuckets = searchParams.getAll('salaryBuckets');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = 20;

    // Lấy toàn bộ jobs từ cache
    const allJobs = await getAllJobsCached();

    // Apply filters
    const filtered = allJobs.filter((job) => {
      const title = (job.tieu_de || job.title || '').toLowerCase();
      const company = (job.cong_ty || job.company || '').toLowerCase();
      const jobCities = splitLocations(job.dia_diem || job.location || '').map((c) => c.toLowerCase());
      const categoryTags = (job.nganh_nghe || '').toLowerCase().split(',').map((c: string) => c.trim());
      const jobWorkTypeTags = getWorkTypeTags(job.hinh_thuc_lam_viec);
      const jobLevels = getLevels(job.cap_bac || '');
      const jobExpBuckets = getExpBuckets(job.kinh_nghiem_lam_viec);
      const jobSalaryBuckets = getSalaryBuckets(job.muc_luong || job.salary);

      if (keyword && !title.includes(keyword) && !company.includes(keyword)) return false;
      if (locations.length && !locations.some((l) => jobCities.includes(l.toLowerCase()))) return false;
      if (categories.length && !categories.some((c) => categoryTags.includes(c.toLowerCase()))) return false;
      if (workTypes.length && !workTypes.some((w) => jobWorkTypeTags.includes(w))) return false;
      if (levels.length && !levels.some((l) => jobLevels.includes(l))) return false;
      if (experiences.length && !experiences.some((b) => jobExpBuckets.includes(b))) return false;
      if (salaryBuckets.length && !salaryBuckets.some((b) => jobSalaryBuckets.includes(b))) return false;

      return true;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const jobs = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({ jobs, total, page, totalPages }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    console.error('[/api/v1/jobs/search] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
