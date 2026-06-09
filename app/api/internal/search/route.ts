/**
 * Internal Search API — Private endpoint for the Python chatbot backend.
 *
 * Reuses the same Elasticsearch index and query logic as the public
 * /api/v1/jobs/search endpoint, but bypasses rate limiting and auth
 * since it's only called by the Python chatbot orchestrator.
 *
 * Endpoint: GET /api/internal/search
 *
 * Query params (same as public, but simplified):
 *   keyword (string), locations (string|string[]),
 *   workTypes (string|string[]), experiences (string|string[]),
 *   salaryBuckets (string|string[]), page (int)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

const INDEX = 'jobs';
const INTERNAL_TOKEN = 'chatbot-internal';

export async function GET(req: NextRequest) {
  // Simple token check — only the Python chatbot should call this
  const internalToken = req.headers.get('x-internal-token');
  if (internalToken !== INTERNAL_TOKEN) {
    return NextResponse.json(
      { error: 'Unauthorized. This endpoint is for internal chatbot use only.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = req.nextUrl;
    const keyword       = searchParams.get('keyword')?.trim() || '';
    const locations     = searchParams.getAll('locations');
    const workTypes     = searchParams.getAll('workTypes');
    const experiences   = searchParams.getAll('experiences');
    const salaryBuckets = searchParams.getAll('salaryBuckets');
    const page          = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit         = 10;  // Chatbot only needs top 10
    const from          = (page - 1) * limit;

    // ─── Build Elasticsearch Bool Query ────────────────────────────────────
    const must: any[]   = [];
    const filter: any[] = [];

    if (keyword) {
      must.push({
        multi_match: {
          query:  keyword,
          fields: ['tieu_de^3', 'cong_ty^2'],
          type:   'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (locations.length)     filter.push({ terms: { cities:        locations } });
    if (workTypes.length)     filter.push({ terms: { workTypes:     workTypes } });
    if (experiences.length)   filter.push({ terms: { expBuckets:    experiences } });
    if (salaryBuckets.length) filter.push({ terms: { salaryBuckets: salaryBuckets } });

    const result = await esClient.search({
      index: INDEX,
      from,
      size:  limit,
      sort:  must.length > 0
        ? ['_score', { created_at: 'desc' }]
        : [{ created_at: 'desc' }],
      query: {
        bool: {
          must:   must.length   > 0 ? must   : [{ match_all: {} }],
          filter: filter.length > 0 ? filter : [],
        },
      },
      _source: ['raw_data'],
    });

    const hits  = result.hits.hits;
    const total = typeof result.hits.total === 'object'
      ? result.hits.total.value
      : result.hits.total ?? 0;

    const jobs       = hits.map((h: any) => h._source?.raw_data ?? h._source);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json(
      { jobs, total, page, totalPages },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );

  } catch (err: any) {
    console.error('[/api/internal/search] ES error:', err?.message ?? err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
