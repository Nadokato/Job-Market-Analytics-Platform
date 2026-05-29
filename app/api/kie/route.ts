import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Step 1: Forward file to FastAPI
    const fastApiUrl = process.env.CHATBOT_BACKEND_URL || 'http://127.0.0.1:8000';
    
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

    return NextResponse.json({ job_id, status: 'PENDING' });
  } catch (error: any) {
    console.error("KIE Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process PDF' }, { status: 500 });
  }
}