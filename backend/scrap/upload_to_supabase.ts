import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { loadEnvConfig } from '@next/env'; // Dùng thư viện này để load .env.local

// 1. Load các biến cấu hình từ .env.local
const projectDir = process.cwd();
loadEnvConfig(projectDir);

// 2. Khởi tạo Supabase client với SERVICE_ROLE_KEY để bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadData() {
  // 3. Đọc dữ liệu từ file scraped_data.json
  const filePath = path.join(process.cwd(), 'scraped_data.json');
  if (!fs.existsSync(filePath)) {
    console.error('Không tìm thấy file scraped_data.json');
    return;
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const jobs = JSON.parse(fileContent);

  console.log(`Đang chuẩn bị upload ${jobs.length} công việc lên Supabase...`);

  // 4. Lặp qua từng job để đẩy lên cơ sở dữ liệu
  let successCount = 0;
  for (const job of jobs) {
    const { error } = await supabase
      .from('jobs')
      .upsert({
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

    if (error) {
      console.error(`❌ Đã có lỗi upload tin "${job.tieu_de}":`, error.message);
    } else {
      console.log(`✅ Upload thành công: ${job.tieu_de}`);
      successCount++;
    }
  }
  
  console.log(`\nHoàn tất! Cập nhật thành công ${successCount}/${jobs.length} bản ghi.`);
}

uploadData();
