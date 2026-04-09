"use client";

import React, { useActionState } from 'react';
import Link from 'next/link';
import { BarChart2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa';
import { signup } from '@/backend/auth/actions';

const initialState = { error: null, success: null } as { error: string | null, success: string | null };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signup, initialState);

  return (
    <div className="min-h-screen font-sans bg-gray-50 flex flex-col relative overflow-hidden">
      
      {/* --- HEADER (Giữ nguyên như trang chủ) --- */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <span className="font-bold text-2xl text-slate-800">
            Career<span className="text-blue-600">Intel</span>
            <span className="block text-[10px] text-gray-500 font-normal -mt-1">Intelligent Job Market Hub</span>
          </span>
        </Link>
        
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
          
          <h2 className="text-4xl font-bold mb-3 text-center text-slate-900 tracking-tight">Create Account</h2>
          <p className="text-gray-600 text-center text-lg mb-8 font-light">
            Provide your information
          </p>
          
          <form action={formAction} className="space-y-6">

            {state?.error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 border border-red-200 flex flex-col gap-1 items-centers text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle size={16} /> Error
                </div>
                <span>{state.error}</span>
              </div>
            )}

            {state?.success && (
              <div className="p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 flex flex-col gap-1 items-centers text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle size={16} /> Success
                </div>
                <span>{state.success}</span>
              </div>
            )}
            
            {/* Các Input Fields được mở rộng full width */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Name</label>
              <input name="name" type="text" className="w-full p-4 bg-white text-black border placeholder:text-gray-400 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="Nguyễn Văn A" required />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Email Address</label>
              <input name="email" type="email" className="w-full p-4 bg-white text-black border placeholder:text-gray-400 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="example@gmail.com" required />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-800">Password</label>
              <input name="password" type="password" className="w-full p-4 bg-white text-black border placeholder:text-gray-400 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="••••••••" required />
            </div>

            <div className="flex items-start gap-3 pt-2">
                <input type="checkbox" className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" required />
                <label className="text-sm text-gray-600">I agree to the <a href="#" className="text-blue-600 font-medium hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 font-medium hover:underline">Privacy Policy</a>.</label>
            </div>

            {/* Nút Đăng ký màu cam, kích thước chuẩn */}
            <button disabled={isPending} type="submit" className="w-full bg-[#f27a42] text-white p-4 flex items-center justify-center gap-2 rounded-xl font-bold text-lg hover:bg-[#e06830] transition duration-200 shadow-md disabled:bg-[#f39c71]">
              {isPending && <Loader2 size={20} className="animate-spin" />}
              {isPending ? 'signing up...' : 'sign up now'}
            </button>
          </form>

          {/* Dòng text dưới form */}
          <p className="mt-10 text-center text-gray-600 text-base font-light">
            Do you already have an account? <Link href="/login" className="text-blue-600 font-semibold hover:underline">Login now</Link>
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