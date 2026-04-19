import JobSearchPage from '@/frontend/job search/page';
import { createClient } from '@/backend/supabase/server';

export default async function JobSearch() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let jobsData: any[] = [];
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Lỗi khi lấy jobs từ Supabase:', error);
    } else if (data) {
      jobsData = data;
    }
  } catch (error) {
    console.error('Lỗi server query Supabase:', error);
  }

  return <JobSearchPage user={user} jobs={jobsData} />;
}
