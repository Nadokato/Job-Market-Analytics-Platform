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

async function runAllJobs() {
  console.log('=== BẮT ĐẦU CHẠY GITHUB ACTIONS ===');
  
  // -----------------------------------------------------
  // 1. CÀO DỮ LIỆU MỚI
  // -----------------------------------------------------
  console.log('\n[1/3] Đang cào dữ liệu mới từ JobOKO...');
  const jobokoResults = await scrapeJoboko(3); // Cào 3 trang đầu tiên của JobOKO

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
    console.log(`Tiến hành gửi ${results.length} jobs sang Python ML Service để chuẩn hóa và lưu...`);
    
    let successCount = 0;
    let fallbackCount = 0;
    let failCount = 0;
    
    for (const job of results) {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/jobs/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job),
        });
        
        if (res.ok) {
          successCount++;
        } else {
          const errorText = await res.text();
          console.error(`Lỗi ML API cho job ${job.url}:`, errorText);
          throw new Error(`ML API returned status ${res.status}`);
        }
      } catch (err) {
        console.warn(`[ML API Offline/Lỗi] Không thể kết nối ML API cho job ${job.url}: ${(err as Error).message}`);
        console.log(`-> Kích hoạt chế độ dự phòng (Direct Fallback): Lưu thẳng dữ liệu thô vào Supabase...`);
        
        // Direct Fallback: Lưu trực tiếp dữ liệu thô vào Supabase để fix_khac_offline.py xử lý sau
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
          console.error(`❌ Không thể lưu tin tuyển dụng thô vào Supabase:`, upsertErr.message);
          failCount++;
        } else {
          console.log(`✅ Lưu dữ liệu thô thành công cho: ${job.tieu_de}`);
          fallbackCount++;
        }
      }
    }
    
    console.log(`Hoàn tất xử lý cào mới: ML Thành công ${successCount}, Dự phòng (Thô) ${fallbackCount}, Thất bại ${failCount}`);
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
  console.log('\n[3/3] Kiểm tra độ sống sót của các tin N/A...');
  const { data: naJobs, error: errNa } = await supabase.from('jobs').select('url, thong_tin_tuyen_dung');
  
  if (errNa) {
    console.error('Lỗi khi fetch jobs N/A:', errNa);
  } else {
    const deadUrls: string[] = [];
    
    for (const j of naJobs || []) {
      const hetHan = j.thong_tin_tuyen_dung?.het_han_nop;
      if (hetHan === 'N/A') {
        console.log(`Kiểm tra URL: ${j.url}`);
        const exists = await checkJobExists(j.url);
        
        if (!exists) {
          console.log(`-> Link đã chết: ${j.url}`);
          deadUrls.push(j.url);
        }
      }
    }
    
    if (deadUrls.length > 0) {
      console.log(`Phát hiện ${deadUrls.length} tin N/A đã chết. Đang tiến hành xóa hàng loạt theo lô...`);
      
      const batchSize = 50;
      let deleteSuccessCount = 0;
      let deleteFailCount = 0;
      
      for (let offset = 0; offset < deadUrls.length; offset += batchSize) {
        const batch = deadUrls.slice(offset, offset + batchSize);
        const { error: deleteErr } = await supabase.from('jobs').delete().in('url', batch);
        
        if (deleteErr) {
          console.error(`❌ Lỗi khi xóa lô tin N/A đã chết (offset: ${offset}):`, deleteErr.message);
          deleteFailCount += batch.length;
        } else {
          deleteSuccessCount += batch.length;
        }
      }
      
      console.log(`✅ Đã xóa thành công ${deleteSuccessCount} tin N/A không còn khả dụng, thất bại ${deleteFailCount} tin.`);
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
