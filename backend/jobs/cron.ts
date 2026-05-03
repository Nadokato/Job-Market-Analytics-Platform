import { jobQueue } from './queue';

async function scheduleJobs() {
  console.log('Đang lên lịch các Cron Jobs cho hệ thống...');

  // Xóa các job cũ hiện có để set lịch mới cho chuẩn xác
  await jobQueue.obliterate({ force: true }).catch(() => {});

  // 1. Chạy cào dữ liệu mỗi 3 ngày một lần (Lúc 02:00 sáng)
  await jobQueue.add('daily_scrape', {}, {
    repeat: { pattern: '0 2 */3 * *' } 
  });

  // 2. Xóa các job hết hạn nộp (Chạy vào 00:00 mỗi ngày)
  await jobQueue.add('clean_expired_jobs', {}, {
    repeat: { pattern: '0 0 * * *' }
  });

  // 3. Kiểm tra các job N/A xem link còn tồn tại không (Chạy vào 01:00 mỗi ngày)
  await jobQueue.add('check_na_jobs', {}, {
    repeat: { pattern: '0 1 * * *' }
  });

  console.log('Lên lịch thành công! Hệ thống Queue đang chạy ngầm...');
}

// Chạy luôn lập tức 1 lần để test (chỉ dùng trong dev)
async function triggerTest() {
  await scheduleJobs();
  
  console.log('\n--- KÍCH HOẠT TEST NGAY LẬP TỨC ---');
  // Kích hoạt test xóa bài hết hạn
  await jobQueue.add('clean_expired_jobs', {});
  // Kích hoạt test các link N/A
  await jobQueue.add('check_na_jobs', {});
}

triggerTest();
