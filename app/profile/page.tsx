import MyProfilePage from '@/frontend/my profile/page';
import { createClient } from '@/backend/supabase/server';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'Quản lý hồ sơ cá nhân, kinh nghiệm làm việc, học vấn và kỹ năng của bạn trên CareerIntel.',
}

export default async function Profile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <MyProfilePage user={user} />;
}
