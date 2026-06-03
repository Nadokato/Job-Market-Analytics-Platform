/**
 * Script tìm các jobs bị trùng lặp trong Supabase.
 * Chạy: npx ts-node --project tsconfig.scripts.json --transpile-only scripts/find_duplicates.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findDuplicates() {
  console.log('=== BẮT ĐẦU QUÉT TRÙNG LẶP TRÊN SUPABASE ===');
  console.log('Đang tải dữ liệu từ database...\n');

  let allJobs: any[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, url, tieu_de, cong_ty, dia_diem, created_at, job_hash_id')
      .range(offset, offset + batchSize - 1);

    if (error || !data || data.length === 0) break;
    allJobs = allJobs.concat(data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`Tổng số bản ghi tin tuyển dụng: ${allJobs.length}\n`);

  // ─── 1. TÌM TRÙNG LẶP THEO MÃ HASH DUY NHẤT (job_hash_id) ───────────────────
  // Cơ chế này nhận diện 1 tin tuyển dụng giống nhau đăng tải ở nhiều nguồn khác nhau
  const hashMap = new Map<string, any[]>();
  for (const job of allJobs) {
    const key = (job.job_hash_id || '').trim();
    if (!key || key.toLowerCase() === 'null') continue;
    if (!hashMap.has(key)) hashMap.set(key, []);
    hashMap.get(key)!.push(job);
  }

  const dupByHash = Array.from(hashMap.entries()).filter(([, jobs]) => jobs.length > 1);
  const totalDupHash = dupByHash.reduce((sum, [, jobs]) => sum + jobs.length - 1, 0);

  // ─── 2. TÌM TRÙNG LẶP THEO URL TUYỆT ĐỐI ─────────────────────────────────────
  const urlMap = new Map<string, any[]>();
  for (const job of allJobs) {
    const key = (job.url || '').trim().toLowerCase();
    if (!key) continue;
    if (!urlMap.has(key)) urlMap.set(key, []);
    urlMap.get(key)!.push(job);
  }

  const dupByUrl = Array.from(urlMap.entries()).filter(([, jobs]) => jobs.length > 1);
  const totalDupUrl = dupByUrl.reduce((sum, [, jobs]) => sum + jobs.length - 1, 0);

  // ─── IN KẾT QUẢ ─────────────────────────────────────────────────────────────

  console.log(`════════════════════════════════════════════════════════════════`);
  console.log(`🔎 1. TRÙNG LẶP THEO MÃ HASH AI/ML (ĐỒNG BỘ 2 NGUỒN):`);
  console.log(`   Tìm thấy: ${dupByHash.length} nhóm tin trùng nhau (${totalDupHash} tin trùng lặp)`);
  console.log(`════════════════════════════════════════════════════════════════`);
  
  if (dupByHash.length > 0) {
    for (const [hash, jobs] of dupByHash.slice(0, 10)) { // Show top 10 groups
      console.log(`\n🔑 Hash ID: ${hash}`);
      console.log(`   Công việc: "${jobs[0].tieu_de}" @ "${jobs[0].cong_ty}"`);
      console.log(`   Địa điểm: ${jobs[0].dia_diem}`);
      console.log(`   Danh sách các nguồn tin giống nhau:`);
      for (const j of jobs) {
        const sourceName = j.url.includes('topcv.vn') ? 'TopCV' : j.url.includes('joboko.com') ? 'JobOKO' : 'Khác';
        console.log(`     - [${sourceName}] ID: ${j.id} | Link: ${j.url}`);
      }
    }
    if (dupByHash.length > 10) {
      console.log(`\n... và ${dupByHash.length - 10} nhóm tin trùng lặp khác.`);
    }
  } else {
    console.log('   -> Không phát hiện tin trùng lặp nào giữa các nguồn khác nhau.');
  }

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`🔗 2. TRÙNG LẶP THEO URL TUYỆT ĐỐI:`);
  console.log(`   Tìm thấy: ${dupByUrl.length} nhóm trùng (${totalDupUrl} bản thừa)`);
  console.log(`════════════════════════════════════════════════════════════════`);
  for (const [url, jobs] of dupByUrl.slice(0, 5)) {
    console.log(`\n🔗 URL: ${url}`);
    for (const j of jobs) {
      console.log(`   ID: ${j.id} | ${j.tieu_de} @ ${j.cong_ty} | created: ${j.created_at?.slice(0, 10)}`);
    }
  }

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`📊 TỔNG KẾT: Hệ thống đang đồng bộ ${dupByHash.length} nhóm tin tuyển dụng trùng từ nhiều nguồn.`);
  console.log(`════════════════════════════════════════════════════════════════`);
  process.exit(0);
}

findDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
