/**
 * TopCV CV Template Scraper
 * 
 * Luồng hoạt động (2 tầng):
 * 1. Truy cập https://www.topcv.vn/mau-cv → phân loại link: detail vs category
 * 2. Vào từng category page → dùng .cv-img__link để lấy link detail cụ thể
 * 3. Vào từng detail page → tìm iframe preview-cv-template
 * 4. Điều hướng đến URL iframe → chụp ảnh screenshot CV (A4 format)
 * 5. Lưu ảnh vào cv_templates_output/ và ghi metadata ra JSON
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ─── Cấu hình ──────────────────────────────────────────────────────────────
const CONFIG = {
  LIST_URL: 'https://www.topcv.vn/mau-cv',
  OUTPUT_DIR: path.join(process.cwd(), 'cv_templates_output'),
  RESULTS_FILE: path.join(process.cwd(), 'cv_templates_output', 'cv_templates.json'),
  DELAY_BETWEEN_TEMPLATES: 3000,      // ms giữa mỗi template
  DELAY_AFTER_IFRAME_LOAD: 3000,      // ms chờ iframe cv render xong
  PAGE_TIMEOUT: 60000,
  SCREENSHOT_CLIP: null as null | { x: number; y: number; width: number; height: number },
  // Bật headless: false để debug trực quan, true cho production
  HEADLESS: false,
  // Bỏ qua bước quét 79 category pages (nhanh hơn, chỉ dùng 228 link trực tiếp)
  // Đặt false để quét đầy đủ và lấy tất cả template từ category pages
  SKIP_CATEGORY_SCAN: true,
  // Giới hạn số template tối đa sẽ xử lý (0 = không giới hạn)
  // Hữu ích để chạy thử nhanh, ví dụ: MAX_TEMPLATES: 10
  MAX_TEMPLATES: 0,
};

// ─── Utility ────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').toLowerCase();

// ─── Types ──────────────────────────────────────────────────────────────────
interface CVTemplateItem {
  slug: string;
  name: string;
  template_page_url: string;
  preview_iframe_url: string;
  screenshot_path: string;
  scraped_at: string;
}

// ─── Hàm phân biệt: category page hay detail page? ──────────────────────────
// Detail page: có iframe preview → slug thường chứa 'mau-cv-' hoặc là slug cụ thể như 'default_v2'
// Category page: trang danh sách phong cách → slug chỉ là 'mau-don-gian', 'mau-chuyen-nghiep', v.v.
function isDetailPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const slug = pathname.split('/').filter(Boolean).pop() || '';

    // Các slug thuần category — không có iframe
    const categoryOnlySlugs = [
      'mau-don-gian', 'mau-an-tuong', 'mau-chuyen-nghiep', 'mau-harvard',
      'mau-cv-theo-vi-tri-cong-viec', 'mau-cv-tieng-viet', 'mau-cv-tieng-anh',
      'mau-cv-theo-nganh-nghe', 'mau-cv-theo-phong-cach', 'mau-cv-2-cot',
      'mau-cv-mau-sac', 'mau-cv-co-ban', 'mau-cv-sac-net', 'mau-cv-hien-dai',
      'mau-cv-biet-thu', 'mau-cv-thiet-ke', 'mau-cv-nau', 'mau-cv-xanh',
      'mau-cv-do', 'mau-cv-vang', 'mau-cv-tim', 'mau-cv-cam', 'mau-cv-den',
    ];
    if (categoryOnlySlugs.includes(slug)) return false;

    // Slug dạng ngành nghề cụ thể: mau-cv-{ten-vi-tri} → detail page
    if (/^mau-cv-[a-z]/.test(slug)) return true;

    // Slug dạng default_v2, onepage_v3, pro_1_v2 → detail page
    if (/^(default|onepage|pro|minimal|creative|classic|modern|fresh|elegant|bold)(_v\d+)?$/.test(slug)) return true;

    // slug có nhiều hơn 3 phần nối gạch ngang, bắt đầu bằng 'mau-cv' → thường là detail
    if (slug.split('-').length >= 3 && slug.startsWith('mau-cv')) return true;

    return false;
  } catch {
    return false;
  }
}

// ─── Hàm 1: Lấy danh sách tất cả link detail template (2 tầng) ──────────────
async function fetchTemplateLinks(
  page: Page,
  browser: Browser
): Promise<{ slug: string; name: string; url: string }[]> {
  console.log(`\n📋 Truy cập trang danh sách CV: ${CONFIG.LIST_URL}`);
  await page.goto(CONFIG.LIST_URL, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  // ── Tầng 1: Thu thập tất cả link từ trang /mau-cv ─────────────────────
  const allLinks = await page.evaluate(() => {
    const results: { slug: string; name: string; url: string }[] = [];
    const seen = new Set<string>();
    const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];

    for (const anchor of anchors) {
      const href = anchor.href || '';
      if (!href.includes('topcv.vn/mau-cv')) continue;
      if (href === 'https://www.topcv.vn/mau-cv' || href === 'https://www.topcv.vn/mau-cv/') continue;
      if (seen.has(href)) continue;
      seen.add(href);

      const urlObj = new URL(href);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const slug = pathParts[pathParts.length - 1] || 'unknown';
      const name = ((anchor.closest('.template-cv-item, .cv-item, li, div')
        ?.querySelector('.name, .title, h3, h4, span') as HTMLElement | null)
        ?.textContent ?? anchor.textContent ?? slug)
        .replace(/\s+/g, ' ').trim()
        .replace(/^(Mẫu CV|CV)\s*/i, '').trim() || slug;

      if (slug && slug !== 'mau-cv' && slug.length > 2) {
        results.push({ slug, name, url: href });
      }
    }
    return results;
  });

  const detailLinks: { slug: string; name: string; url: string }[] = [];
  const categoryLinks: { slug: string; name: string; url: string }[] = [];

  for (const link of allLinks) {
    if (isDetailPage(link.url)) detailLinks.push(link);
    else categoryLinks.push(link);
  }

  console.log(`  → Trang chính: ${detailLinks.length} detail link + ${categoryLinks.length} category link`);

  if (CONFIG.SKIP_CATEGORY_SCAN) {
    console.log('  ⏭️  Bỏ qua quét category (SKIP_CATEGORY_SCAN = true). Dùng 228 link trực tiếp.');
  } else {
    // ── Tầng 2: Vào từng category page để lấy thêm detail links ─────────
    const seenUrls = new Set<string>(detailLinks.map((d) => d.url));

    for (let i = 0; i < categoryLinks.length; i++) {
      const cat = categoryLinks[i];
      console.log(`  📂 [${i + 1}/${categoryLinks.length}] Quét category: "${cat.slug}"`);

      const catPage: Page = await browser.newPage();
      try {
        await catPage.goto(cat.url, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });
        await catPage.waitForTimeout(2000);

        const subLinks = await catPage.evaluate(() => {
          const results: { slug: string; name: string; url: string }[] = [];
          const selectors = [
            'a.cv-img__link',
            '.template-cv-item a[href]',
            '.cv-item a[href*="/mau-cv"]',
          ];
          const seen = new Set<string>();

          for (const sel of selectors) {
            for (const anchor of Array.from(document.querySelectorAll(sel)) as HTMLAnchorElement[]) {
              const href = anchor.href || '';
              if (!href.includes('topcv.vn') || seen.has(href)) continue;
              seen.add(href);

              const parts = new URL(href).pathname.split('/').filter(Boolean);
              const slug = parts[parts.length - 1] || '';
              const container = anchor.closest('.template-cv-item, .cv-item, li') || anchor;
              const name = ((container.querySelector('.name, .title, h3, span') as HTMLElement | null)
                ?.textContent ?? anchor.textContent ?? slug)
                .replace(/\s+/g, ' ').trim();

              if (slug.length > 2) results.push({ slug, name, url: href });
            }
          }
          return results;
        });

        for (const sub of subLinks) {
          if (!seenUrls.has(sub.url) && isDetailPage(sub.url)) {
            seenUrls.add(sub.url);
            detailLinks.push(sub);
          }
        }
      } catch (err) {
        console.warn(`    ⚠️  Lỗi quét category: ${(err as Error).message}`);
      } finally {
        await catPage.close();
      }
      await delay(1000);
    }
  }

  const finalLinks = CONFIG.MAX_TEMPLATES > 0 ? detailLinks.slice(0, CONFIG.MAX_TEMPLATES) : detailLinks;
  console.log(`✅ Sẽ xử lý: ${finalLinks.length} detail template links${CONFIG.MAX_TEMPLATES > 0 ? ` (giới hạn ${CONFIG.MAX_TEMPLATES})` : ''}`);
  return finalLinks;
}

// ─── Hàm 2: Lấy URL preview iframe từ trang chi tiết template ───────────────
async function fetchPreviewIframeUrl(page: Page, templateUrl: string): Promise<string | null> {
  await page.goto(templateUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });
  await page.waitForTimeout(2000);

  const iframeSrc = await page.evaluate(() => {
    // Selector theo phân tích HTML: iframe#preview-cv hoặc src chứa preview-cv-template
    const iframe =
      document.querySelector('iframe#preview-cv') as HTMLIFrameElement ||
      document.querySelector('iframe[src*="preview-cv-template"]') as HTMLIFrameElement ||
      document.querySelector('iframe[src*="topcv.vn/preview"]') as HTMLIFrameElement;

    if (iframe) return iframe.src || iframe.getAttribute('src') || null;

    // Fallback: tìm trong tất cả iframe
    const allIframes = Array.from(document.querySelectorAll('iframe')) as HTMLIFrameElement[];
    for (const f of allIframes) {
      const src = f.src || f.getAttribute('src') || '';
      if (src.includes('preview') || src.includes('template')) return src;
    }
    return null;
  });

  return iframeSrc || null;
}

// ─── Hàm 3: Chụp ảnh screenshot CV preview ──────────────────────────────────
async function screenshotCVPreview(
  browser: Browser,
  previewUrl: string,
  outputPath: string
): Promise<boolean> {
  const cvPage: Page = await browser.newPage();

  try {
    // Set viewport lớn để hiển thị đầy đủ CV (A4-like)
    await cvPage.setViewportSize({ width: 794, height: 1123 }); // A4 @ 96dpi

    await cvPage.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });

    // Chờ CV render xong (font, ảnh, layout đều load)
    await cvPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
    await cvPage.waitForTimeout(CONFIG.DELAY_AFTER_IFRAME_LOAD);

    // Chụp toàn bộ trang
    await cvPage.screenshot({
      path: outputPath,
      fullPage: true,
      ...(CONFIG.SCREENSHOT_CLIP ? { clip: CONFIG.SCREENSHOT_CLIP } : {}),
    });

    return true;
  } catch (err) {
    console.error(`    ❌ Lỗi chụp ảnh: ${(err as Error).message}`);
    return false;
  } finally {
    await cvPage.close();
  }
}

// ─── Hàm main ────────────────────────────────────────────────────────────────
async function scrapeTopCVTemplates() {
  // Tạo thư mục output nếu chưa có
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`📁 Tạo thư mục output: ${CONFIG.OUTPUT_DIR}`);
  }

  console.log('🚀 Khởi chạy trình duyệt Playwright...');
  const browser: Browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // Tránh bị phát hiện là bot
    ],
  });

  // Context với user-agent thực tế để vượt qua anti-bot cơ bản của TopCV
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    viewport: { width: 1440, height: 900 },
  });

  const listPage: Page = await context.newPage();
  const results: CVTemplateItem[] = [];

  try {
    // ── Bước 1: Lấy danh sách link template ──────────────────────────────
    const templateLinks = await fetchTemplateLinks(listPage, browser);

    if (templateLinks.length === 0) {
      console.error('⚠️  Không tìm thấy link template nào. Kiểm tra lại selector hoặc trang đã bị thay đổi.');
      return;
    }

    // ── Bước 2 + 3: Xử lý từng template ─────────────────────────────────
    for (let i = 0; i < templateLinks.length; i++) {
      const { slug, name, url } = templateLinks[i];
      console.log(`\n[${i + 1}/${templateLinks.length}] 🎨 Template: "${name}" (${slug})`);
      console.log(`    🔗 Trang chi tiết: ${url}`);

      const templatePage: Page = await context.newPage();

      try {
        // Bước 2: Lấy URL preview iframe
        const previewUrl = await fetchPreviewIframeUrl(templatePage, url);

        if (!previewUrl) {
          console.warn(`    ⚠️  Không tìm thấy iframe preview trên trang: ${url}`);
          results.push({
            slug,
            name,
            template_page_url: url,
            preview_iframe_url: '',
            screenshot_path: '',
            scraped_at: new Date().toISOString(),
          });
          continue;
        }

        console.log(`    🖼️  Preview URL: ${previewUrl}`);

        // Bước 3: Chụp ảnh screenshot
        const screenshotFileName = `${sanitizeFileName(slug)}.png`;
        const screenshotAbsPath = path.join(CONFIG.OUTPUT_DIR, screenshotFileName);

        console.log(`    📸 Đang chụp ảnh screenshot...`);
        const success = await screenshotCVPreview(browser, previewUrl, screenshotAbsPath);

        if (success) {
          console.log(`    ✅ Đã lưu screenshot: ${screenshotAbsPath}`);
        }

        results.push({
          slug,
          name,
          template_page_url: url,
          preview_iframe_url: previewUrl,
          screenshot_path: success ? screenshotAbsPath : '',
          scraped_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`    ❌ Lỗi xử lý template "${slug}": ${(err as Error).message}`);
        results.push({
          slug,
          name,
          template_page_url: url,
          preview_iframe_url: '',
          screenshot_path: '',
          scraped_at: new Date().toISOString(),
        });
      } finally {
        await templatePage.close();
      }

      // Delay giữa các template để tránh bị chặn
      if (i < templateLinks.length - 1) {
        console.log(`    ⏳ Đợi ${CONFIG.DELAY_BETWEEN_TEMPLATES / 1000}s trước template tiếp theo...`);
        await delay(CONFIG.DELAY_BETWEEN_TEMPLATES);
      }
    }

    // ── Bước 4: Lưu kết quả ra file JSON ─────────────────────────────────
    const successCount = results.filter((r) => r.screenshot_path !== '').length;
    const failCount = results.length - successCount;

    fs.writeFileSync(CONFIG.RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 HOÀN THÀNH!');
    console.log(`   📊 Tổng: ${results.length} template`);
    console.log(`   ✅ Thành công: ${successCount} screenshot`);
    console.log(`   ❌ Thất bại: ${failCount}`);
    console.log(`   📄 Metadata JSON: ${CONFIG.RESULTS_FILE}`);
    console.log(`   📁 Thư mục ảnh:  ${CONFIG.OUTPUT_DIR}`);
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('❌ Lỗi tiến trình chính:', error);
  } finally {
    await listPage.close();
    await context.close();
    await browser.close();
    console.log('🔒 Đã đóng trình duyệt.');
  }
}

// ─── Chạy ────────────────────────────────────────────────────────────────────
scrapeTopCVTemplates();
