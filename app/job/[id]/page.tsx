import JobDetailPage from '@/frontend/job detail/page';
import { createClient } from '@/backend/supabase/server';

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const jobId = resolvedParams.id;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <JobDetailPage user={user} jobId={jobId} />;
}
