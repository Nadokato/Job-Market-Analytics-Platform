import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

const INDEX = 'jobs';

// GET /api/v1/jobs/options
export async function GET(_req: NextRequest) {
  try {
    // Dùng Elasticsearch aggregations để lấy tất cả giá trị duy nhất của từng field
    const result = await esClient.search({
      index: INDEX,
      size: 0, // Không cần lấy documents, chỉ cần thống kê
      aggs: {
        locations: { terms: { field: 'cities', size: 200, order: { _key: 'asc' } } },
        categories: { terms: { field: 'categories', size: 500, order: { _key: 'asc' } } },
      },
    });

    const buckets = (agg: any) =>
      ((result.aggregations?.[agg] as any)?.buckets ?? []).map((b: any) => b.key as string);

    return NextResponse.json({
      locations: buckets('locations'),
      categories: buckets('categories'),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });

  } catch (err: any) {
    console.error('[/api/v1/jobs/options] Error:', err?.message ?? err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
