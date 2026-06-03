import { redis } from './redis';
import { createHash } from 'crypto';

/**
 * Tạo mã Hash SHA-256 từ Token JWT để làm key lưu trữ trong Redis.
 * Tránh việc lưu trữ toàn bộ JWT thô giúp tiết kiệm bộ nhớ Redis và bảo mật payload nhạy cảm.
 */
function getTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Decode JWT payload để lấy thời gian hết hạn (claim 'exp')
 * Không sử dụng thư viện ngoài để tránh làm nặng ứng dụng và tương thích tốt mọi môi trường.
 */
function getJwtExpiry(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    // Decode base64 từ phần payload (phần thứ 2 của JWT)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );
    return payload.exp || 0;
  } catch (e) {
    console.error('[RedisSecurity] Lỗi decode JWT:', e);
    return 0;
  }
}

/**
 * 1. Thực thi Rate Limiting cho API
 * Sử dụng thuật toán Fixed Window đơn giản, hiệu năng cao trên Redis.
 * 
 * @param ip Địa chỉ IP của Client cần giới hạn
 * @param limit Số lượng requests tối đa cho phép
 * @param windowSeconds Cửa sổ thời gian (giây) - mặc định là 60 giây (1 phút)
 */
export async function checkRateLimit(
  ip: string,
  limit = 50,
  windowSeconds = 60
): Promise<{ success: boolean; count: number }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    // Tạo key dựa trên IP và block thời gian hiện tại
    const currentWindow = Math.floor(now / windowSeconds);
    const key = `rate_limit:${ip}:${currentWindow}`;

    // Tăng giá trị key trong Redis
    const count = await redis.incr(key);

    // Nếu mới tạo key lần đầu, đặt TTL để Redis tự giải phóng bộ nhớ
    if (count === 1) {
      await redis.expire(key, windowSeconds + 10);
    }

    if (count > limit) {
      return { success: false, count };
    }

    return { success: true, count };
  } catch (err) {
    console.warn(
      '[RedisSecurity] ⚠️  WARN: Redis unreachable — Rate limiting is DISABLED. ' +
      'All requests are being allowed through. Investigate immediately.',
      err
    );
    // Fail-open intentional: availability > security for search endpoints.
    // Ops team must be alerted via monitoring on this WARN log.
    return { success: true, count: 0 };
  }
}

/**
 * 2. Đưa Token vào Danh sách đen (Blacklist) khi Đăng xuất
 * 
 * @param token Chuỗi token JWT cần thu hồi
 */
export async function blacklistToken(token: string): Promise<void> {
  try {
    if (!token) return;

    const exp = getJwtExpiry(token);
    const nowSeconds = Math.floor(Date.now() / 1000);
    
    // Tính thời gian sống còn lại của token
    let ttl = exp - nowSeconds;

    // Nếu token không hợp lệ hoặc đã hết hạn từ trước, gán TTL mặc định là 1 giờ (3600s)
    if (ttl <= 0) {
      ttl = 3600;
    }

    const key = `blacklist:${getTokenHash(token)}`;
    await redis.set(key, 'revoked', 'EX', ttl);
    console.log(`[RedisSecurity] Đã đưa token vào Blacklist. TTL còn lại: ${ttl}s`);
  } catch (err) {
    console.error('[RedisSecurity] Lỗi lưu Blacklist token:', err);
  }
}

/**
 * 3. Kiểm tra xem Token có đang nằm trong Blacklist hay không
 * 
 * @param token Chuỗi token JWT cần kiểm tra
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    if (!token) return false;
    const key = `blacklist:${getTokenHash(token)}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    console.error(
      '[RedisSecurity] 🔴 CRITICAL: Redis unreachable — Token blacklist check FAILED. ' +
      'Failing CLOSED: treating token as blacklisted to protect security. ' +
      'This may cause authenticated users to be logged out temporarily. Investigate immediately.',
      err
    );
    // Fail-closed: khi không thể xác minh trạng thái blacklist, từ chối token để đảm bảo bảo mật.
    // Người dùng bị ảnh hưởng tạm thời khi Redis xuống — đây là đánh đổi có chủ đích: security > availability.
    return true;
  }
}
