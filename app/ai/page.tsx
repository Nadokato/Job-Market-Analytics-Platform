import AIAssistantPage from '@/frontend/ai assistant/page';
import { createClient } from '@/backend/supabase/server';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Assistant',
  description: 'Trợ lý AI nghề nghiệp thông minh — tư vấn hướng nghiệp, phân tích CV và gợi ý việc làm phù hợp.',
}

export default async function AIPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <AIAssistantPage user={user} />;
}
