import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Step 1: Forward file to FastAPI
    const fastApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    
    // Create new FormData to forward
    const forwardData = new FormData();
    forwardData.append('file', file);
    
    const uploadRes = await fetch(`${fastApiUrl}/api/kie`, {
      method: 'POST',
      body: forwardData,
    });
    
    if (!uploadRes.ok) {
      throw new Error(`FastAPI returned ${uploadRes.status}`);
    }
    
    const { job_id } = await uploadRes.json();
    if (!job_id) {
      throw new Error("No job_id returned from FastAPI");
    }

    // Step 2: Poll for completion
    let attempts = 0;
    while (attempts < 60) { // Max 2 minutes (60 * 2s)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusRes = await fetch(`${fastApiUrl}/api/job/${job_id}`);
      if (!statusRes.ok) continue;
      
      const statusData = await statusRes.json();
      
      if (statusData.status === 'COMPLETED') {
        return NextResponse.json(statusData.result);
      } else if (statusData.status === 'FAILED') {
        throw new Error(statusData.error || 'Job failed');
      }
      
      attempts++;
    }

    return NextResponse.json({ error: 'Timeout waiting for KIE processing' }, { status: 504 });
  } catch (error: any) {
    console.error("KIE Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process PDF' }, { status: 500 });
  }
}