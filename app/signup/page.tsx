"use client";

import React from 'react';
import Link from 'next/link';
import { Search, MapPin, BarChart2 } from 'lucide-react';
import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa';

export default function SignUpPage() {
  return (
    <div className="min-h-screen font-sans bg-gray-50 flex flex-col relative overflow-hidden">
      
      {/* --- HEADER (Giữ nguyên như trang chủ) --- */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-black">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <span className="font-bold text-2xl text-slate-800">
            Career<span className="text-blue-600">Intel</span>
            <span className="block text-[10px] text-gray-500 font-normal -mt-1">Intelligent Job Market Hub</span>
          </span>
        </div>
        
        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          <a href="#" className="hover:text-blue-600 transition">Job Search</a>
          <a href="#" className="hover:text-blue-600 transition">Market Insights</a>
          <a href="#" className="hover:text-blue-600 transition">AI Assistant</a>
          <a href="#" className="hover:text-blue-600 transition">My Profile</a>
        </div>
        
        {/* Nút Đăng ký màu cam được thay bằng link quay lại trang chủ */}
        <Link href="/">
            <button className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm hidden md:block">
            Home
            </button>
        </Link>
      </nav>

      {/* --- NỘI DUNG CHÍNH (Form Đăng ký) --- */}
      <div className="flex-1 flex items-center justify-center py-16 px-4 z-10">
        
        {/* Container cho Form: Đã được mở rộng ra kích thước max-w-xl để trông chuyên nghiệp */}
        <div className="bg-white p-12 rounded-3xl shadow-[0_15px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-xl transition-all duration-300">
          
          <h2 className="text-4xl font-bold mb-3 text-center text-slate-900 tracking-tight">Tạo tài khoản</h2>
          <p className="text-gray-600 text-center text-lg mb-10 font-light">
            Cung cấp thông tin để bắt đầu hành trình sự nghiệp thông minh của bạn.
          </p>
          
          <form className="space-y-6">
            
            {/* Các Input Fields được mở rộng full width */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Họ và Tên</label>
              <input type="text" className="w-full p-4 bg-white text-black border placeholder:text-gray-400 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="Nguyễn Văn A" required />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Email Address</label>
              <input type="email" className="w-full p-4 bg-white text-black border placeholder:text-gray-400 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="example@gmail.com" required />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Mật khẩu</label>
              <input type="password" className="w-full p-4 bg-white text-black border placeholder:text-gray-400 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="••••••••" required />
            </div>

            <div className="flex items-start gap-3 pt-2">
                <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" required />
                <label className="text-sm text-gray-600">Tôi đồng ý với các <a href="#" className="text-blue-600 font-medium hover:underline">Điều khoản Dịch vụ</a> và <a href="#" className="text-blue-600 font-medium hover:underline">Chính sách Bảo mật</a>.</label>
            </div>

            {/* Nút Đăng ký màu cam, kích thước chuẩn */}
            <button type="submit" className="w-full bg-[#f27a42] text-black p-4 rounded-xl font-bold text-lg hover:bg-[#e06830] transition duration-200 shadow-md">
              Đăng ký ngay
            </button>
          </form>

          {/* Dòng text dưới form */}
          <p className="mt-10 text-center text-gray-600 text-base font-light">
            Bạn đã có tài khoản? <Link href="/login" className="text-blue-600 font-semibold hover:underline">Đăng nhập ngay</Link>
          </p>

        </div>
      </div>

      <div className="flex-1"></div> 

      {/* --- FOOTER (Giữ nguyên như trang chủ) --- */}
      <footer className="bg-white border-t border-gray-200 py-6 px-6 md:px-12 mt-auto z-20 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-600">
            <a href="#" className="hover:text-slate-900 transition">About Us</a>
            <a href="#" className="hover:text-slate-900 transition">Terms of Service</a>
            <a href="#" className="hover:text-slate-900 transition">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900 transition">Contact</a>
          </div>
          
          {/* Social Icons (Dùng react-icons) */}
          <div className="flex gap-4 text-gray-500">
            <a href="#" className="hover:text-blue-600 transition"><FaFacebook size={20} /></a>
            <a href="#" className="hover:text-black transition"><FaTwitter size={20} /></a>
            <a href="#" className="hover:text-red-600 transition"><FaYoutube size={20} /></a>
            <a href="#" className="hover:text-black transition flex items-center justify-center w-5 h-5 rounded font-bold text-xs bg-gray-500 text-black hover:bg-black">
              t
            </a>
          </div>
        </div>
      </footer>
      
    </div>
  );
}