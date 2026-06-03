import { NextRequest, NextResponse } from 'next/server';
import { elasticClient } from '@/backend/lib/elasticsearch';
import { checkRateLimit, isTokenBlacklisted } from '@/backend/lib/redisSecurity';

const INDEX = 'jobs';

// GET /api/v1/jobs/search
export async function GET(req: NextRequest) {
  // 1. Khởi tạo/nhận Correlation ID
  const correlationId = req.headers.get('x-correlation-id') || `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 2. Lấy IP của client để Rate Limiting
  // Ưu tiên sử dụng các header do hạ tầng/hosting cung cấp (x-real-ip, x-forwarded-for)
  const xRealIp = req.headers.get('x-real-ip');
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const headerIp =
    (xRealIp && xRealIp.split(',')[0].trim()) ||
    (xForwardedFor && xForwardedFor.split(',')[0].trim()) ||
    null;

  const ip = (req as any).ip || headerIp || null;

  console.log(`[${correlationId}] Nhận request GET /api/v1/jobs/search từ IP: ${ip ?? 'UNKNOWN'}`);

  try {
    // 3. Thực thi Rate Limiting qua Redis (chỉ khi xác định được IP đáng tin cậy)
    if (ip) {
      const rateLimitResult = await checkRateLimit(ip, 50, 60);
      if (!rateLimitResult.success) {
        console.warn(`[${correlationId}] Rate limit exceeded cho IP: ${ip}. Số request hiện tại: ${rateLimitResult.count}`);
        return NextResponse.json(
          { error: 'Too Many Requests. Giới hạn 50 requests/phút.' },
          { status: 429, headers: { 'x-correlation-id': correlationId } }
        );
      }
    } else {
      console.warn(`[${correlationId}] Không thể xác định IP client một cách đáng tin cậy. Bỏ qua rate limiting cho request này.`);
    }

    // 4. Kiểm tra JWT Blacklisting qua Redis (nếu request gửi kèm Auth Token)
    let token = '';
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      const allCookies = req.cookies.getAll();
      const sbAuthCookie = allCookies.find(c => c.name.includes('-auth-token'));
      if (sbAuthCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sbAuthCookie.value));
          token = parsed?.access_token || '';
        } catch {
          token = sbAuthCookie.value;
        }
      }
    }

    if (token) {
      const isBlacklisted = await isTokenBlacklisted(token);
      if (isBlacklisted) {
        console.warn(`[${correlationId}] Request bị chặn do Token nằm trong Blacklist.`);
        return NextResponse.json(
          { error: 'Unauthorized. Token đã bị thu hồi (đã đăng xuất).' },
          { status: 401, headers: { 'x-correlation-id': correlationId } }
        );
      }
    }

    const { searchParams } = req.nextUrl;
    const keyword       = searchParams.get('keyword')?.trim() || '';
    const locations     = searchParams.getAll('locations');
    const categories    = searchParams.getAll('categories');
    const workTypes     = searchParams.getAll('workTypes');
    const levels        = searchParams.getAll('levels');
    const experiences   = searchParams.getAll('experiences');
    const salaryBuckets = searchParams.getAll('salaryBuckets');
    const page          = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit         = 20;
    const from          = (page - 1) * limit;

    // ─── Build Elasticsearch Bool Query ─────────────────────────────────────
    const must: any[]   = [];
    const filter: any[] = [];

    // Full-text search trên tiêu đề và tên công ty
    if (keyword) {
      must.push({
        multi_match: {
          query:  keyword,
          fields: ['tieu_de^3', 'cong_ty^2'], // tiêu đề quan trọng hơn
          type:   'best_fields',
          fuzziness: 'AUTO', // chấp nhận gõ sai chính tả nhẹ
        },
      });
    }

    // Lọc chính xác bằng term filter (nhanh hơn nhiều so với match)
    if (locations.length)     filter.push({ terms: { cities:        locations } });
    if (categories.length)    filter.push({ terms: { categories:    categories } });
    if (workTypes.length)     filter.push({ terms: { workTypes:     workTypes } });
    if (levels.length)        filter.push({ terms: { levels:        levels } });
    if (experiences.length)   filter.push({ terms: { expBuckets:    experiences } });
    if (salaryBuckets.length) filter.push({ terms: { salaryBuckets: salaryBuckets } });

    // ─── Execute Search ───────────────────────────────────────────────────────
    console.log(`[${correlationId}] Đang tìm kiếm trên Elasticsearch với index: ${INDEX}`);
    const result = await elasticClient.search({
      index: INDEX,
      from,
      size:  limit,
      sort:  must.length > 0
        ? ['_score', { created_at: 'desc' }]  // Nếu có keyword → ưu tiên relevance score
        : [{ created_at: 'desc' }],            // Không có keyword → sắp theo mới nhất
      query: {
        bool: {
          must:   must.length   > 0 ? must   : [{ match_all: {} }],
          filter: filter.length > 0 ? filter : [],
        },
      },
      _source: ['raw_data'], // Chỉ lấy raw_data để trả về cho UI
    });

    const hits  = result.hits.hits;
    const total = typeof result.hits.total === 'object'
      ? result.hits.total.value
      : result.hits.total ?? 0;

    const jobs       = hits.map((h: any) => h._source?.raw_data ?? h._source);
    const totalPages = Math.ceil(total / limit) || 1;

    console.log(`[${correlationId}] Tìm thấy ${total} kết quả. Trả về trang ${page}/${totalPages}`);

    return NextResponse.json({ jobs, total, page, totalPages }, {
      headers: { 
        'Cache-Control': 'no-store',
        'x-correlation-id': correlationId
      },
    });

  } catch (err: any) {
    console.error(`[${correlationId}] [/api/v1/jobs/search] Lỗi hệ thống:`, err?.message ?? err);
    return NextResponse.json({ error: 'Internal Server Error' }, { 
      status: 500,
      headers: { 'x-correlation-id': correlationId }
    });
  }
}
