import SignUpPage from '@/frontend/signup/page';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Tạo tài khoản CareerIntel miễn phí để khám phá hàng nghìn việc làm và nhận tư vấn AI nghề nghiệp.',
}

export default function SignUp() {
  return <SignUpPage />;
}
