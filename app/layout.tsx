import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'CareerIntel — Intelligent Job Market Hub',
    template: '%s | CareerIntel',
  },
  description:
    'Khám phá hàng nghìn việc làm, phân tích xu hướng thị trường lao động và nhận tư vấn nghề nghiệp từ AI. Nền tảng tìm việc thông minh CareerIntel.',
  keywords: [
    'CareerIntel',
    'tìm việc làm',
    'job search',
    'thị trường lao động',
    'market insights',
    'AI assistant',
    'tuyển dụng Việt Nam',
    'việc làm IT',
  ],
  authors: [{ name: 'CareerIntel' }],
  creator: 'CareerIntel',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CareerIntel',
    title: 'CareerIntel — Intelligent Job Market Hub',
    description:
      'Khám phá hàng nghìn việc làm, phân tích xu hướng thị trường và nhận tư vấn AI nghề nghiệp.',
  },
  twitter: {
    card: 'summary',
    title: 'CareerIntel — Intelligent Job Market Hub',
    description:
      'Khám phá hàng nghìn việc làm, phân tích xu hướng thị trường và nhận tư vấn AI nghề nghiệp.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
