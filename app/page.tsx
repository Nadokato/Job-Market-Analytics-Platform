import HomePage from '@/frontend/home/page';
import { createClient } from '@/backend/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <HomePage user={user} />;
}