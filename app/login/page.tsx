import LoginPage from '@/frontend/login/page';
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Đăng nhập vào tài khoản CareerIntel của bạn để tìm kiếm việc làm và nhận tư vấn AI.',
}

export default function Login() {
  return <LoginPage />;
}
