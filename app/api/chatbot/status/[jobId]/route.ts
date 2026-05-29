import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.CHATBOT_BACKEND_URL || 'http://localhost:8000';

/**
 * GET /api/chatbot/status/[jobId] — Proxy job status polling to FastAPI.
 *
 * Frontend polls this endpoint every 2s until the job is COMPLETED or FAILED.
 * Proxies to FastAPI GET /api/job/{jobId}.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    const response = await fetch(`${BACKEND_URL}/api/job/${jobId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Job status error: ${response.status} ${errorText}`);
      return NextResponse.json(
        {
          job_id: jobId,
          status: 'ERROR',
          error: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Job status proxy error:', error);

    const isConnectionError =
      error instanceof TypeError && (error as any).cause?.code === 'ECONNREFUSED';

    return NextResponse.json(
      {
        job_id: '',
        status: 'ERROR',
        error: isConnectionError
          ? 'Chatbot backend not running'
          : 'Connection error',
      },
      { status: 503 }
    );
  }
}
