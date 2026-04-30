import MarketInsightsPage from '@/frontend/market insights/page';
import { createClient } from '@/backend/supabase/server';

export const metadata = {
  title: 'Market Insights — CareerIntel',
  description: 'Phân tích xu hướng thị trường việc làm, mức lương và cơ hội nghề nghiệp tại Việt Nam.',
};

export default async function InsightsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let jobsData: any[] = [];
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('url, tieu_de, muc_luong, nganh_nghe, kinh_nghiem_lam_viec, cong_ty, dia_diem, cap_bac, logo')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Lỗi khi lấy jobs từ Supabase:', error);
    } else if (data) {
      jobsData = data;
    }
  } catch (error) {
    console.error('Lỗi server query Supabase:', error);
  }

  return <MarketInsightsPage user={user} jobs={jobsData} />;
}
