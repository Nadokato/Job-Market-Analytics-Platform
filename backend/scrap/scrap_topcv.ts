import { chromium } from 'playwright';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Trích xuất ngày DD/MM/YYYY từ chuỗi chứa hạn nộp
const extractDate = (text?: string): string => {
  if (!text) return 'N/A';
  const match = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (match) {
    return `${match[1]}/${match[2]}/${match[3]}`;
  }
  return 'N/A';
};

export async function scrapeTopCV(maxPages = 1, limitJobs?: number): Promise<any[]> {
  console.log(`=== BẮT ĐẦU CÀO DỮ LIỆU TỪ TOPCV (Số trang tối đa: ${maxPages}, Giới hạn tin: ${limitJobs ?? 'Vô hạn'}) ===`);
  
  // Chạy headless: true để phù hợp với môi trường CI/CD GitHub Actions
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set User-Agent giả lập trình duyệt người dùng thật
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  const scrapedJobs: any[] = [];
  const seenUrls = new Set<string>();

  try {
    let allListJobs: any[] = [];

    // Duyệt qua số trang yêu cầu sử dụng query parameter ?page=X
    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
      const urlList = `https://www.topcv.vn/viec-lam-tot-nhat?page=${currentPage}`;
      console.log(`[TopCV] Đang quét danh sách tại Trang ${currentPage}: ${urlList}`);
      
      try {
        await page.goto(urlList, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await delay(3000); // Chờ render các tin tuyển dụng động

        const pageJobs = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.job-item-search-result, .job-item-default, .job-list-default, [class*="job-item"]'));
          
          return items.map(item => {
            const titleAnchor = item.querySelector('.title a, .job-title a, a[class*="title"], h3 a') as HTMLAnchorElement;
            const companyEl = item.querySelector('.company a, .company-name a, .company-title a, .company, .company-name, .company-title, [class*="company"]');
            const companyText = companyEl?.textContent?.trim() || 'N/A';
            const salaryEl = item.querySelector('.salary, .label-salary, [class*="salary"]');
            const locationEl = item.querySelector('.address, .location, [class*="address"]');
            const logoImg = item.querySelector('.avatar img, .logo img, img[class*="logo"]') as HTMLImageElement;

            if (!titleAnchor || !titleAnchor.href) return null;

            return {
              tieu_de: titleAnchor.textContent?.trim() || 'N/A',
              url: titleAnchor.href,
              cong_ty: companyText !== 'N/A' ? companyText.replace(/\s+/g, ' ').trim() : 'N/A',
              muc_luong: salaryEl?.textContent?.trim() || 'N/A',
              dia_diem: locationEl?.textContent?.trim() || 'N/A',
              logo: logoImg?.src || 'N/A'
            };
          }).filter((j): j is NonNullable<typeof j> => j !== null);
        });

        // Lọc trùng trong cùng một trang và gộp vào danh sách tổng
        for (const job of pageJobs) {
          if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url);
            allListJobs.push(job);
          }
        }
        console.log(`   -> Tìm thấy thêm ${pageJobs.length} tin (Tổng danh sách thô: ${allListJobs.length} tin)`);

      } catch (pageErr) {
        console.error(`❌ Lỗi khi quét danh sách Trang ${currentPage}:`, (pageErr as Error).message);
      }
    }

    const jobsToScrape = limitJobs ? allListJobs.slice(0, limitJobs) : allListJobs;
    console.log(`\nTiến hành cào chi tiết ${jobsToScrape.length} tin tuyển dụng đã lọc...`);

    // Duyệt cào chi tiết từng công việc
    for (let i = 0; i < jobsToScrape.length; i++) {
      const job = jobsToScrape[i];
      console.log(`[TopCV Chi tiết ${i + 1}/${jobsToScrape.length}] Đang cào: ${job.url}`);
      
      const detailPage = await browser.newPage();
      try {
        await detailPage.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await delay(2500); // Chờ trang hiển thị hết dữ liệu động

        const detailData = await detailPage.evaluate(() => {
          const clean = (text?: string | null) => (text || '').replace(/\s+/g, ' ').trim();

          const getTextBySelector = (selectors: string[]) => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el && el.textContent?.trim()) return el.textContent.trim();
            }
            return '';
          };

          // 1. Trích xuất Mô tả, Yêu cầu, Quyền lợi bằng tiêu đề thông minh
          const getLongTextByHeading = (keywords: string[]) => {
            const headings = Array.from(document.querySelectorAll('h2, h3, h4, h5, .title, .content-title, .box-title, .job-detail__info--title, p strong, div strong'));
            
            for (const el of headings) {
              const text = (el.textContent || '').toLowerCase().trim();
              if (text.length < 80 && keywords.some((k) => text.includes(k))) {
                let content: string[] = [];
                let nextNode: Element | null = el.nextElementSibling;
                
                if (!nextNode && el.parentElement) {
                  nextNode = el.parentElement.nextElementSibling;
                }

                let loops = 0;
                while (nextNode && loops < 12) {
                  const tagName = nextNode.tagName.toLowerCase();
                  
                  if (
                    ['h2', 'h3', 'h4'].includes(tagName) || 
                    (nextNode.className && typeof nextNode.className === 'string' && 
                     (nextNode.className.toLowerCase().includes('title') || nextNode.className.toLowerCase().includes('heading')))
                  ) {
                    break;
                  }

                  if (tagName === 'ul' || tagName === 'ol') {
                    const lis = nextNode.querySelectorAll('li');
                    lis.forEach(li => content.push('- ' + clean(li.textContent)));
                  } else {
                    const textContent = clean(nextNode.textContent);
                    if (textContent && textContent !== clean(el.textContent)) {
                      content.push(textContent);
                    }
                  }

                  nextNode = nextNode.nextElementSibling;
                  loops++;
                }

                if (content.length > 0) return content.join('\n').substring(0, 1500);

                const parentText = el.parentElement?.textContent || '';
                if (parentText.length > (el.textContent?.length || 0) + 30) {
                  const idx = parentText.indexOf(el.textContent || '');
                  if (idx !== -1) {
                    const afterHeading = parentText.substring(idx + (el.textContent?.length || 0)).trim();
                    return clean(afterHeading).substring(0, 1500);
                  }
                }
              }
            }
            return '';
          };

          // 2. Trích xuất chính xác nhãn Chuyên môn
          const getChuyenMonTags = (): string => {
            const results = new Set<string>();
            const allElements = Array.from(document.querySelectorAll('div, p, span, li, strong, b, td, th, [class*="title"], [class*="label"]'));
            
            for (const el of allElements) {
              const text = clean(el.textContent);
              if (text.toLowerCase() === 'chuyên môn' || text.toLowerCase() === 'chuyên môn:' || /^chuyên môn\s*:/i.test(text)) {
                const parent = el.closest('div, li, tr, .job-detail__info-item, .job-detail__info--section') || el.parentElement;
                if (parent) {
                  const childTags = Array.from(parent.querySelectorAll('a, span, [class*="tag"], [class*="badge"]'))
                    .filter(child => child !== el && !clean(child.textContent).toLowerCase().includes('chuyên môn'))
                    .map(child => clean(child.textContent))
                    .filter(t => t && t.length > 1 && t.length < 35 && !/(hà nội|hồ chí minh|đà nẵng|cần thơ|hải phòng|fulltime|parttime)/i.test(t));
                  
                  if (childTags.length > 0) {
                    childTags.forEach(tag => results.add(tag));
                    break;
                  }
                }

                const parts = text.split(/[:\-]/);
                if (parts.length > 1) {
                  const val = clean(parts.slice(1).join(':'));
                  if (val && val.toLowerCase() !== 'chuyên môn') {
                    val.split(',').forEach(v => {
                      const cleanV = clean(v);
                      if (cleanV) results.add(cleanV);
                    });
                    break;
                  }
                }
              }
            }

            if (results.size > 0) {
              return Array.from(results).join(', ');
            }

            const fallbackTags = Array.from(document.querySelectorAll('a[href*="/tim-viec-lam/"], .tag-list a, .job-tags a, .job-tag'))
              .map(a => clean(a.textContent))
              .filter(t => t && (t.includes('Developer') || t.includes('Lập trình') || t.includes('Phần mềm') || t.includes('IT') || t.includes('CNTT') || t.includes('QA') || t.includes('Tester') || t.includes('Designer')))
              .slice(0, 3);
              
            if (fallbackTags.length > 0) {
              return Array.from(new Set(fallbackTags)).join(', ');
            }
            
            return 'IT Phần mềm';
          };

          // 3. Trích xuất nhãn metadata chung tránh nhầm lẫn
          const getMetadataByLabel = (label: string, blacklistKeywords: string[]): string => {
            const nodes = Array.from(document.querySelectorAll('li, div, p, span, .job-detail__info-item, .job-detail__info--section'));
            
            for (const node of nodes) {
              if (node.closest('.job-related, .box-job-related, .suggest-jobs, [class*="suggest"], [class*="related"]')) {
                continue;
              }

              const text = clean(node.textContent);
              
              if (
                text.length > 3 && 
                text.length < 80 && 
                text.toLowerCase().includes(label.toLowerCase()) &&
                !blacklistKeywords.some(bk => text.toLowerCase().includes(bk.toLowerCase()))
              ) {
                const parts = text.split(/[:\-]/);
                if (parts.length > 1) {
                  const cleaned = clean(parts.slice(1).join(':'));
                  if (cleaned && cleaned.length < 35) return cleaned;
                }
                
                const nextEl = node.nextElementSibling;
                if (nextEl) {
                  const nextText = clean(nextEl.textContent);
                  if (nextText && nextText.length < 30 && !blacklistKeywords.some(bk => nextText.toLowerCase().includes(bk.toLowerCase()))) {
                    return nextText;
                  }
                }
              }
            }
            return 'N/A';
          };

          const moTa = getLongTextByHeading(['mô tả công việc', 'nhiệm vụ', 'công việc phải làm', 'mô tả']);
          const yeuCau = getLongTextByHeading(['yêu cầu ứng viên', 'yêu cầu công việc', 'yêu cầu tuyển dụng', 'yêu cầu chuyên môn', 'yêu cầu', 'kỹ năng']);
          const quyenLoi = getLongTextByHeading(['quyền lợi', 'phúc lợi', 'chế độ đãi ngộ', 'chế độ', 'benefits']);

          const hetHanRaw = getMetadataByLabel('hạn nộp', ['lương', 'địa điểm', 'công ty', 'kinh nghiệm']) || 
                             getMetadataByLabel('hạn nhận', ['lương', 'địa điểm', 'công ty', 'kinh nghiệm']) || 
                             getMetadataByLabel('hạn cuối', ['lương', 'địa điểm', 'công ty', 'kinh nghiệm']);

          return {
            mo_ta_cong_viec: moTa || 'N/A',
            yeu_cau_cong_viec: yeuCau || 'N/A',
            quyen_loi: quyenLoi || 'N/A',
            het_han_nop_raw: hetHanRaw || 'N/A',
            nganh_nghe: getChuyenMonTags(),
            cap_bac: getMetadataByLabel('cấp bậc', ['lương', 'địa điểm', 'kinh nghiệm', 'công ty']) || 
                     getMetadataByLabel('chức vụ', ['lương', 'địa điểm', 'kinh nghiệm', 'công ty']) || 'N/A',
            kinh_nghiem_lam_viec: getMetadataByLabel('kinh nghiệm', ['lương', 'địa điểm', 'công ty', 'misa', 'tuyển dụng', 'triệu']) || 'N/A',
            hinh_thuc_lam_viec: getMetadataByLabel('hình thức', ['lương', 'địa điểm', 'kinh nghiệm', 'công ty']) || 
                                 getMetadataByLabel('loại hình', ['lương', 'địa điểm', 'kinh nghiệm', 'công ty']) || 'N/A',
            cong_ty_detail: getTextBySelector(['.company-title a', '.company-name', '.company-title', '[class*="company"]'])
          };
        });

        const deadlineDate = extractDate(detailData.het_han_nop_raw);

        scrapedJobs.push({
          ...job,
          cong_ty: detailData.cong_ty_detail !== 'N/A' && detailData.cong_ty_detail ? detailData.cong_ty_detail : job.cong_ty,
          hinh_thuc_lam_viec: detailData.hinh_thuc_lam_viec,
          nganh_nghe: detailData.nganh_nghe,
          cap_bac: detailData.cap_bac,
          kinh_nghiem_lam_viec: detailData.kinh_nghiem_lam_viec,
          thong_tin_tuyen_dung: {
            ngay_cap_nhat: new Date().toLocaleDateString('vi-VN'),
            het_han_nop: deadlineDate,
            mo_ta_cong_viec: detailData.mo_ta_cong_viec,
            yeu_cau_cong_viec: detailData.yeu_cau_cong_viec,
            quyen_loi: detailData.quyen_loi,
            dia_diem_lam_viec: job.dia_diem,
          }
        });
        
        console.log(`   -> Cào chi tiết thành công: "${job.tieu_de}"`);

      } catch (err) {
        console.error(`   ❌ Lỗi khi cào chi tiết: ${job.url}:`, (err as Error).message);
      } finally {
        await detailPage.close();
      }

      // Theo yêu cầu của USER: delay 7 giây giống hệt JobOKO để an toàn tối đa cho IP
      if (i < jobsToScrape.length - 1) {
        console.log('   Chờ 7 giây trước khi cào job tiếp theo...');
        await delay(7000);
      }
    }

  } catch (error) {
    console.error('Lỗi nghiêm trọng trong scraper TopCV:', error);
  } finally {
    await browser.close();
  }

  console.log(`=== HOÀN THÀNH CÀO TOPCV: Thu thập được ${scrapedJobs.length} records ===\n`);
  return scrapedJobs;
}
