import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';

// Delay giữa mỗi lần cào chi tiết job
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

const toAbsoluteUrlNode = (urlRaw?: string | null) => {
  if (!urlRaw) return '';
  if (urlRaw.startsWith('http')) return urlRaw;
  try {
    return new URL(urlRaw, 'https://vn.joboko.com').href;
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

// Chỉ chấp nhận kinh nghiệm dạng số năm hoặc số tháng, VD: "2 năm", "3-5 năm", "6 tháng", "Dưới 1 năm"
// Trả về phần đã chuẩn hóa (cắt bỏ phần thừa đằng sau), hoặc null nếu không khớp
const normalizeExperience = (value?: string): string | null => {
  const text = normalizeText(value);
  if (!text || text.toLowerCase() === 'n/a') return null;

  // Pattern: tùy chọn prefix (dưới/trên/từ/hơn/không yêu cầu/chưa có) + số/khoảng số + đơn vị (năm/tháng)
  const match = text.match(
    /(?:(không yêu cầu|chưa có kinh nghiệm)|((?:dưới|trên|từ|hơn|ít nhất|tối thiểu)\s*)?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:năm|tháng))/i
  );

  if (!match) return null;
  // match[1]: trường hợp "không yêu cầu" / "chưa có kinh nghiệm"
  // match[0]: full match bao gồm prefix + số + đơn vị
  return match[0].replace(/\s+/g, ' ').trim();
};

const looksLikeExperience = (value?: string): boolean => normalizeExperience(value) !== null;

// Chỉ chấp nhận hình thức làm việc hợp lệ — loại bỏ "loại hình kinh doanh" hoặc text tùy tiện khác
const looksLikeWorkType = (value?: string): boolean => {
  const text = normalizeText(value).toLowerCase();
  if (!text || text === 'n/a') return false;
  return /toàn thời gian|bán thời gian|thực tập|intern(?:ship)?|thời vụ|hợp đồng ngắn hạn|freelance|nghề tự do|làm tại nhà|làm ở nhà|remote|hybrid|work from home|wfh|full[.\-\s]?time|part[.\-\s]?time|tạm thời|contract/i.test(text);
};

// Chỉ chấp nhận cấp bậc hợp lệ — loại bỏ các giá trị ngẫu nhiên từ mô tả/yêu cầu
const looksLikeLevel = (value?: string): boolean => {
  const text = normalizeText(value).toLowerCase();
  if (!text || text === 'n/a') return false;
  // Blacklist: các fragment thường xuất hiện trong mô tả công việc, yêu cầu ngoại hình, v.v.
  if (/(tương đương|năm kinh nghiệm|tốt, ưa nhìn|ưa nhìn|ngoại hình|nhà hàng|khách sạn|hệ thống|cơng vị)/i.test(text)) return false;
  // Whitelist: các từ khóa cấp bậc chuẩn
  return /(nhân viên|chuyên viên|trưởng phòng|giám đốc|quản lý|thực tập|intern|senior|junior|leader|manager|cấp cao|cấp trung|phó giám đốc|tổng giám đốc|trưởng nhóm|nhân viên kỹ thuật|kỹ sư)/i.test(text);
};
const normalizeLocation = (value?: string): string | null => {
  const text = normalizeText(value);
  if (!text || text.length > 80) return null;
  if (/(chức vụ|kinh nghiệm|khách|chuyên viên|nhân viên|trưởng phòng|giám đốc|thực tập sinh|kỹ sư|quản lý|tuyển dụng|sale)/i.test(text)) return null;
  const match = text.match(/(hà nội|hồ chí minh|đà nẵng|cần thơ|hải phòng|toàn quốc|bắc ninh|đồng nai|bình dương|khánh hòa|kiên giang|nghệ an|thanh hóa|hải dương|thái nguyên|vĩnh phúc|thái bình|nước ngoài|ngoài nước)/i);
  if (match) {
    const w = match[0].toLowerCase();
    return w.split(' ').map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' ');
  }
  return null;
};

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

async function scrapeJoboko() {
  console.log('Khởi chạy trình duyệt (Headless mode: false)...');
  const browser: Browser = await chromium.launch({ headless: false });
  const page: Page = await browser.newPage();

  // Fix ReferenceError: __name is not defined do ESBuild/TSX chèn ngầm vào code
  await page.addInitScript(`window.__name = (func, name) => func;`);

  const results: any[] = [];

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
    const startUrl = 'https://vn.joboko.com/viec-lam-moi?p=12'; // THAY ĐỔI LINK Ở ĐÂY NẾU MUỐN
    console.log(`Truy cập trang chủ tuyển dụng: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    let allListJobs: any[] = [];
    const maxPages = 3; // SỐ TRANG TỐI ĐA MUỐN CÀO (BẠN CÓ THỂ TĂNG LƯỢNG NÀY LÊN 5-10)

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      console.log(`Đang quét danh sách việc làm tại Trang ${currentPage}...`);

      const pageJobs = await page.evaluate(() => {
        const toAbsoluteUrl = (url?: string | null) => {
          if (!url) return '';
          try {
            return new URL(url, window.location.origin).href;
          } catch {
            return '';
          }
        };

        const clean = (text?: string | null) => (text || '').replace(/\s+/g, ' ').trim();
        const looksLikeSalary = (text: string) => /(triệu|vnd|thỏa thuận|cạnh tranh|thương lượng)/i.test(text);
        const extractLocation = (text: string) => {
          const match = text.match(/(hà nội|hồ chí minh|đà nẵng|cần thơ|hải phòng|nước ngoài|toàn quốc|bắc ninh|đồng nai|bình dương)/i);
          if (match) {
            return match[0].split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          }
          return 'N/A';
        };
        const looksLikeLocation = (text: string) => extractLocation(text) !== 'N/A';
        const isRecruitmentLink = (href: string) => {
          if (!href) return false;
          if (!href.includes('vn.joboko.com')) return false;
          const url = new URL(href);
          const pathname = url.pathname.toLowerCase();
          if (!(pathname.startsWith('/viec-lam-') || pathname.includes('/viec-lam/'))) return false;
          // Job detail trên JobOKO thường có hậu tố mã tin dạng -xvi1234567
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
              if (looksLikeSalary(t) || /(hà nội|hồ chí minh|đà nẵng|cần thơ|hải phòng|nước ngoài|toàn quốc|bắc ninh|đồng nai|bình dương)/i.test(t) || isBadgeOrTag(t) || t === title || t.length < 3 || t.length > 120) return false;
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
              // Nếu không thấy img nào trong class chuẩn, lấy img hợp lệ đầu tiên
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
      });

      allListJobs = [...allListJobs, ...pageJobs];

      // Thử tự động bấm sang trang kế tiếp
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
        await page.waitForTimeout(4000); // Chờ trang mới load
      }
    } // kết thúc for loop duyệt trang

    // Lọc lại toàn bộ tin bài tránh trùng lặp nếu ấn nút Xem thêm (Load more)
    const seenMap = new Set<string>();
    const listJobs = allListJobs.filter((item) => {
      const key = `${item.url}__${item.tieu_de.toLowerCase()}`;
      if (seenMap.has(key)) return false;
      seenMap.add(key);
      return true;
    });

    console.log(`Tìm thấy ${listJobs.length} tin tuyển dụng từ JobOKO.`);

    for (let i = 0; i < listJobs.length; i++) {
      const listJob = listJobs[i];
      console.log(`\n[${i + 1}/${listJobs.length}] Đang cào chi tiết: ${listJob.url}`);

      const jobPage = await browser.newPage();
      await jobPage.addInitScript(`window.__name = (func, name) => func;`);

      try {
        await jobPage.goto(listJob.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await jobPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);

        const detailData = await jobPage.evaluate(() => {
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

                  // Handle lists properly to keep some formatting
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

                // Fallback: extract from parent container text
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
            // 1. Lấy từ biến toàn cục objInfoPage (dành cho Brand Page như SeABank)
            try {
              // @ts-ignore
              if (window.objInfoPage && window.objInfoPage.InfoJob && Array.isArray(window.objInfoPage.InfoJob.Keywords)) {
                // @ts-ignore
                const keywords = window.objInfoPage.InfoJob.Keywords.map(k => k.Value).filter(Boolean);
                if (keywords.length > 0) return keywords.join(', ');
              }
            } catch (e) { }

            // 2. Lấy từ các class HTML phổ biến
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

        results.push({
          ...listJob,
          tieu_de: detailData.tieu_de || listJob.tieu_de,
          cong_ty: pickCleanValue([detailData.cong_ty, listJob.cong_ty]),
          dia_diem: normalizeLocation(pickCleanValue([detailData.dia_diem, listJob.dia_diem], looksLikeLocation)) || 'N/A',
          muc_luong: pickCleanValue([detailData.muc_luong, listJob.muc_luong], looksLikeSalary),
          logo: toAbsoluteUrlNode(detailData.logo) || listJob.logo,
          hinh_thuc_lam_viec: pickCleanValue([detailData.hinh_thuc_lam_viec], looksLikeWorkType),
          nganh_nghe: pickCleanValue([detailData.nganh_nghe]) !== 'N/A' ? pickCleanValue([detailData.nganh_nghe]) : extractTagFromUrl(listJob.url),
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
      } catch (err) {
        console.error(`Lỗi khi cào chi tiết ${listJob.url}:`, (err as Error).message);
      } finally {
        await jobPage.close();
      }

      // Theo yêu cầu: delay 7 giây giữa mỗi lần cào
      if (i < listJobs.length - 1) {
        console.log('Đợi 7 giây trước khi cào job tiếp theo...');
        await delay(7000);
      }
    }

    // Ghi kết quả ra file JSON local ở thư mục root để theo dõi (Front-end step)
    fs.writeFileSync('scraped_data.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('\n--- HOÀN THÀNH ---');
    console.log(`Đã lưu ${results.length} record(s) vào file scraped_data.json`);

  } catch (error) {
    console.error('Lỗi tiến trình:', error);
  } finally {
    await browser.close();
  }
}

scrapeJoboko();
