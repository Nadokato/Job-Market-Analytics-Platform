import JobSearchPage from '@/frontend/job search/page';
import { createClient } from '@/backend/supabase/server';
import fs from 'fs';
import path from 'path';

export default async function JobSearch() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let jobsData = [];
  try {
    const filePath = path.join(process.cwd(), 'scraped_data.json');
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      jobsData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Lỗi đọc scraped_data.json:', error);
  }

  return <JobSearchPage user={user} jobs={jobsData} />;
}
