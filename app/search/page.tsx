import JobSearchPage from '@/frontend/job search/page';
import { createClient } from '@/backend/supabase/server';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Job Search',
  description: 'Tìm kiếm hàng nghìn việc làm với bộ lọc thông minh theo vị trí, ngành nghề và mức lương.',
}

export default async function JobSearch() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <JobSearchPage user={user} />;
}

