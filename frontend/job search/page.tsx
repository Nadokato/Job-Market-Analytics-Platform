"use client";

import React from 'react';
import Link from 'next/link';
import { 
  Search, MapPin, Briefcase, ChevronDown, 
  ChevronLeft, ChevronRight, BarChart2 
} from 'lucide-react';

const mockJobs = [
  { id: 1, title: "Nhân Viên Telesale/Tư Vấn Bảo Hiểm Chăm Sóc Sức Khỏe", company: "CÔNG TY TNHH ALWAYS CARE", salary: "7 - 9 triệu VND + HH", location: "Hồ Chí Minh", hot: true },
  { id: 2, title: "Giám Sát Kỹ Thuật Hiện Trường (Không Yêu Cầu Kinh Nghiệm)", company: "CÔNG TY CỔ PHẦN ALUMAX VIỆT NAM", salary: "7 triệu VND + PC", location: "Hà Nội", hot: true },
  { id: 3, title: "Nhân Viên Kinh Doanh/Sale/Tư Vấn - Lương Cứng Tốt", company: "CÔNG TY CỔ PHẦN DKRA VEGA", salary: "40 - 65 triệu VND", location: "Hồ Chí Minh", hot: true },
  { id: 4, title: "Cán Bộ An Toàn Lao Động (Làm Việc Tại Công Trình)", company: "CÔNG TY CỔ PHẦN ALUMAX VIỆT NAM", salary: "15 - 18 triệu VND", location: "Hà Nội", hot: true },
  { id: 5, title: "Nhân Viên Kinh Doanh Bất Động Sản - Thu Nhập Hấp Dẫn", company: "CÔNG TY CỔ PHẦN ĐẦU TƯ VIỆT Á LAND", salary: "50 - 200 Triệu VND", location: "Hồ Chí Minh", hot: true },
  { id: 6, title: "Service Engineer - Kỹ Sư Tự Động Hóa", company: "CÔNG TY TNHH ISHIDA VIỆT NAM", salary: "Thỏa thuận", location: "Hồ Chí Minh", hot: true },
];

export default function JobSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      
      {/* --- HEADER (Giống hệt trang chủ CareerIntel) --- */}
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
        
        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          <Link href="/jobs" className="text-blue-600 border-b-2 border-blue-600 pb-1">Job Search</Link>
          <Link href="#" className="hover:text-blue-600 transition">Market Insights</Link>
          <Link href="#" className="hover:text-blue-600 transition">AI Assistant</Link>
          <Link href="#" className="hover:text-blue-600 transition">My Profile</Link>
        </div>
        
        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          <Link href="/signup">
            <button className="bg-[#f27a42] hover:bg-[#e06830] text-white px-6 py-2.5 rounded-md font-medium transition shadow-md hidden md:block">
              Sign Up
            </button>
          </Link>
          <Link href="/login">
            <button className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm hidden md:block">
              Log In
            </button>
          </Link>
        </div>
      </nav>

      {/* --- BỘ LỌC TÌM KIẾM --- */}
      {/* Đổi màu nền sang tone xanh đậm đồng bộ với trang chủ */}
      <div className="bg-[#1a4b6b] py-6 px-4 md:px-12 w-full shadow-inner">
        <div className="max-w-5xl mx-auto">
          {/* Thanh tìm kiếm chính */}
          <div className="bg-white p-1.5 rounded-lg flex flex-col md:flex-row items-center gap-2 shadow-md">
            <div className="flex-1 flex items-center px-3 py-2 w-full">
              <Search className="text-gray-400 mr-2" size={20} />
              <input 
                type="text" 
                placeholder="Từ khóa, chức danh hoặc công ty" 
                className="w-full outline-none text-slate-800 placeholder-gray-400 bg-transparent"
              />
            </div>
            
            <div className="hidden md:block w-px h-8 bg-gray-200"></div>
            
            <div className="w-full md:w-56 flex items-center px-3 py-2">
              <MapPin className="text-gray-400 mr-2" size={20} />
              <select className="w-full outline-none text-slate-800 bg-transparent cursor-pointer appearance-none">
                <option value="">Địa điểm</option>
                <option value="hn">Hà Nội</option>
                <option value="hcm">Hồ Chí Minh</option>
              </select>
              <ChevronDown className="text-gray-400" size={16} />
            </div>

            <div className="hidden md:block w-px h-8 bg-gray-200"></div>

            <div className="w-full md:w-56 flex items-center px-3 py-2">
              <Briefcase className="text-gray-400 mr-2" size={20} />
              <select className="w-full outline-none text-slate-800 bg-transparent cursor-pointer appearance-none">
                <option value="">Ngành nghề</option>
                <option value="it">IT - Phần mềm</option>
                <option value="kinhdoanh">Kinh doanh / Bán hàng</option>
              </select>
              <ChevronDown className="text-gray-400" size={16} />
            </div>

            <button className="w-full md:w-auto bg-[#2463eb] hover:bg-blue-700 text-white px-8 py-3 rounded-md font-bold transition">
              TÌM VIỆC
            </button>
          </div>

          {/* Các bộ lọc phụ (Sub-filters) */}
          <div className="flex flex-wrap gap-2 mt-4">
            {['Tất cả thời gian', 'Tất cả loại hình', 'Mức lương', 'Tất cả cấp bậc', 'Tất cả kinh nghiệm'].map((filter, index) => (
              <button key={index} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm px-4 py-2 rounded-md flex items-center gap-1 transition">
                {filter} <ChevronDown size={14} />
              </button>
            ))}
            <button className="text-blue-200 hover:text-white text-sm px-3 py-2 underline transition">
              Xóa lọc
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA (1 CỘT DUY NHẤT) --- */}
      {/* Thu hẹp max-w-5xl để khi hiển thị 1 dòng trông không bị quá loãng */}
      <div className="max-w-5xl mx-auto w-full px-4 md:px-12 py-10 flex-1">
        
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Kết quả tìm kiếm phù hợp</h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm"><ChevronLeft size={18} /></button>
              <button className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Danh sách Việc làm - Dạng flex-col (1 dòng 1 mục) */}
          <div className="flex flex-col gap-4">
            {mockJobs.map((job) => (
              <div key={job.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition duration-200 cursor-pointer flex flex-col md:flex-row gap-5 items-start md:items-center justify-between group">
                
                <div className="flex gap-5 items-center w-full md:w-auto flex-1">
                  {/* Khung Logo Công ty */}
                  <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-gray-400 text-xs text-center">{job.company.substring(0, 4)}</span>
                  </div>
                  
                  {/* Thông tin việc làm */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition">
                      {job.hot && <span className="inline-block bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded font-bold mr-2 align-middle">HOT</span>}
                      {job.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate uppercase font-medium">{job.company}</p>
                  </div>
                </div>

                {/* Cột Mức lương & Địa điểm (Đẩy sang bên phải màn hình) */}
                <div className="flex flex-col md:items-end w-full md:w-auto mt-2 md:mt-0 pl-21 md:pl-0">
                  <p className="text-base font-bold text-[#f27a42] mb-1">{job.salary}</p>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5 font-medium">
                    <MapPin size={14} className="text-gray-400" /> {job.location}
                  </p>
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
      
    </div>
  );
}