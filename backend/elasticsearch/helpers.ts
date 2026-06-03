// ─── Shared parsing helpers for Elasticsearch sync & search ──────────────────

export const isValidInfo = (val?: string) => {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  return !(lower === 'n/a' || lower === 'không có thông tin' || lower === 'không yêu cầu' ||
    lower === 'null' || lower === 'undefined' || lower === '-' || lower === '');
};

export const CITY_PATTERNS = [
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

/**
 * Chuẩn hoá chuỗi địa điểm thô thành tên thành phố chuẩn từ danh sách CITY_PATTERNS.
 * Đây là hàm dùng chung (source of truth) cho cả scraper và ES sync.
 * @param rawText - Chuỗi địa điểm thô từ trang web
 * @returns Tên thành phố chuẩn hoặc null nếu không khớp
 */
export function normalizeLocation(rawText?: string): string | null {
  const text = (rawText || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 80) return null;
  // Lọc bỏ các chuỗi trông giống chức vụ/ngành nghề thay vì địa điểm
  if (/(chức vụ|kinh nghiệm|khách|chuyên viên|nhân viên|trưởng phòng|giám đốc|thực tập sinh|kỹ sư|quản lý|tuyển dụng|sale)/i.test(text)) return null;
  const matched = CITY_PATTERNS.find(city => text.toLowerCase().includes(city.toLowerCase()));
  if (matched) return matched;
  return null;
}

export const splitLocations = (val?: string): string[] => {
  if (!val) return [];
  const cleaned = val.replace(/^(làm việc:\s*|nơi làm việc:\s*|khu vực:\s*|tại:\s*)/i, '').trim();
  const parts = cleaned.split(/[,;]|(?<!Bà Rịa) - (?!Vũng Tàu)/).map(p => p.trim()).filter(Boolean);
  const cities: string[] = [];
  for (const part of parts) {
    const matched = CITY_PATTERNS.find(city => part.toLowerCase().includes(city.toLowerCase()));
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
  /\b(usd|\$|eur|€|gbp|£|jpy|¥|sgd|aud|cad|hkd|krw|thb|myr|inr|cny|rmb|twd|czk|chf)\b/i.test(raw);

const parseSalaryToMillion = (raw: string): number | null => {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\s+/g, '');
  const trMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  if (trMatch) return parseFloat(trMatch[1].replace(',', '.'));
  const bigNum = lower.match(/^(\d[\d.,]*)\s*(?:vnđ|vnd|đồng|đ)$/);
  if (bigNum) {
    const num = parseFloat(bigNum[1].replace(/[.,]/g, ''));
    if (!isNaN(num) && num >= 100000) return num / 1_000_000;
  }
  return null;
};

export const SALARY_RANGES = [
  { label: '0 – 3 triệu', min: 0, max: 3 },
  { label: '3 – 5 triệu', min: 3, max: 5 },
  { label: '5 – 10 triệu', min: 5, max: 10 },
  { label: '10 – 20 triệu', min: 10, max: 20 },
  { label: '20 – 50 triệu', min: 20, max: 50 },
  { label: 'Trên 50 triệu', min: 50, max: Infinity },
];

export const getSalaryBuckets = (raw?: string): string[] => {
  if (!isValidInfo(raw) || isForeignCurrency(raw!)) return [];
  const normalized = (raw || '').toLowerCase();
  const rangeMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)?\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/)
    || normalized.match(/(?:từ\s*)?(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)\s*đến\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  let low: number | null = null, high: number | null = null;
  if (rangeMatch) {
    low = parseSalaryToMillion(rangeMatch[1] + 'tr');
    high = parseSalaryToMillion(rangeMatch[2] + 'tr');
  } else {
    const tokens = (raw || '').match(/\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|vnđ|vnd|đồng|đ)/gi) || [];
    const nums = tokens.map(t => parseSalaryToMillion(t)).filter((n): n is number => n !== null);
    if (nums.length > 0) { low = Math.min(...nums); high = Math.max(...nums); }
  }
  if (low === null && high === null) return [];
  const lo = low ?? high!; const hi = high ?? low!;
  return SALARY_RANGES.filter(r => r.max === Infinity ? hi > r.min : lo < r.max && hi >= r.min).map(r => r.label);
};

export const EXP_RANGES = [
  { label: 'Dưới 1 năm', min: 0, max: 1 },
  { label: '1 – 2 năm', min: 1, max: 2 },
  { label: '2 – 5 năm', min: 2, max: 5 },
  { label: 'Trên 5 năm', min: 5, max: Infinity },
];

const parseExpToYears = (raw: string): [number, number] | null => {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/không yêu cầu|chưa có kinh nghiệm/i.test(text)) return [0, 0];
  const duoiMatch = text.match(/dưới\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (duoiMatch) { const v = parseFloat(duoiMatch[1].replace(',', '.')); return [0, /tháng/i.test(duoiMatch[2]) ? v / 12 - 0.01 : v - 0.01]; }
  const trenMatch = text.match(/(?:trên|hơn|ít nhất|tối thiểu)\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (trenMatch) { const v = parseFloat(trenMatch[1].replace(',', '.')); return [/tháng/i.test(trenMatch[2]) ? v / 12 + 0.01 : v + 0.01, Infinity]; }
  const rangeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (rangeMatch) { const lo = parseFloat(rangeMatch[1].replace(',', '.')); const hi = parseFloat(rangeMatch[2].replace(',', '.')); const m = /tháng/i.test(rangeMatch[3]); return [m ? lo / 12 : lo, m ? hi / 12 : hi]; }
  const singleMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (singleMatch) { const v = parseFloat(singleMatch[1].replace(',', '.')); const y = /tháng/i.test(singleMatch[2]) ? v / 12 : v; return [y, y]; }
  return null;
};

export const getExpBuckets = (raw?: string): string[] => {
  if (!isValidInfo(raw)) return [];
  const parsed = parseExpToYears(raw!);
  if (!parsed) return [];
  const [lo, hi] = parsed;
  return EXP_RANGES.filter(r => r.max === Infinity ? hi > r.min : (r.label === '2 – 5 năm' ? lo <= r.max && hi >= r.min : lo < r.max && hi >= r.min)).map(r => r.label);
};

export const getWorkTypeTags = (raw?: string): string[] => {
  if (!raw || !isValidInfo(raw)) return [];
  const tags: string[] = [];
  if (/toàn thời gian|full[.\-\s]?time|toàn phần/i.test(raw)) tags.push('Toàn thời gian');
  if (/bán thời gian|part[.\-\s]?time/i.test(raw)) tags.push('Bán thời gian');
  if (/thực tập|intern(?:ship)?/i.test(raw)) tags.push('Thực tập');
  if (/thời vụ|hợp đồng ngắn hạn|freelance|tạm thời|contract/i.test(raw)) tags.push('Thời vụ');
  if (/làm tại nhà|làm ở nhà|remote|hybrid|work from home|wfh/i.test(raw)) tags.push('Làm tại nhà');
  return tags.length > 0 ? tags : [raw.trim()];
};

export const getLevels = (raw?: string): string[] => {
  if (!raw || !isValidInfo(raw)) return [];
  const text = raw.trim();
  if (/kỹ thuật viên\s*\/\s*kỹ sư/i.test(text)) return [];
  if (/thực tập sinh\s*\/\s*sinh viên|sinh viên\s*\/\s*thực tập sinh/i.test(text)) return ['Thực tập sinh', 'Sinh viên'];
  if (/trưởng nhóm\s*\/\s*giám sát|giám sát\s*\/\s*trưởng nhóm/i.test(text)) return ['Trưởng nhóm', 'Giám sát'];
  if (/quản lý/i.test(text)) return ['Quản lý'];
  return [text];
};
