/**
 * Upload CV Templates lên Supabase
 * 
 * Script này thực hiện 2 việc:
 * 1. Upload từng file ảnh PNG lên Supabase Storage (bucket: "cv-templates")
 * 2. Upsert metadata (slug, tên, URL, public_image_url) vào Supabase Database (table: "cv_templates")
 * 
 * Yêu cầu:
 *   - File cv_templates_output/cv_templates.json phải tồn tại (do scrap_topcv_cv_templates.ts tạo ra)
 *   - File ảnh .png phải tồn tại trong thư mục cv_templates_output/
 *   - Supabase Storage bucket "cv-templates" đã được tạo (Public bucket)
 *   - Bảng "cv_templates" đã được tạo trong Supabase (xem SQL bên dưới)
 * 
 * SQL tạo bảng (chạy trong Supabase SQL Editor):
 * ─────────────────────────────────────────────────────────────────
 * create table if not exists cv_templates (
 *   id              bigint generated always as identity primary key,
 *   slug            text unique not null,
 *   name            text,
 *   template_page_url text,
 *   preview_iframe_url text,
 *   public_image_url  text,
 *   scraped_at      timestamptz,
 *   created_at      timestamptz default now()
 * );
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

// ─── Load biến môi trường từ .env.local ────────────────────────────────────
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Dùng SERVICE_ROLE_KEY để bypass RLS (Row Level Security) khi upload
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_KEY trong .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Cấu hình ──────────────────────────────────────────────────────────────
const CONFIG = {
  JSON_FILE: path.join(process.cwd(), 'cv_templates_output', 'cv_templates.json'),
  IMG_DIR: path.join(process.cwd(), 'cv_templates_output'),
  STORAGE_BUCKET: 'cv-templates',     // Tên bucket trong Supabase Storage
  DB_TABLE: 'cv_templates',            // Tên bảng trong Supabase Database
  DELAY_MS: 200,                        // Delay nhỏ giữa từng record để không spam API
};

// ─── Utility: chuyển slug thành tên đọc được ────────────────────────────────
// Ví dụ: "mau-cv-lap-trinh-vien" → "Lập Trình Viên"
// (Dùng slug làm fallback vì tên trong JSON bị lỗi encoding UTF-8 do ts-node)
function slugToDisplayName(slug: string): string {
  return slug
    .replace(/^mau-cv-/, '')         // Bỏ prefix "mau-cv-"
    .replace(/^mau-/, '')            // Bỏ prefix "mau-"
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ─── Utility: delay ─────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── Hàm chính ──────────────────────────────────────────────────────────────
async function uploadCVTemplates() {
  // 1. Đọc file JSON
  if (!fs.existsSync(CONFIG.JSON_FILE)) {
    console.error(`❌ Không tìm thấy file: ${CONFIG.JSON_FILE}`);
    console.error('   Hãy chạy "npm run scrap:cv-templates" trước!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(CONFIG.JSON_FILE, 'utf-8');
  const templates: {
    slug: string;
    name: string;
    template_page_url: string;
    preview_iframe_url: string;
    screenshot_path: string;
    scraped_at: string;
  }[] = JSON.parse(rawData);

  // Chỉ xử lý các record có ảnh thực sự tồn tại
  const validTemplates = templates.filter(
    (t) => t.screenshot_path && fs.existsSync(t.screenshot_path)
  );

  console.log('\n' + '═'.repeat(60));
  console.log('📤 UPLOAD CV TEMPLATES LÊN SUPABASE');
  console.log('═'.repeat(60));
  console.log(`📄 Tổng records trong JSON : ${templates.length}`);
  console.log(`🖼️  Records có file ảnh hợp lệ: ${validTemplates.length}`);
  console.log(`💾 Storage bucket : ${CONFIG.STORAGE_BUCKET}`);
  console.log(`🗄️  Database table : ${CONFIG.DB_TABLE}`);
  console.log('═'.repeat(60) + '\n');

  // 2. Kiểm tra bucket tồn tại
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    console.error('❌ Lỗi kết nối Supabase Storage:', bucketErr.message);
    process.exit(1);
  }

  const bucketExists = buckets?.some((b) => b.name === CONFIG.STORAGE_BUCKET);
  if (!bucketExists) {
    console.log(`⚙️  Bucket "${CONFIG.STORAGE_BUCKET}" chưa tồn tại. Đang tạo...`);
    const { error: createErr } = await supabase.storage.createBucket(CONFIG.STORAGE_BUCKET, {
      public: true,                // Public bucket → URL ảnh có thể nhúng trực tiếp
      fileSizeLimit: 5 * 1024 * 1024, // Giới hạn 5MB mỗi ảnh
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    });
    if (createErr) {
      console.error('❌ Lỗi tạo bucket:', createErr.message);
      process.exit(1);
    }
    console.log(`✅ Đã tạo bucket "${CONFIG.STORAGE_BUCKET}"\n`);
  } else {
    console.log(`✅ Bucket "${CONFIG.STORAGE_BUCKET}" đã tồn tại\n`);
  }

  // 3. Bắt đầu upload từng template
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < validTemplates.length; i++) {
    const t = validTemplates[i];
    const displayName = slugToDisplayName(t.slug);
    const imgFileName = `${t.slug}.png`;

    console.log(`[${i + 1}/${validTemplates.length}] 🎨 ${displayName} (${t.slug})`);

    // ── Bước A: Upload ảnh lên Supabase Storage ──────────────────────────
    const imgBuffer = fs.readFileSync(t.screenshot_path);
    const storagePath = imgFileName; // Lưu thẳng vào root của bucket

    const { error: uploadErr } = await supabase.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(storagePath, imgBuffer, {
        contentType: 'image/png',
        upsert: true,  // Ghi đè nếu đã tồn tại (idempotent)
      });

    if (uploadErr) {
      console.error(`  ❌ Lỗi upload ảnh: ${uploadErr.message}`);
      failCount++;
      continue;
    }

    // ── Bước B: Lấy Public URL của ảnh vừa upload ────────────────────────
    const { data: urlData } = supabase.storage
      .from(CONFIG.STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicImageUrl = urlData.publicUrl;
    console.log(`  🖼️  Storage URL: ${publicImageUrl}`);

    // ── Bước C: Upsert metadata vào Database ─────────────────────────────
    const { error: dbErr } = await supabase
      .from(CONFIG.DB_TABLE)
      .upsert(
        {
          slug: t.slug,
          name: displayName,                          // Dùng tên từ slug (tránh lỗi encoding)
          template_page_url: t.template_page_url,
          preview_iframe_url: t.preview_iframe_url,
          public_image_url: publicImageUrl,           // URL ảnh trên Supabase Storage
          scraped_at: t.scraped_at,
        },
        { onConflict: 'slug' }                        // Upsert theo slug (unique key)
      );

    if (dbErr) {
      console.error(`  ❌ Lỗi ghi Database: ${dbErr.message}`);
      failCount++;
    } else {
      console.log(`  ✅ Đã lưu vào Database`);
      successCount++;
    }

    await delay(CONFIG.DELAY_MS);
  }

  // 4. Tổng kết
  console.log('\n' + '═'.repeat(60));
  console.log('🎉 HOÀN THÀNH!');
  console.log(`  ✅ Thành công  : ${successCount} / ${validTemplates.length}`);
  console.log(`  ❌ Thất bại   : ${failCount}`);
  console.log(`  ⏭️  Bỏ qua     : ${skipCount}`);
  console.log(`\n  🔗 Xem Storage: ${supabaseUrl}/storage/v1/object/public/${CONFIG.STORAGE_BUCKET}/`);
  console.log(`  🗄️  Xem Table  : Supabase Dashboard → Table Editor → ${CONFIG.DB_TABLE}`);
  console.log('═'.repeat(60));
}

uploadCVTemplates();
