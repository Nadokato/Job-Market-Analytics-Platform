import JobDetailPage from '@/frontend/job detail/page';
import { createClient } from '@/backend/supabase/server';

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  let jobId = resolvedParams.id;
  try { jobId = decodeURIComponent(jobId); } catch(e) {}
  try { jobId = decodeURIComponent(jobId); } catch(e) {}
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch from DB
  let initialJob = null;
  let relatedJobs: any[] = [];
  let allJobs: any[] = [];
  
  if (jobId) {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('url', jobId)
      .single();
      
    if (data) initialJob = data;
    
    // fetch related or recent jobs
    const { data: recent } = await supabase
      .from('jobs')
      .select('url, tieu_de, cong_ty, muc_luong, dia_diem')
      .limit(4);
    if (recent) relatedJobs = recent;
  }

  const { data: fetchAll, error } = await supabase.from('jobs').select('dia_diem, nganh_nghe');
  if (error) console.error("Error fetching allJobs for tags:", error);
  if (fetchAll) allJobs = fetchAll;

  return <JobDetailPage user={user} jobId={jobId} initialJob={initialJob} relatedJobs={relatedJobs} allJobs={allJobs} />;
}
