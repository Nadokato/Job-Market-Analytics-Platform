"use client";

import React from 'react';
import Link from 'next/link';
import { BarChart2 } from 'lucide-react';
import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa';

export default function LoginPage() {
  return (
    <div className="min-h-screen font-sans bg-gray-50 flex flex-col relative overflow-hidden">
      
      {/* --- HEADER --- */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <span className="font-bold text-2xl text-slate-800 tracking-tight">
            Career<span className="text-blue-600">Intel</span>
          </span>
        </div>
        
        <Link href="/">
            <button className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition">
              Trang chủ
            </button>
        </Link>
      </nav>

      {/* --- NỘI DUNG CHÍNH (Form Đăng nhập) --- */}
      <div className="flex-1 flex items-center justify-center py-16 px-4 z-10">
        <div className="bg-white p-10 rounded-3xl shadow-[0_15px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-md">
          
          <h2 className="text-3xl font-bold mb-2 text-center text-slate-900">Chào mừng trở lại</h2>
          <p className="text-gray-500 text-center mb-8 font-light">Đăng nhập để tiếp tục quản lý sự nghiệp của bạn</p>
          
          <form className="space-y-5">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Email</label>
              <input 
                type="email" 
                className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-slate-900 placeholder:text-gray-400 transition" 
                placeholder="email@example.com" 
                required 
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-slate-800">Mật khẩu</label>
                <a href="#" className="text-xs text-blue-600 hover:underline">Quên mật khẩu?</a>
              </div>
              <input 
                type="password" 
                className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-slate-900 placeholder:text-gray-400 transition" 
                placeholder="••••••••" 
                required 
              />
            </div>

            <button type="submit" className="w-full bg-[#2463eb] text-white p-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-md">
              Đăng nhập
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Chưa có tài khoản?{' '}
              <Link href="/signup" className="text-[#f27a42] font-semibold hover:underline">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-gray-200 py-6 px-6 md:px-12 z-20 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© 2026 CareerIntel. All rights reserved.</p>
          <div className="flex gap-4 text-gray-400">
            <FaFacebook size={18} />
            <FaTwitter size={18} />
            <FaYoutube size={18} />
          </div>
        </div>
      </footer>
    </div>
  );
}