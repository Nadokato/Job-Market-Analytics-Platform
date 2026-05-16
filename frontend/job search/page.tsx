"use client";

import React, { useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search, MapPin, Briefcase, ChevronDown,
  ChevronLeft, ChevronRight, BarChart2, X
} from 'lucide-react';
import { logout } from '@/backend/auth/actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidInfo = (val?: string) => {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  if (
    lower === 'n/a' ||
    lower === 'không có thông tin' ||
    lower === 'không yêu cầu' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === '-' ||
    lower === ''
  ) return false;
  return true;
};

const hasNoiseContent = (val?: string) => {
  const text = (val || '').toLowerCase();
  const noiseFragments = [
    'gross - net', 'tính thuế thu nhập cá nhân', 'tính bảo hiểm thất nghiệp',
    'tool check chống lừa đảo', 'cẩm nang nghề nghiệp', 'career insights',
  ];
  return noiseFragments.some((f) => text.includes(f));
};

const sanitizeDisplayValue = (val?: string) => {
  if (!isValidInfo(val)) return 'N/A';
  if (hasNoiseContent(val)) return 'N/A';
  return (val || '').replace(/\s+/g, ' ').trim();
};

// Danh sách tỉnh/thành phố để nhận diện
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

// Tách chuỗi địa điểm thành mảng từng tỉnh/thành phố
const splitLocations = (val?: string): string[] => {
  if (!val) return [];
  // Bỏ prefix thừa
  const cleaned = val
    .replace(/^(làm việc:\s*|nơi làm việc:\s*|khu vực:\s*|tại:\s*)/i, '')
    .trim();

  // Tách theo dấu phẩy, dấu chấm phẩy, hoặc " - "
  const parts = cleaned.split(/[,;]|(?<!Bà Rịa) - (?!Vũng Tàu)/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Với mỗi phần, cố gắng extract tên tỉnh/thành chuẩn
  const cities: string[] = [];
  for (const part of parts) {
    // Tìm xem part có chứa tên thành phố nào không
    const matched = CITY_PATTERNS.find((city) =>
      part.toLowerCase().includes(city.toLowerCase())
    );
    if (matched) {
      if (!cities.includes(matched)) cities.push(matched);
    } else if (part.length > 1 && part.length <= 60) {
      // Nếu không match pattern nào, vẫn giữ lại (lấy phần đầu nếu quá dài)
      const shortPart = part.split(/[()\[\]]/)[0].trim();
      if (shortPart && !cities.includes(shortPart)) cities.push(shortPart);
    }
  }
  return cities.length > 0 ? cities : (cleaned ? [cleaned] : []);
};

const cleanLocation = (val?: string) => {
  if (!val) return '';
  return val.replace(/^(làm việc:\s*|nơi làm việc:\s*|khu vực:\s*|tại:\s*)/i, '').trim();
};

// ─── Salary Parser ─────────────────────────────────────────────────────────────

// Phát hiện ngoại tệ — nếu chuỗi chứa đơn vị ngoài VND thì bỏ qua phân loại
const isForeignCurrency = (raw: string): boolean => {
  const lower = raw.toLowerCase();
  // Các ký hiệu/từ khóa ngoại tệ phổ biến
  return /\b(usd|\$|eur|€|gbp|£|jpy|¥|sgd|aud|cad|hkd|krw|thb|myr|inr|cny|rmb|twd|czk|chf)\b/i.test(lower);
};

// Chuẩn hóa: "1tr" / "1 triệu" / "1.000.000đ" / "1,000,000 VND" → số đơn vị triệu
// Lưu ý: chỉ parse số nguyên lớn khi có đi kèm đơn vị rõ ràng (vnđ/vnd/đồng/đ)
const parseSalaryToMillion = (raw: string): number | null => {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\s+/g, '');

  // Dạng "Xtr" / "X triệu"
  const trMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  if (trMatch) return parseFloat(trMatch[1].replace(',', '.'));

  // Dạng số nguyên lớn KÈM đơn vị rõ ràng: 1.000.000đ / 1000000vnd / 1,000,000vnđ
  const bigNum = lower.match(/^(\d[\d.,]*)\s*(?:vnđ|vnd|đồng|đ)$/);
  if (bigNum) {
    // Làm sạch: bỏ dấu phân cách nghìn (. hoặc ,)
    const cleaned = bigNum[1].replace(/[.,]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 100000) return num / 1_000_000;
  }

  return null;
};

// Trả về tất cả các khung lương mà job này thuộc (có thể nhiều hơn 1 nếu khoảng lương nằm giữa 2 bucket)
const SALARY_RANGES = [
  { label: '0 – 3 triệu', min: 0, max: 3 },
  { label: '3 – 5 triệu', min: 3, max: 5 },
  { label: '5 – 10 triệu', min: 5, max: 10 },
  { label: '10 – 20 triệu', min: 10, max: 20 },
  { label: '20 – 50 triệu', min: 20, max: 50 },
  { label: 'Trên 50 triệu', min: 50, max: Infinity },
] as const;

type SalaryRangeLabel = typeof SALARY_RANGES[number]['label'];

const getSalaryBuckets = (raw?: string): SalaryRangeLabel[] => {
  if (!isValidInfo(raw)) return [];

  // Bỏ qua nếu là ngoại tệ
  if (isForeignCurrency(raw!)) return [];

  const normalized = (raw || '').toLowerCase();

  // Tách dạng khoảng: "X - Y triệu" / "Từ X đến Y"
  const rangeMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)?\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/
  ) || normalized.match(
    /(?:từ\s*)?(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)\s*đến\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/
  );

  let low: number | null = null;
  let high: number | null = null;

  if (rangeMatch) {
    low = parseSalaryToMillion(rangeMatch[1].trim() + 'tr');
    high = parseSalaryToMillion(rangeMatch[2].trim() + 'tr');
  } else {
    // Dạng 1 giá trị: tìm tất cả số tiền có đơn vị trong chuỗi
    const tokens = (raw || '').match(/\d+(?:[.,]\d+)?\s*(?:tr(?:iệu)?|vnđ|vnd|đồng|đ)/gi) || [];
    const nums = tokens
      .map((t) => parseSalaryToMillion(t))
      .filter((n): n is number => n !== null);
    if (nums.length > 0) {
      low = Math.min(...nums);
      high = Math.max(...nums);
    }
  }

  if (low === null && high === null) return [];
  const lo = low ?? high!;
  const hi = high ?? low!;

  return SALARY_RANGES.filter((r) => {
    if (r.max === Infinity) {
      // Bucket "Trên 50 triệu": hi phải STRICTLY > 50, không tính đúng bằng 50
      return hi > r.min;
    }
    // Các bucket thông thường: khoảng [lo, hi] giao với [r.min, r.max)
    return lo < r.max && hi >= r.min;
  }).map((r) => r.label);
};

// ─── Experience Parser ────────────────────────────────────────────────────────

const EXP_RANGES = [
  { label: 'Dưới 1 năm', min: 0, max: 1 },
  { label: '1 – 2 năm', min: 1, max: 2 },
  { label: '2 – 5 năm', min: 2, max: 5 },  // bao gồm đúng 5 năm
  { label: 'Trên 5 năm', min: 5, max: Infinity },  // strictly > 5
] as const;

type ExpRangeLabel = typeof EXP_RANGES[number]['label'];

// Chuyển chuỗi kinh nghiệm → [lo, hi] đơn vị năm, hoặc null nếu không parse được
const parseExpToYears = (raw: string): [number, number] | null => {
  const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();

  // "Không yêu cầu" / "Chưa có kinh nghiệm"
  if (/không yêu cầu|chưa có kinh nghiệm/i.test(text)) return [0, 0];

  // "Dưới X năm/tháng"
  const duoiMatch = text.match(/dưới\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (duoiMatch) {
    const val = parseFloat(duoiMatch[1].replace(',', '.'));
    const inYears = /tháng/i.test(duoiMatch[2]) ? val / 12 : val;
    return [0, inYears - 0.01]; // exclusive upper bound
  }

  // "Trên/Hơn/Ít nhất/Tối thiểu X năm/tháng"
  const trenMatch = text.match(/(?:trên|hơn|ít nhất|tối thiểu)\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (trenMatch) {
    const val = parseFloat(trenMatch[1].replace(',', '.'));
    const inYears = /tháng/i.test(trenMatch[2]) ? val / 12 : val;
    return [inYears + 0.01, Infinity]; // exclusive lower bound
  }

  // "X–Y năm/tháng" (khoảng)
  const rangeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1].replace(',', '.'));
    const hi = parseFloat(rangeMatch[2].replace(',', '.'));
    const isMonth = /tháng/i.test(rangeMatch[3]);
    return [isMonth ? lo / 12 : lo, isMonth ? hi / 12 : hi];
  }

  // "X năm" / "X tháng" (đơn)
  const singleMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(năm|tháng)/i);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1].replace(',', '.'));
    const inYears = /tháng/i.test(singleMatch[2]) ? val / 12 : val;
    return [inYears, inYears];
  }

  return null;
};

const getExpBuckets = (raw?: string): ExpRangeLabel[] => {
  if (!isValidInfo(raw)) return [];
  const parsed = parseExpToYears(raw!);
  if (!parsed) return [];
  const [lo, hi] = parsed;

  return EXP_RANGES.filter((r) => {
    if (r.max === Infinity) {
      // "Trên 5 năm": hi phải STRICTLY > 5
      return hi > r.min;
    }
    if (r.label === '2 – 5 năm') {
      // đúng 5 năm → thuộc "2-5 năm" (không thuộc "Trên 5 năm")
      return lo <= r.max && hi >= r.min;
    }
    // Các bucket còn lại: khoảng [lo, hi] giao với [r.min, r.max)
    return lo < r.max && hi >= r.min;
  }).map((r) => r.label);
};

// ─── Filter State Types ────────────────────────────────────────────────────────

interface FilterState {
  keyword: string;
  locations: string[];
  categories: string[];
  workTypes: string[];
  levels: string[];
  experiences: string[];
  salaryBuckets: SalaryRangeLabel[];
}

const EMPTY_FILTERS: FilterState = {
  keyword: '',
  locations: [],
  categories: [],
  workTypes: [],
  levels: [],
  experiences: [],
  salaryBuckets: [],
};

const toggleItem = <T,>(arr: T[], item: T): T[] =>
  arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

// ─── Dropdown Filter Component ────────────────────────────────────────────────

interface DropdownFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  searchable?: boolean;
}

const DropdownFilter = ({ label, options, selected, onToggle, onClear, searchable }: DropdownFilterProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (options.length === 0) return null;
  const activeCount = selected.length;

  const filteredOptions = searchable && query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border transition-all duration-150 whitespace-nowrap cursor-pointer select-none ${activeCount > 0
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
          }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="bg-white text-blue-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {activeCount}
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px] max-w-[280px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            {activeCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
              >
                Xóa ({activeCount})
              </button>
            )}
          </div>

          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 placeholder-gray-400 text-slate-700"
              />
            </div>
          )}

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">Không tìm thấy lựa chọn</div>
            ) : (
              filteredOptions.map((opt) => {
                const isActive = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={(e) => { e.stopPropagation(); onToggle(opt); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-gray-50'
                      }`}
                  >
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isActive ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                      {isActive && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function JobSearchPage({ user }: { user?: any }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f2ee] flex items-center justify-center">Đang tải...</div>}>
      <JobSearchContent user={user} />
    </Suspense>
  );
}

function JobSearchContent({ user }: { user?: any }) {
  const searchParams = useSearchParams();

  // ── API state ──
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    ...EMPTY_FILTERS,
    keyword: searchParams?.get('keyword') || '',
    locations: searchParams?.getAll('location')?.length ? searchParams.getAll('location') : [],
    categories: searchParams?.getAll('category')?.length ? searchParams.getAll('category') : [],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 20;

  // ─── Fetch filter options once on mount ──────────────────────────────────
  React.useEffect(() => {
    fetch('/api/v1/jobs/options')
      .then(r => r.json())
      .then(d => {
        if (d.locations) setLocationOptions(d.locations);
        if (d.categories) setCategoryOptions(d.categories);
      });
  }, []);

  // ─── Fetch jobs from API on filter/page change ───────────────────────────
  const fetchJobs = React.useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    filters.locations.forEach(l => params.append('locations', l));
    filters.categories.forEach(c => params.append('categories', c));
    filters.workTypes.forEach(w => params.append('workTypes', w));
    filters.levels.forEach(l => params.append('levels', l));
    filters.experiences.forEach(e => params.append('experiences', e));
    filters.salaryBuckets.forEach(s => params.append('salaryBuckets', s));
    params.set('page', String(currentPage));

    fetch(`/api/v1/jobs/search?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setJobs(d.jobs || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [filters, currentPage]);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const toggleFilter = <K extends keyof FilterState>(key: K, item: string) => {
    setFilters((prev) => ({ ...prev, [key]: toggleItem(prev[key] as string[], item) as FilterState[K] }));
    setCurrentPage(1);
  };

  const hasActiveFilters =
    filters.keyword ||
    filters.locations.length ||
    filters.categories.length ||
    filters.workTypes.length ||
    filters.levels.length ||
    filters.experiences.length ||
    filters.salaryBuckets.length;

  // ─── Static option lists ──────────────────────────────────────────────────
  const WORK_TYPE_ALL = ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Thời vụ', 'Làm tại nhà'];
  const workTypeOptions = WORK_TYPE_ALL;
  const experienceOptions: ExpRangeLabel[] = EXP_RANGES.map(r => r.label) as ExpRangeLabel[];
  const salaryBucketOptions: SalaryRangeLabel[] = SALARY_RANGES.map(r => r.label) as SalaryRangeLabel[];
  const levelOptions: string[] = ['Thực tập sinh', 'Sinh viên', 'Nhân viên', 'Trưởng nhóm', 'Giám sát', 'Quản lý', 'Giám đốc'];

  // ─── Helpers used in card render ─────────────────────────────────────────
  const getLevels = (raw: string): string[] => {
    const text = raw.trim();
    if (!isValidInfo(text)) return [];
    if (/kỹ thuật viên\s*\/\s*kỹ sư/i.test(text)) return [];
    if (/thực tập sinh\s*\/\s*sinh viên|sinh viên\s*\/\s*thực tập sinh/i.test(text)) return ['Thực tập sinh', 'Sinh viên'];
    if (/trưởng nhóm\s*\/\s*giám sát|giám sát\s*\/\s*trưởng nhóm/i.test(text)) return ['Trưởng nhóm', 'Giám sát'];
    if (/quản lý/i.test(text)) return ['Quản lý'];
    return [text];
  };

  const filteredJobs = jobs; // Already filtered server-side
  const isExternalJobUrl = (url?: string) => typeof url === 'string' && /^https?:\/\//i.test(url);

  return (
    <div className="min-h-screen bg-[#f4f2ee] font-sans flex flex-col">

      {/* ── HEADER ── */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <span className="font-bold text-2xl text-slate-800">
            Career<span className="text-blue-600">Intel</span>
            <span className="block text-[10px] text-gray-500 font-normal -mt-1">Intelligent Job Market Hub</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          <Link href="/search" className="text-blue-600 border-b-2 border-blue-600 pb-1">Job Search</Link>
          <Link href="/insights" className="hover:text-blue-600 transition">Market Insights</Link>
          <Link href="/ai" className="hover:text-blue-600 transition">AI Assistant</Link>
          <Link href="/profile" className="hover:text-blue-600 transition">My Profile</Link>
        </div>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span>Hi, {user.user_metadata?.full_name || 'User'}</span>
              </div>
              <button onClick={() => logout()} className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm hidden md:block cursor-pointer">
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/signup">
                <button className="bg-[#f27a42] hover:bg-[#e06830] text-white px-6 py-2.5 rounded-md font-medium transition shadow-md hidden md:block">Sign Up</button>
              </Link>
              <Link href="/login">
                <button className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm hidden md:block">Log In</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── FILTER PANEL ── */}
      <div className="bg-[#1a4b6b] py-6 px-4 md:px-12 w-full shadow-inner">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Thanh tìm kiếm chính */}
          <div className="bg-white p-1.5 rounded-lg flex flex-col md:flex-row items-center gap-2 shadow-md">
            <div className="flex-1 flex items-center px-3 py-2 w-full">
              <Search className="text-gray-400 mr-2" size={20} />
              <input
                type="text"
                placeholder="Từ khóa, chức danh hoặc công ty"
                value={filters.keyword}
                onChange={(e) => update('keyword', e.target.value)}
                className="w-full outline-none text-slate-800 placeholder-gray-400 bg-transparent"
              />
            </div>



            <button
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setCurrentPage(1);
              }}
              className="w-full md:w-auto bg-[#2463eb] hover:bg-blue-700 text-white px-8 py-3 rounded-md font-bold transition"
            >
              XÓA TÌM KIẾM
            </button>
          </div>

          {/* ── DROPDOWN FILTERS ── */}
          <div className="flex flex-wrap gap-2 pt-1">
            <DropdownFilter
              label="Địa điểm"
              options={locationOptions}
              selected={filters.locations}
              onToggle={(v) => toggleFilter('locations', v)}
              onClear={() => update('locations', [])}
              searchable
            />
            <DropdownFilter
              label="Mức lương"
              options={salaryBucketOptions}
              selected={filters.salaryBuckets}
              onToggle={(v) => toggleFilter('salaryBuckets', v)}
              onClear={() => update('salaryBuckets', [])}
            />
            <DropdownFilter
              label="Ngành nghề"
              options={categoryOptions}
              selected={filters.categories}
              onToggle={(v) => toggleFilter('categories', v)}
              onClear={() => update('categories', [])}
              searchable
            />
            <DropdownFilter
              label="Hình thức"
              options={workTypeOptions}
              selected={filters.workTypes}
              onToggle={(v) => toggleFilter('workTypes', v)}
              onClear={() => update('workTypes', [])}
            />
            <DropdownFilter
              label="Cấp bậc"
              options={levelOptions}
              selected={filters.levels}
              onToggle={(v) => toggleFilter('levels', v)}
              onClear={() => update('levels', [])}
              searchable
            />
            <DropdownFilter
              label="Kinh nghiệm"
              options={experienceOptions}
              selected={filters.experiences}
              onToggle={(v) => toggleFilter('experiences', v)}
              onClear={() => update('experiences', [])}
            />
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setCurrentPage(1);
                }}
                className="text-blue-200 hover:text-white text-sm px-3 py-2 underline underline-offset-2 transition flex items-center gap-1"
              >
                <X size={13} /> Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto w-full px-4 md:px-12 py-10 flex-1">
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Kết quả tìm kiếm phù hợp
              {!isLoading && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({total} công việc)
                </span>
              )}
            </h2>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium text-slate-700 px-2">
                Trang {currentPage} / {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Danh sách việc làm */}
          <div className="flex flex-col gap-4 relative min-h-[300px]">
            {isLoading && (
              <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-sm text-gray-500 font-medium">Đang tải...</span>
                </div>
              </div>
            )}

            {!isLoading && filteredJobs.map((job, idx) => {
              const title = sanitizeDisplayValue(job.tieu_de || job.title);
              const company = sanitizeDisplayValue(job.cong_ty || job.company);
              const salary = sanitizeDisplayValue(job.muc_luong || job.salary);
              const location = sanitizeDisplayValue(cleanLocation(job.dia_diem || job.location));
              const exp = job.kinh_nghiem_lam_viec;
              const jobLevels = getLevels(job.cap_bac || '');
              const logo = job.logo || job.logo_url;
              const expireDate = sanitizeDisplayValue(job.thong_tin_tuyen_dung?.het_han_nop);
              const jobKey = job.url || `${title || 'job'}-${company || 'company'}-${idx}`;

              return (
                <Link key={jobKey} href={`/job/${encodeURIComponent(encodeURIComponent(jobKey))}`} className="block group">
                  <div className="bg-white px-4 py-3 rounded-lg border border-blue-200 group-hover:border-blue-400 group-hover:shadow-md transition duration-200 flex gap-4 items-start">
                    {/* Logo */}
                    <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 mt-1 border border-gray-100 relative overflow-hidden">
                      {isExternalJobUrl(logo) ? (
                        <>
                          <img
                            src={logo}
                            alt={isValidInfo(company) ? company : 'Company logo'}
                            className="w-full h-full object-contain rounded-lg"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <span className="logo-fallback font-bold text-gray-400 text-xs text-center absolute inset-0 hidden items-center justify-center bg-white">
                            {company ? company.substring(0, 4) : 'LOGO'}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold text-gray-400 text-xs text-center">
                          {company ? company.substring(0, 4) : 'LOGO'}
                        </span>
                      )}
                    </div>

                    {/* Thông tin */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-semibold text-[#3348a7] mb-1 group-hover:text-blue-700 transition truncate">
                        {isValidInfo(title) ? title : 'Chưa cập nhật chức danh'}
                      </h3>
                      {isValidInfo(company) && (
                        <p className="text-base md:text-lg text-slate-900 truncate uppercase font-bold mb-1">{company}</p>
                      )}

                      {/* Tags inline */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1">
                        {isValidInfo(job.hinh_thuc_lam_viec) && (
                          <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">{job.hinh_thuc_lam_viec}</span>
                        )}
                        {jobLevels.map((lvl, index) => (
                          <span key={index} className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">{lvl}</span>
                        ))}
                        {isValidInfo(exp) && (
                          <span className="text-[11px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-medium">{exp}</span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center justify-between gap-3">
                          {isValidInfo(salary) ? (
                            <span className="text-sm md:text-base text-slate-800 font-medium truncate">{salary}</span>
                          ) : (
                            <div className="flex-1"></div>
                          )}
                          <div className="text-[11px] md:text-xs text-gray-500 whitespace-nowrap text-right flex-shrink-0 ml-auto">
                            {isValidInfo(expireDate) ? `Hết hạn: ${expireDate}` : ''}
                          </div>
                        </div>
                        {isValidInfo(location) && (
                          <div className="text-sm text-gray-500 truncate flex items-center gap-1.5">
                            <MapPin size={14} className="flex-shrink-0" />
                            <span className="truncate">{location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {!isLoading && filteredJobs.length === 0 && (
              <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500">Không có kết quả phù hợp với bộ lọc hiện tại.</p>
              </div>
            )}

            {/* Pagination Controls at Bottom */}
            {!isLoading && filteredJobs.length > 0 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Trang trước
                </button>
                <span className="text-sm font-medium text-slate-700">
                  Trang {currentPage} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="px-4 py-2 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Trang sau
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
