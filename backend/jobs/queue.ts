import { Queue, Worker } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { scrapeJoboko, checkJobExists } from '../scrap/scrap';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connection = {
  host: 'localhost',
  port: 6379,
};

export const jobQueue = new Queue('job-queue', { connection });

// Dùng Service Role Key để chèn Database an toàn trên backend (bỏ qua RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const worker = new Worker('job-queue', async job => {
  console.log(`\n[BullMQ] Bắt đầu chạy job: ${job.name}...`);

  if (job.name === 'daily_scrape') {
    // 1. Cào dữ liệu mới
    const results = await scrapeJoboko();
    
    if (results.length > 0) {
      console.log(`Đang lưu ${results.length} jobs vào Supabase...`);
      // Upsert vào Supabase. Đảm bảo bảng `jobs` trên Supabase có cột `url` làm PRIMARY KEY hoặc UNIQUE
      const { error } = await supabase.from('jobs').upsert(results, { onConflict: 'url' });
      if (error) {
        console.error('Lỗi khi insert vào Supabase:', error);
      } else {
        console.log('Lưu Database thành công!');
      }
    }
  } 
  
  else if (job.name === 'clean_expired_jobs') {
    // 2. Xóa các job đã hết hạn
    const { data: jobs, error } = await supabase.from('jobs').select('url, thong_tin_tuyen_dung');
    if (error) {
      console.error('Lỗi khi fetch jobs:', error);
      return;
    }

    let deletedCount = 0;
    for (const j of jobs || []) {
      const hetHan = j.thong_tin_tuyen_dung?.het_han_nop;
      if (hetHan && hetHan !== 'N/A') {
        // Parse date DD/MM/YYYY (định dạng thường gặp trên web VN)
        const parts = hetHan.split('/');
        if (parts.length === 3) {
          const [dd, mm, yyyy] = parts;
          const expDate = new Date(`${yyyy}-${mm}-${dd}`);
          const now = new Date();
          
          if (expDate < now) {
            await supabase.from('jobs').delete().eq('url', j.url);
            deletedCount++;
          }
        }
      }
    }
    console.log(`Đã xóa ${deletedCount} tin tuyển dụng đã quá hạn nộp.`);
  } 
  
  else if (job.name === 'check_na_jobs') {
    // 3. Kiểm tra các job N/A xem link còn tồn tại không
    const { data: jobs, error } = await supabase.from('jobs').select('url, thong_tin_tuyen_dung');
    if (error) {
      console.error('Lỗi khi fetch jobs:', error);
      return;
    }

    let deletedCount = 0;
    for (const j of jobs || []) {
      const hetHan = j.thong_tin_tuyen_dung?.het_han_nop;
      if (hetHan === 'N/A') {
        console.log(`Kiểm tra tính tồn tại của URL N/A: ${j.url}`);
        const exists = await checkJobExists(j.url);
        
        if (!exists) {
          console.log(`Link đã die/hết hạn. Đang xóa: ${j.url}`);
          await supabase.from('jobs').delete().eq('url', j.url);
          deletedCount++;
        }
      }
    }
    console.log(`Đã xóa ${deletedCount} tin N/A không còn khả dụng.`);
  }
}, { connection });

worker.on('completed', job => {
  console.log(`[BullMQ] Hoàn thành job: ${job.name}`);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job?.name} thất bại:`, err.message);
});
