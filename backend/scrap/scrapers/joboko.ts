import { chromium, type Browser, type Page } from 'playwright';
import { ScraperInterface, ScraperConfig, RawJob } from '../types';
import { normalizeLocation, CITY_PATTERNS } from '../../elasticsearch/helpers';

// ─── Shared Browser Singleton ───────────────────────────────────────────────
// Dùng lại 1 browser instance cho toàn bộ quá trình kiểm tra job chết.
// Tránh việc khởi động/đóng browser riêng cho mỗi URL (rất nặng và chậm).
let _sharedBrowser: Browser | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (!_sharedBrowser || !_sharedBrowser.isConnected()) {
    console.log('[checkJobExists] Khởi động shared browser...');
    _sharedBrowser = await chromium.launch({ headless: true });
  }
  return _sharedBrowser;
}

/**
 * Đóng shared browser và giải phóng tài nguyên.
 * Phải gọi hàm này sau khi hoàn tất toàn bộ batch checkJobExists.
 */
export async function closeSharedBrowser(): Promise<void> {
  if (_sharedBrowser) {
    console.log('[checkJobExists] Đóng shared browser...');
    await _sharedBrowser.close();
    _sharedBrowser = null;
  }
}
// ────────────────────────────────────────────────────────────────────────────

// Helper functions specifically for JobOKO scraping and normalization
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Thử lại một hàm async với exponential backoff.
 * @param fn - Hàm async cần thử lại
 * @param soLanThuToiDa - Số lần thử tối đa (mặc định: 3)
 * @param delayCoSoMs - Thời gian chờ ban đầu tính bằng mili giây (mặc định: 2000ms)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  soLanThuToiDa: number = 3,
  delayCoSoMs: number = 2000
): Promise<T> {
  let loiCuoi: unknown;

  for (let lan = 1; lan <= soLanThuToiDa; lan++) {
    try {
      return await fn();
    } catch (loi) {
      loiCuoi = loi;
      if (lan < soLanThuToiDa) {
        const thoiGianChoMs = delayCoSoMs * Math.pow(2, lan - 1); // 2s, 4s, 8s
        console.warn(
          `[Retry] Lần thử ${lan}/${soLanThuToiDa} thất bại. Thử lại sau ${thoiGianChoMs}ms...`,
          loi instanceof Error ? loi.message : loi
        );
        await new Promise((resolve) => setTimeout(resolve, thoiGianChoMs));
      }
    }
  }

  throw loiCuoi;
}
const normalizeText = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

const toAbsoluteUrlNode = (urlRaw: string | null | undefined, baseUrl: string) => {
  if (!urlRaw) return '';
  if (urlRaw.startsWith('http')) return urlRaw;
  try {
    return new URL(urlRaw, baseUrl).href;
  } catch {
    return urlRaw;
  }
};

const isNoiseText = (value?: string) => {
  const text = normalizeText(value).toLowerCase();
  if (!text) return true;
  const noiseFragments = [
    'gross - net',
    'tính thuế thu nhập cá nhân',
    'tính bảo hiểm thất nghiệp',
    'tính bảo hiểm xã hội 1 lần',
    'tool check chống lừa đảo',
    'cẩm nang nghề nghiệp',
    'kỹ năng trong phỏng vấn',
    'mẹo/bí quyết/kinh nghiệm',
    'oko - skill training',
    'hoạt động joboko',
    'career insights',
  ];
  return noiseFragments.some((fragment) => text.includes(fragment));
};

const looksLikeSalary = (value?: string) => /(triệu|vnd|vnđ|thỏa thuận|cạnh tranh|thương lượng|không giới hạn|upto|usd)/i.test(normalizeText(value));

const normalizeExperience = (value?: string): string | null => {
  const text = normalizeText(value);
  if (!text || text.toLowerCase() === 'n/a') return null;

  const match = text.match(
    /(?:(không yêu cầu|chưa có kinh nghiệm)|((?:dưới|trên|từ|hơn|ít nhất|tối thiểu)\s*)?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:năm|tháng))/i
  );

  if (!match) return null;
  return match[0].replace(/\s+/g, ' ').trim();
};

const looksLikeExperience = (value?: string): boolean => normalizeExperience(value) !== null;

const looksLikeWorkType = (value?: string): boolean => {
  const text = normalizeText(value).toLowerCase();
  if (!text || text === 'n/a') return false;
  return /toàn thời gian|bán thời gian|thực tập|intern(?:ship)?|thời vụ|hợp đồng ngắn hạn|freelance|nghề tự do|làm tại nhà|làm ở nhà|remote|hybrid|work from home|wfh|full[.\-\s]?time|part[.\-\s]?time|tạm thời|contract/i.test(text);
};

const looksLikeLevel = (value?: string): boolean => {
  const text = normalizeText(value).toLowerCase();
  if (!text || text === 'n/a') return false;
  if (/(tương đương|năm kinh nghiệm|tốt, ưa nhìn|ưa nhìn|ngoại hình|nhà hàng|khách sạn|hệ thống|cơng vị)/i.test(text)) return false;
  return /(nhân viên|chuyên viên|trưởng phòng|giám đốc|quản lý|thực tập|intern|senior|junior|leader|manager|cấp cao|cấp trung|phó giám đốc|tổng giám đốc|trưởng nhóm|nhân viên kỹ thuật|kỹ sư)/i.test(text);
};

// normalizeLocation đã được import từ @/backend/elasticsearch/helpers
// Dùng toàn bộ 63+ CITY_PATTERNS làm source of truth thay vì ~15 thành phố cứng
const looksLikeLocation = (value?: string) => normalizeLocation(value) !== null;

const isJobRole = (text: string) => /(nhân viên|chuyên viên|kế toán|giám sát|quản lý|trưởng phòng|giám đốc|thực tập sinh|kỹ sư|trợ lý|phó|công nhân|thợ)/i.test(text);
const hasCompanyKeyword = (text: string) => /(công ty|tập đoàn|tnhh|cp|jsc|group|ngân hàng|trung tâm|bệnh viện|phòng khám|trường|viện|hệ thống|chi nhánh)/i.test(text);

const looksLikeCompany = (value?: string) => {
  const text = normalizeText(value);
  if (!text || text.length < 3 || text.length > 120) return false;
  if (/^(hot|gấp|mới|vip|kết hợp|toàn thời gian|bán thời gian|ưu tiên|nổi bật)$/i.test(text)) return false;
  if (isJobRole(text) && !hasCompanyKeyword(text)) return false;
  return true;
};

const pickCleanValue = (values: Array<string | undefined>, validator?: (v?: string) => boolean) => {
  for (const value of values) {
    const cleaned = normalizeText(value);
    if (!cleaned || cleaned === 'N/A') continue;
    if (cleaned.length > 140) continue;
    if (isNoiseText(cleaned)) continue;
    if (validator && !validator(cleaned)) continue;
    return cleaned;
  }
  return 'N/A';
};

export class JobokoScraper implements ScraperInterface {
  readonly sourceName = 'joboko';

  async scrapeListings(config: ScraperConfig): Promise<RawJob[]> {
    const maxPages = config.maxPages;
    const delayMs = config.delayMs;
    const siteUrl = config.siteUrl;
    const limitJobs = config.limitJobs;

    console.log(`Khởi chạy trình duyệt (Headless mode: true, maxPages: ${maxPages}, limitJobs: ${limitJobs ?? 'vô hạn'}, delayMs: ${delayMs})...`);
    const browser: Browser = await chromium.launch({ headless: true });
    const page: Page = await browser.newPage();

    // Fix ReferenceError: __name is not defined do ESBuild/TSX chèn ngầm vào code
    await page.addInitScript(`window.__name = (func, name) => func;`);

    const results: RawJob[] = [];

    const extractTagFromUrl = (url: string) => {
      try {
        const path = new URL(url).pathname; // e.g. /viec-lam-nhan-vien-ke-toan-xvi1234
        const match = path.match(/\/viec-lam-(.*?)-xvi/);
        if (match && match[1]) {
          const words = match[1].split('-');
          // Nếu slug quá dài (chứa cả địa điểm tuyển dụng), gom vào tag "Phổ biến"
          if (words.length > 5) return 'Phổ biến';
          return words.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
        }
      } catch (e) { }
      return 'Phổ biến';
    };

    try {
      // Dựng URL bắt đầu từ base siteUrl
      // Nếu siteUrl có sẵn query p=1 thì dùng, không thì tự ghép. 
      // vn.joboko.com thường dùng /viec-lam-moi?p=1
      const startUrl = siteUrl.includes('?') ? `${siteUrl}` : `${siteUrl}/viec-lam-moi?p=1`;
      console.log(`Truy cập trang chủ tuyển dụng: ${startUrl}`);
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
      await delay(3000); // Chờ render đầy đủ các tin tuyển dụng động

      let allListJobs: any[] = [];

      for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
        console.log(`Đang quét danh sách việc làm tại Trang ${currentPage}...`);

        const pageJobs = await page.evaluate(({ baseUrl, cityPatterns }: { baseUrl: string; cityPatterns: string[] }) => {
          const toAbsoluteUrl = (url?: string | null) => {
            if (!url) return '';
            try {
              return new URL(url, baseUrl).href;
            } catch {
              return '';
            }
          };

          const clean = (text?: string | null) => (text || '').replace(/\s+/g, ' ').trim();
          const looksLikeSalary = (text: string) => /(triệu|vnd|thỏa thuận|cạnh tranh|thương lượng)/i.test(text);
          // Danh sách đầy đủ 63+ thành phố — đồng bộ với CITY_PATTERNS trong helpers.ts
          // Được inject từ Node.js vào browser context qua tham số của page.evaluate()
          const FULL_CITY_LIST = cityPatterns;
          const extractLocation = (text: string) => {
            const lower = text.toLowerCase();
            const matched = FULL_CITY_LIST.find((city: string) => lower.includes(city.toLowerCase()));
            return matched || 'N/A';
          };
          const looksLikeLocation = (text: string) => extractLocation(text) !== 'N/A';
          const isRecruitmentLink = (href: string) => {
            if (!href) return false;
            if (!href.includes('vn.joboko.com') && !href.includes(window.location.hostname)) return false;
            const url = new URL(href);
            const pathname = url.pathname.toLowerCase();
            if (!(pathname.startsWith('/viec-lam-') || pathname.includes('/viec-lam/'))) return false;
            if (!/-xvi\d+\/?$/i.test(pathname)) return false;
            if (pathname.includes('/tim-viec-lam')) return false;
            if (/(dieu-khoan|chinh-sach|gioi-thieu|lien-he|dang-nhap|dang-ky|tuyen-dung-hieu-qua)/i.test(pathname)) return false;
            if (/\/(tag|cong-ty|tin-tuc|cv|blog)\//i.test(pathname)) return false;
            return true;
          };

          const seen = new Set<string>();

          const jobs = Array.from(document.querySelectorAll('a[href]'))
            .map((anchor) => {
              const a = anchor as HTMLAnchorElement;
              const href = toAbsoluteUrl(a.getAttribute('href'));
              if (!isRecruitmentLink(href)) return null;

              const title = clean(a.textContent);
              if (!title || title.length < 8) return null;
              if (/^(nộp đơn|xem thêm|hot)$/i.test(title)) return null;
              if (/^\d[\d,.]*\s+việc làm/i.test(title)) return null;
              if (/(điều khoản|chính sách|đăng nhập|đăng ký|tạo cv|quên mật khẩu)/i.test(title)) return null;

              const getLeafTexts = (element: Element) => {
                const texts = new Set<string>();
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
                let node;
                while (node = walker.nextNode()) {
                  const text = node.nodeValue?.replace(/\s+/g, ' ').trim();
                  if (text && text.length > 1) texts.add(text);
                }
                return Array.from(texts);
              };

              const container = a.closest('article, li, .job-item, .item, .box-job, .job-card') || a.parentElement?.parentElement || a;
              const texts = getLeafTexts(container)
                .filter((t) => t && t.length < 150);

              const isBadgeOrTag = (text: string) => /^(hot|gấp|mới|vip|kết hợp|toàn thời gian|bán thời gian|ưu tiên|nổi bật)$/i.test(text);
              const isRole = (text: string) => /(nhân viên|chuyên viên|kế toán|giám sát|quản lý|trưởng phòng|giám đốc|thực tập sinh|kỹ sư|trợ lý|phó|công nhân|thợ)/i.test(text);
              const hasCompanyKW = (text: string) => /(công ty|tập đoàn|tnhh|cp|jsc|group|ngân hàng|trung tâm|bệnh viện|phòng khám|trường|viện|hệ thống|chi nhánh)/i.test(text);

              const salary = texts.find((t) => looksLikeSalary(t) && t.length <= 120) || 'N/A';
              const locationRaw = texts.find((t) => looksLikeLocation(t) && t.length <= 120);
              const location = locationRaw ? extractLocation(locationRaw) : 'N/A';
              const company = texts.find((t) => {
                if (looksLikeSalary(t) || looksLikeLocation(t) || isBadgeOrTag(t) || t === title || t.length < 3 || t.length > 120) return false;
                if (isRole(t) && !hasCompanyKW(t)) return false;
                return true;
              }) || 'N/A';
              const logoRaw = (() => {
                const imgs = Array.from(container.querySelectorAll('img'));
                for (const img of imgs) {
                  const src = img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('data-src') || img.getAttribute('src') || '';
                  if (src && !src.startsWith('data:') && !src.includes('qr-downloadapp')) {
                    const classes = ((img.parentElement?.className || '') + ' ' + (img.className || '')).toLowerCase();
                    if (classes.includes('logo') || classes.includes('company') || classes.includes('hero') || img.alt.toLowerCase().includes('công ty')) {
                      return src;
                    }
                  }
                }
                for (const img of imgs) {
                  const src = img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('data-src') || img.getAttribute('src') || '';
                  if (src && !src.startsWith('data:') && !src.includes('qr-downloadapp')) {
                    return src;
                  }
                }
                return '';
              })();

              return {
                url: href,
                tieu_de: title,
                cong_ty: company,
                dia_diem: location,
                muc_luong: salary,
                logo: toAbsoluteUrl(logoRaw) || 'N/A',
                hinh_thuc_lam_viec: 'N/A',
                nganh_nghe: 'N/A',
                cap_bac: 'N/A',
                kinh_nghiem_lam_viec: 'N/A',
                thong_tin_tuyen_dung: {
                  ngay_cap_nhat: 'N/A',
                  het_han_nop: 'N/A',
                  mo_ta_cong_viec: 'Không có thông tin',
                  yeu_cau_cong_viec: 'Không có thông tin',
                  dia_diem_lam_viec: location,
                },
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          return jobs;
        }, { baseUrl: siteUrl, cityPatterns: CITY_PATTERNS });

        allListJobs = [...allListJobs, ...pageJobs];

        if (currentPage < maxPages) {
          const hasNext = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('a, button, span')).filter(el => {
              const t = el.textContent?.trim().toLowerCase() || '';
              return t === 'sau' || t === 'tiếp' || t === 'tiếp theo' || t === 'next' || t === 'xem thêm' || t === '>' || t === '>>';
            });
            const validBtn = btns.find(b => b.tagName === 'A' || b.tagName === 'BUTTON') || document.querySelector('[aria-label="Next"], [aria-label="Sau"], [rel="next"], .next a, .pagination-next a, .view-more');
            if (validBtn) {
              (validBtn as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (!hasNext) {
            console.log(`Không tìm thấy nút sang trang tiếp theo ở Trang ${currentPage}. Ngưng quét list job.`);
            break;
          }
          await delay(3000); // Chờ trang mới load
        }
      }

      const seenMap = new Set<string>();
      const listJobs = allListJobs.filter((item) => {
        const key = `${item.url}__${item.tieu_de.toLowerCase()}`;
        if (seenMap.has(key)) return false;
        seenMap.add(key);
        return true;
      });

      const jobsToScrape = limitJobs ? listJobs.slice(0, limitJobs) : listJobs;
      for (let i = 0; i < jobsToScrape.length; i++) {
        const listJob = jobsToScrape[i];
        console.log(`\n[${i + 1}/${jobsToScrape.length}] Đang cào chi tiết: ${listJob.url}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let detailData: Record<string, any> | null = null;

        const scrapeDetailPage = async () => {
          const jobPage = await browser.newPage();
          await jobPage.addInitScript(`window.__name = (func, name) => func;`);
          try {
            await jobPage.goto(listJob.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await jobPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);

            const data = await jobPage.evaluate(() => {
            const textBySelectors = (selectors: string[]) => {
              for (const selector of selectors) {
                const text = document.querySelector(selector)?.textContent?.trim();
                if (text) return text;
              }
              return '';
            };

            const getTextByLabel = (label: string) => {
              const nodes = Array.from(document.querySelectorAll('li, div, p, span')).reverse();
              for (const node of nodes) {
                const text = (node.textContent || '').replace(/\s+/g, ' ').trim();

                if (text.length > 3 && text.length < 60 && text.toLowerCase().includes(label.toLowerCase())) {
                  if (text.toLowerCase() === label.toLowerCase() || text.toLowerCase() === label.toLowerCase() + ':') {
                    const nextText = (node.nextElementSibling?.textContent || '').replace(/\s+/g, ' ').trim();
                    if (nextText && nextText.length < 60) return nextText;
                  }

                  if (text.includes(':') || text.toLowerCase().startsWith(label.toLowerCase())) {
                    const value = text.split(new RegExp(label, 'i')).slice(1).join(label);
                    const cleaned = value.replace(/^[\s:\-]+/, '').trim();
                    if (cleaned) return cleaned;
                  }
                }
              }
              return '';
            };

            const getLongTextByHeading = (keywords: string[]) => {
              const headings = Array.from(document.querySelectorAll('h2, h3, h4, h5, .title, .content-title, .box-title, p strong, div strong'));
              for (const el of headings) {
                const text = (el.textContent || '').toLowerCase();
                if (text.length < 100 && keywords.some((k) => text.includes(k))) {
                  let content = [];
                  let nextNode: Element | null = el.nextElementSibling;
                  if (!nextNode && el.parentElement) {
                    nextNode = el.parentElement.nextElementSibling;
                  }

                  let loops = 0;
                  while (nextNode && loops < 15) {
                    const tagName = nextNode.tagName.toLowerCase();
                    if (['h2', 'h3', 'h4'].includes(tagName) || (nextNode.className && typeof nextNode.className === 'string' && nextNode.className.toLowerCase().includes('title'))) {
                      break;
                    }

                    if (tagName === 'ul' || tagName === 'ol') {
                      const lis = nextNode.querySelectorAll('li');
                      lis.forEach(li => content.push('- ' + (li.textContent || '').replace(/\s+/g, ' ').trim()));
                    } else {
                      const textContent = (nextNode.textContent || '').replace(/\s+/g, ' ').trim();
                      if (textContent && textContent !== el.textContent) {
                        content.push(textContent);
                      }
                    }

                    nextNode = nextNode.nextElementSibling;
                    loops++;
                  }

                  if (content.length > 0) return content.join('\n').substring(0, 1500);

                  const parentText = el.parentElement?.textContent || '';
                  if (parentText.length > (el.textContent?.length || 0) + 20) {
                    const afterHeading = parentText.substring(parentText.indexOf(el.textContent || '') + (el.textContent?.length || 0)).trim();
                    return afterHeading.replace(/\s+/g, ' ').substring(0, 1500);
                  }
                }
              }
              return '';
            };

            const getTagsFromPage = () => {
              try {
                // @ts-ignore
                if (window.objInfoPage && window.objInfoPage.InfoJob && Array.isArray(window.objInfoPage.InfoJob.Keywords)) {
                  // @ts-ignore
                  const keywords = window.objInfoPage.InfoJob.Keywords.map(k => k.Value).filter(Boolean);
                  if (keywords.length > 0) return keywords.join(', ');
                }
              } catch (e) { }

              const tagNodes = document.querySelectorAll('.job-tags a, .tags a, .tag-list a, .keyword a, [class*="tag"] a');
              if (tagNodes.length > 0) {
                return Array.from(tagNodes).map(n => n.textContent?.trim()).filter(Boolean).join(', ');
              }
              return getTextByLabel('Từ khóa') || getTextByLabel('Ngành nghề') || getTextByLabel('Lĩnh vực');
            };

            return {
              tieu_de: textBySelectors(['h1', '.job-title', '.title-job', '.title-detail', '.nw-job-detail__layout h1', '.nw-company-hero__title']),
              cong_ty: textBySelectors([
                '.nw-company-hero__text',
                '.nw-sidebar-company__title',
                '.nw-job-detail__layout .nw-company-hero__inner a',
                '.company-name',
                '.company-name a',
                '.employer-name',
                '.job-company a',
                '[class*="company"] a',
                '[class*="company-name"]',
                '.name-company',
                '.company-title',
                '.box-company h3',
                '.info-company a',
                'a.text-dark'
              ]),
              dia_diem: getTextByLabel('Nơi làm việc') || getTextByLabel('Địa điểm') || getTextByLabel('Khu vực'),
              muc_luong: getTextByLabel('Thu nhập') || getTextByLabel('Mức lương') || getTextByLabel('Lương'),
              hinh_thuc_lam_viec: getTextByLabel('Hình thức') || getTextByLabel('Loại hình') || getTextByLabel('Loại công việc'),
              nganh_nghe: getTagsFromPage(),
              cap_bac: getTextByLabel('Chức vụ') || getTextByLabel('Cấp bậc'),
              kinh_nghiem_lam_viec: getTextByLabel('Kinh nghiệm'),
              ngay_cap_nhat: getTextByLabel('Ngày cập nhật'),
              het_han_nop: getTextByLabel('Hạn nộp') || getTextByLabel('Hết hạn nộp'),
              mo_ta_cong_viec: getLongTextByHeading(['mô tả công việc', 'mô tả chi tiết', 'chi tiết công việc']),
              yeu_cau_cong_viec: getLongTextByHeading(['yêu cầu ứng viên', 'yêu cầu công việc', 'yêu cầu chuyên môn', 'yêu cầu', 'kỹ năng', 'tiêu chuẩn']),
              quyen_loi: getLongTextByHeading(['quyền lợi', 'phúc lợi', 'chế độ đãi ngộ', 'benefits']),
              logo: (() => {
                const imgs = Array.from(document.querySelectorAll('.company-logo img, .employer-logo img, .logo-box img, img.logo, .nw-company-hero__inner img, .nw-sidebar-company__head img, img[alt*="công ty"], img[alt*="logo"]'));
                for (const img of imgs) {
                  const src = img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('data-src') || img.getAttribute('src') || '';
                  if (src && !src.startsWith('data:') && !src.includes('qr-downloadapp')) return src;
                }
                return '';
              })(),
            };
            });
            return data;
          } finally {
            await jobPage.close();
          }
        };

        try {
          detailData = await retryWithBackoff(scrapeDetailPage, 3, 2000);
        } catch (err) {
          console.error(
            `[Scraper] Đã thử 3 lần nhưng vẫn thất bại với ${listJob.url}:`,
            err instanceof Error ? err.message : err
          );
        }

        if (detailData) {
          results.push({
            ...listJob,
            tieu_de: detailData.tieu_de || listJob.tieu_de,
            cong_ty: pickCleanValue([detailData.cong_ty, listJob.cong_ty]),
            dia_diem: normalizeLocation(pickCleanValue([detailData.dia_diem, listJob.dia_diem], looksLikeLocation)) || 'N/A',
            muc_luong: pickCleanValue([detailData.muc_luong, listJob.muc_luong], looksLikeSalary),
            logo: toAbsoluteUrlNode(detailData.logo, siteUrl) || listJob.logo,
            hinh_thuc_lam_viec: pickCleanValue([detailData.hinh_thuc_lam_viec], looksLikeWorkType),
            nganh_nghe: extractTagFromUrl(listJob.url),
            cap_bac: pickCleanValue([detailData.cap_bac], looksLikeLevel),
            kinh_nghiem_lam_viec: normalizeExperience(detailData.kinh_nghiem_lam_viec) ?? 'N/A',
            thong_tin_tuyen_dung: {
              ngay_cap_nhat: pickCleanValue([detailData.ngay_cap_nhat]),
              het_han_nop: pickCleanValue([detailData.het_han_nop]),
              mo_ta_cong_viec: detailData.mo_ta_cong_viec || 'N/A',
              yeu_cau_cong_viec: detailData.yeu_cau_cong_viec || 'N/A',
              quyen_loi: detailData.quyen_loi || 'N/A',
              dia_diem_lam_viec: normalizeLocation(pickCleanValue([detailData.dia_diem, listJob.dia_diem], looksLikeLocation)) || 'N/A',
            },
          });
        }

        if (i < listJobs.length - 1) {
          console.log(`Đoạn delay giữa các job: ${delayMs}ms...`);
          await delay(delayMs);
        }
      }

      console.log('\n--- HOÀN THÀNH ---');
      console.log(`Đã thu thập ${results.length} record(s)`);
      return results;

    } catch (error) {
      console.error('Lỗi tiến trình:', error);
      return [];
    } finally {
      await browser.close();
    }
  }

  async checkJobExists(url: string): Promise<boolean> {
    // Dùng shared browser thay vì tạo browser mới mỗi lần.
    // Nếu có 500 job chết → chỉ 1 browser được mở, tiết kiệm tài nguyên đáng kể.
    const browser = await getSharedBrowser();
    const page = await browser.newPage();
    await page.addInitScript(`window.__name = (func, name) => func;`);

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response || !response.ok()) return false;

      const isExpired = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes('không tìm thấy việc làm') ||
          text.includes('tin tuyển dụng đã hết hạn') ||
          text.includes('tin tuyển dụng này đã đóng') ||
          text.includes('việc làm này không còn tồn tại') ||
          text.includes('dừng nhận hồ sơ') ||
          text.includes('ngừng nhận hồ sơ') ||
          text.includes('đã đóng ứng tuyển')
        );
      });
      if (isExpired) return false;

      return true;
    } catch {
      return false;
    } finally {
      // Chỉ đóng PAGE, không đóng browser — browser được tái sử dụng cho lần gọi tiếp theo.
      await page.close();
    }
  }
}
