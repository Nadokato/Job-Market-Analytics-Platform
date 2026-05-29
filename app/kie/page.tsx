'use client';

import { useState } from 'react';

export default function KIEPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/kie', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      
      if (data.job_id) {
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // 2 mins total
        
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await fetch(`/api/chatbot/status/${data.job_id}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === 'COMPLETED') {
                clearInterval(pollInterval);
                setResult(statusData.result);
                setLoading(false);
              } else if (statusData.status === 'FAILED') {
                clearInterval(pollInterval);
                console.error(statusData.error || 'Job failed');
                setLoading(false);
              }
            }
          } catch (err) {
            console.error("Polling error", err);
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            console.error('Timeout waiting for KIE processing');
            setLoading(false);
          }
        }, 2000);
      } else {
        setResult(data);
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Key Information Extraction</h1>
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-2"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Extract Information'}
        </button>
      </form>
      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Extracted Information</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}