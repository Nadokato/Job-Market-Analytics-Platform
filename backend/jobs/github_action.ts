import { createClient } from '@supabase/supabase-js';
import { scrapeJoboko, checkJobExists } from '../scrap/scrap';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Kết nối Supabase bằng Service Role Key (để có quyền xóa/thêm dữ liệu)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runAllJobs() {
  console.log('=== BẮT ĐẦU CHẠY GITHUB ACTIONS ===');
  
  // -----------------------------------------------------
  // 1. CÀO DỮ LIỆU MỚI
  // -----------------------------------------------------
  console.log('\n[1/3] Đang cào dữ liệu mới từ JobOKO...');
  const results = await scrapeJoboko();
  
  if (results.length > 0) {
    console.log(`Tiến hành lưu ${results.length} jobs vào Supabase...`);
    const { error } = await supabase.from('jobs').upsert(results, { onConflict: 'url' });
    if (error) {
      console.error('Lỗi khi insert vào Supabase:', error);
    } else {
      console.log('Lưu Database thành công!');
    }
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
    let deletedExpiredCount = 0;
    for (const j of expiredJobs || []) {
      const hetHan = j.thong_tin_tuyen_dung?.het_han_nop;
      if (hetHan && hetHan !== 'N/A') {
        const parts = hetHan.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts;
          const expDate = new Date(`${yyyy}-${mm}-${dd}`);
          const now = new Date();
          
          if (expDate < now) {
            await supabase.from('jobs').delete().eq('url', j.url);
            deletedExpiredCount++;
          }
        }
      }
    }
    console.log(`Đã xóa ${deletedExpiredCount} tin tuyển dụng quá hạn.`);
  }

  // -----------------------------------------------------
  // 3. KIỂM TRA TIN N/A
  // -----------------------------------------------------
  console.log('\n[3/3] Kiểm tra độ sống sót của các tin N/A...');
  const { data: naJobs, error: errNa } = await supabase.from('jobs').select('url, thong_tin_tuyen_dung');
  
  if (errNa) {
    console.error('Lỗi khi fetch jobs N/A:', errNa);
  } else {
    let deletedNaCount = 0;
    for (const j of naJobs || []) {
      const hetHan = j.thong_tin_tuyen_dung?.het_han_nop;
      if (hetHan === 'N/A') {
        console.log(`Kiểm tra URL: ${j.url}`);
        const exists = await checkJobExists(j.url);
        
        if (!exists) {
          console.log(`Link đã chết, tiến hành xóa: ${j.url}`);
          await supabase.from('jobs').delete().eq('url', j.url);
          deletedNaCount++;
        }
      }
    }
    console.log(`Đã xóa ${deletedNaCount} tin N/A không còn khả dụng.`);
  }

  console.log('\n=== HOÀN TẤT GITHUB ACTIONS ===');
  process.exit(0); // Tắt tiến trình thành công
}

runAllJobs().catch((err) => {
  console.error('Lỗi hệ thống nghiêm trọng:', err);
  process.exit(1);
});
