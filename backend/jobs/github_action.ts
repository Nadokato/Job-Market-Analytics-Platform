import { createClient } from '@supabase/supabase-js';
import { scrapeJoboko, checkJobExists } from '../scrap/scrap';
import { scrapeTopCV } from '../scrap/scrap_topcv';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Kiểm tra các biến môi trường bắt buộc
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ LỖI HỆ THỐNG: Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY!');
  process.exit(1);
}

// Kết nối Supabase bằng Service Role Key (để bypass RLS và có quyền xóa/thêm dữ liệu)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Chạy tối đa `limit` tasks cùng lúc (worker pool pattern).
 * Mỗi worker tự lấy task tiếp theo khi hoàn thành — đảm bảo luôn đúng `limit` concurrent.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  // Tạo đúng `limit` workers chạy song song, mỗi worker tự lấy task tiếp theo khi xong
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runAllJobs() {
  console.log('=== BẮT ĐẦU CHẠY GITHUB ACTIONS ===');
  
  // -----------------------------------------------------
  // 1. CÀO DỮ LIỆU MỚI
  // -----------------------------------------------------
  console.log('\n[1/3] Đang cào dữ liệu mới từ JobOKO...');
  const jobokoResults = await scrapeJoboko(2); // Cào 2 trang đầu tiên của JobOKO

  console.log('\n[1.5/3] Đang cào dữ liệu mới từ TopCV...');
  let topcvResults: any[] = [];
  try {
    // Cào đúng 1 trang 1 lần, không giới hạn số lượng tin chi tiết
    topcvResults = await scrapeTopCV(1);
  } catch (err) {
    console.error('❌ Lỗi khi chạy scraper TopCV:', (err as Error).message);
  }

  // Gộp kết quả cào từ cả 2 nguồn
  const results = [...jobokoResults, ...topcvResults];
  
  if (results.length > 0) {
    // FastAPI is not started in CI. Normalization runs offline via fix_khac_offline.py
    // Direct upsert raw data to Supabase — offline normalizer will process afterward.
    console.log(`Tiến hành lưu thẳng ${results.length} jobs vào Supabase (raw data, sẽ được chuẩn hóa offline)...`);
    
    let failCount = 0;
    
    for (const job of results) {
      const { error: upsertErr } = await supabase.from('jobs').upsert({
        url: job.url,
        tieu_de: job.tieu_de,
        cong_ty: job.cong_ty,
        dia_diem: job.dia_diem,
        muc_luong: job.muc_luong,
        logo: job.logo,
        hinh_thuc_lam_viec: job.hinh_thuc_lam_viec,
        nganh_nghe: job.nganh_nghe,
        cap_bac: job.cap_bac,
        kinh_nghiem_lam_viec: job.kinh_nghiem_lam_viec,
        thong_tin_tuyen_dung: job.thong_tin_tuyen_dung,
      }, { onConflict: 'url' });

      if (upsertErr) {
        console.error(`❌ Không thể lưu tin tuyển dụng vào Supabase:`, upsertErr.message);
        failCount++;
      } else {
        console.log(`✅ Đã lưu: ${job.tieu_de}`);
      }
    }
    
    console.log(`Hoàn tất: ${results.length - failCount} thành công, ${failCount} thất bại.`);
  } else {
    console.log('Không tìm thấy dữ liệu mới nào.');
  }

  // -----------------------------------------------------
  // 2. XÓA TIN TUYỂN DỤNG HẾT HẠN
  // -----------------------------------------------------
  console.log('\n[2/3] Quét và xóa các tin tuyển dụng đã quá hạn nộp...');
  const { data: expiredJobs, error: errExpired } = await supabase.from('jobs').select('url, thong_tin_tuyen_dung');
  
  if (errExpired) {
    console.error('Lỗi khi fetch jobs để xóa:', errExpired);
  } else {
    const expiredUrls: string[] = [];
    const now = new Date();
    
    for (const j of expiredJobs || []) {
      const hetHan = j.thong_tin_tuyen_dung?.het_han_nop;
      if (hetHan && hetHan !== 'N/A') {
        const parts = hetHan.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts;
          const expDate = new Date(`${yyyy}-${mm}-${dd}`);
          
          if (expDate < now) {
            expiredUrls.push(j.url);
          }
        }
      }
    }
    
    if (expiredUrls.length > 0) {
      console.log(`Phát hiện ${expiredUrls.length} tin đã quá hạn. Đang tiến hành xóa hàng loạt theo lô...`);
      
      const batchSize = 50;
      let deleteSuccessCount = 0;
      let deleteFailCount = 0;
      
      for (let offset = 0; offset < expiredUrls.length; offset += batchSize) {
        const batch = expiredUrls.slice(offset, offset + batchSize);
        const { error: deleteErr } = await supabase.from('jobs').delete().in('url', batch);
        
        if (deleteErr) {
          console.error(`❌ Lỗi khi xóa lô tin quá hạn (offset: ${offset}):`, deleteErr.message);
          deleteFailCount += batch.length;
        } else {
          deleteSuccessCount += batch.length;
        }
      }
      
      console.log(`✅ Đã xóa thành công ${deleteSuccessCount} tin tuyển dụng quá hạn, thất bại ${deleteFailCount} tin.`);
    } else {
      console.log('Không có tin tuyển dụng nào bị quá hạn.');
    }
  }

  // -----------------------------------------------------
  // 3. KIỂM TRA TIN N/A
  // -----------------------------------------------------
  console.log('\n[3/3] Kiểm tra độ sống sót của các tin N/A (song song, 10 URL cùng lúc)...');

  const CONCURRENCY_LIMIT = 10;

  const { data: naJobs, error: errNa } = await supabase
    .from('jobs')
    .select('url, thong_tin_tuyen_dung')
    .eq('thong_tin_tuyen_dung->>het_han_nop', 'N/A'); // Lọc thẳng trên DB

  if (errNa) {
    console.error('Lỗi khi fetch jobs N/A:', errNa);
  } else {
    const urlsToCheck = (naJobs || []).map(j => j.url);
    console.log(`Tổng số URL N/A cần check: ${urlsToCheck.length}`);

    const deadUrls: string[] = [];

    // Tạo danh sách tasks — mỗi task là 1 hàm trả về Promise
    const tasks = urlsToCheck.map((url) => async () => {
      const exists = await checkJobExists(url);
      if (!exists) {
        console.log(`-> Link đã chết: ${url}`);
        deadUrls.push(url);
      }
      return exists;
    });

    // Chạy song song với giới hạn 10 concurrent
    await runWithConcurrency(tasks, CONCURRENCY_LIMIT);

    // Đóng shared browser sau khi check xong toàn bộ
    const { closeSharedBrowser } = await import('../scrap/scrapers/joboko');
    await closeSharedBrowser();

    // Xóa các URL đã chết
    if (deadUrls.length > 0) {
      console.log(`Phát hiện ${deadUrls.length} tin N/A đã chết. Đang tiến hành xóa...`);
      const batchSize = 50;
      let deleteSuccessCount = 0;
      let deleteFailCount = 0;

      for (let offset = 0; offset < deadUrls.length; offset += batchSize) {
        const batch = deadUrls.slice(offset, offset + batchSize);
        const { error: deleteErr } = await supabase.from('jobs').delete().in('url', batch);
        if (deleteErr) {
          deleteFailCount += batch.length;
        } else {
          deleteSuccessCount += batch.length;
        }
      }

      console.log(`✅ Đã xóa ${deleteSuccessCount} tin N/A chết, thất bại ${deleteFailCount}.`);
    } else {
      console.log('Không phát hiện tin N/A nào bị chết.');
    }
  }

  console.log('\n=== HOÀN TẤT GITHUB ACTIONS ===');
  process.exit(0); // Tắt tiến trình thành công
}

runAllJobs().catch((err) => {
  console.error('Lỗi hệ thống nghiêm trọng:', err);
  process.exit(1);
});
