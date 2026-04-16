"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, MapPin, Briefcase, ChevronDown,
  ChevronLeft, ChevronRight, BarChart2
} from 'lucide-react';
import { logout } from '@/backend/auth/actions';



// Hàm kiểm tra thẻ rỗng / không có thông tin
const isValidInfo = (val?: string) => {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  if (
    lower === 'n/a' ||
    lower === 'không có thông tin' ||
    lower === 'không yêu cầu' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === '-' ||
    lower === ''
  ) return false;
  return true;
};

const hasNoiseContent = (val?: string) => {
  const text = (val || '').toLowerCase();
  const noiseFragments = [
    'gross - net',
    'tính thuế thu nhập cá nhân',
    'tính bảo hiểm thất nghiệp',
    'tool check chống lừa đảo',
    'cẩm nang nghề nghiệp',
    'career insights',
  ];
  return noiseFragments.some((fragment) => text.includes(fragment));
};

const sanitizeDisplayValue = (val?: string) => {
  if (!isValidInfo(val)) return 'N/A';
  if (hasNoiseContent(val)) return 'N/A';
  return (val || '').replace(/\s+/g, ' ').trim();
};

export default function JobSearchPage({ user, jobs = [] }: { user?: any, jobs?: any[] }) {
  const [keyword, setKeyword] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Đồng bộ dữ liệu tuyển dụng, tránh trùng nhau theo url hoặc title-company
  const displayJobs = useMemo(() => {
    const merged = [...jobs];
    const seen = new Set<string>();

    return merged.filter((job, idx) => {
      const title = (job.tieu_de || job.title || '').trim().toLowerCase();
      const company = (job.cong_ty || job.company || '').trim().toLowerCase();
      const url = (job.url || '').trim().toLowerCase();
      const key = url || `${title}-${company}-${job.dia_diem || job.location || ''}-${idx}`;

      if (!isValidInfo(key)) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [jobs]);

  const locations = useMemo(() => {
    return Array.from(
      new Set(
        displayJobs
          .map((job) => (job.dia_diem || job.location || '').trim())
          .filter((location) => isValidInfo(location))
      )
    );
  }, [displayJobs]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        displayJobs
          .map((job) => (job.nganh_nghe || '').trim())
          .filter((category) => isValidInfo(category))
      )
    );
  }, [displayJobs]);

  const filteredJobs = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();

    return displayJobs.filter((job) => {
      const title = (job.tieu_de || job.title || '').toLowerCase();
      const company = (job.cong_ty || job.company || '').toLowerCase();
      const location = (job.dia_diem || job.location || '').trim();
      const category = (job.nganh_nghe || '').trim();

      const matchKeyword = !keywordLower || title.includes(keywordLower) || company.includes(keywordLower);
      const matchLocation = !selectedLocation || location === selectedLocation;
      const matchCategory = !selectedCategory || category === selectedCategory;

      return matchKeyword && matchLocation && matchCategory;
    });
  }, [displayJobs, keyword, selectedLocation, selectedCategory]);

  const isExternalJobUrl = (url?: string) => typeof url === 'string' && /^https?:\/\//i.test(url);

  return (
    <div className="min-h-screen bg-[#f4f2ee] font-sans flex flex-col">

      {/* --- HEADER --- */}
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
          <Link href="/search" className="text-blue-600 border-b-2 border-blue-600 pb-1">Job Search</Link>
          <Link href="#" className="hover:text-blue-600 transition">Market Insights</Link>
          <Link href="/ai" className="hover:text-blue-600 transition">AI Assistant</Link>
          <Link href="/profile" className="hover:text-blue-600 transition">My Profile</Link>
        </div>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span>Hi, {user.user_metadata?.full_name || 'User'}</span>
              </div>
              <button onClick={() => logout()} className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition shadow-sm hidden md:block cursor-pointer">
                Log Out
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </nav>

      {/* --- BỘ LỌC TÌM KIẾM --- */}
      <div className="bg-[#1a4b6b] py-6 px-4 md:px-12 w-full shadow-inner">
        <div className="max-w-5xl mx-auto">
          {/* Thanh tìm kiếm chính */}
          <div className="bg-white p-1.5 rounded-lg flex flex-col md:flex-row items-center gap-2 shadow-md">
            <div className="flex-1 flex items-center px-3 py-2 w-full">
              <Search className="text-gray-400 mr-2" size={20} />
              <input
                type="text"
                placeholder="Từ khóa, chức danh hoặc công ty"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full outline-none text-slate-800 placeholder-gray-400 bg-transparent"
              />
            </div>

            <div className="hidden md:block w-px h-8 bg-gray-200"></div>

            <div className="w-full md:w-56 flex items-center px-3 py-2">
              <MapPin className="text-gray-400 mr-2" size={20} />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full outline-none text-slate-800 bg-transparent cursor-pointer appearance-none"
              >
                <option value="">Địa điểm</option>
                {locations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-gray-400" size={16} />
            </div>

            <div className="hidden md:block w-px h-8 bg-gray-200"></div>

            <div className="w-full md:w-56 flex items-center px-3 py-2">
              <Briefcase className="text-gray-400 mr-2" size={20} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full outline-none text-slate-800 bg-transparent cursor-pointer appearance-none"
              >
                <option value="">Ngành nghề</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown className="text-gray-400" size={16} />
            </div>

            <button
              onClick={() => {
                setKeyword('');
                setSelectedLocation('');
                setSelectedCategory('');
              }}
              className="w-full md:w-auto bg-[#2463eb] hover:bg-blue-700 text-white px-8 py-3 rounded-md font-bold transition"
            >
              XÓA TÌM KIẾM
            </button>
          </div>

          {/* Các bộ lọc phụ */}
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

      {/* --- MAIN CONTENT AREA --- */}
      <div className="max-w-5xl mx-auto w-full px-4 md:px-12 py-10 flex-1">
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Kết quả tìm kiếm phù hợp
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredJobs.length} công việc)
              </span>
            </h2>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm"><ChevronLeft size={18} /></button>
              <button className="w-8 h-8 rounded-md border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-white hover:text-blue-600 transition shadow-sm"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Danh sách Việc làm */}
          <div className="flex flex-col gap-4">
            {filteredJobs.map((job, idx) => {
              // Hỗ trợ cả property của mock data và data cào về
              const title = sanitizeDisplayValue(job.tieu_de || job.title);
              const company = sanitizeDisplayValue(job.cong_ty || job.company);
              const salary = sanitizeDisplayValue(job.muc_luong || job.salary);
              const location = sanitizeDisplayValue(job.dia_diem || job.location);
              const category = job.nganh_nghe;
              const exp = job.kinh_nghiem_lam_viec;
              const logo = job.logo || job.logo_url;
              const expireDate = sanitizeDisplayValue(job.thong_tin_tuyen_dung?.het_han_nop);
              const jobKey = job.url || `${title || 'job'}-${company || 'company'}-${idx}`;

              return (
                <Link key={jobKey} href={`/job/${encodeURIComponent(encodeURIComponent(jobKey))}`} className="block group">
                  <div className="bg-white px-4 py-3 rounded-lg border border-blue-200 group-hover:border-blue-400 group-hover:shadow-md transition duration-200 flex gap-4 items-start">
                    {/* Khung Logo Công ty */}
                    <div className="w-14 h-14 bg-white rounded flex items-center justify-center flex-shrink-0 mt-1">
                      {isExternalJobUrl(logo) ? (
                        <img
                          src={logo}
                          alt={isValidInfo(company) ? company : 'Company logo'}
                          className="w-full h-full object-contain rounded-lg"
                          loading="lazy"
                        />
                      ) : (
                        <span className="font-bold text-gray-400 text-xs text-center">
                          {company ? company.substring(0, 4) : "LOGO"}
                        </span>
                      )}
                    </div>

                    {/* Thông tin việc làm */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg md:text-xl font-semibold text-[#3348a7] mb-1 group-hover:text-blue-700 transition truncate">
                        {isValidInfo(title) ? title : 'Chưa cập nhật chức danh'}
                      </h3>
                      {isValidInfo(company) && (
                        <p className="text-base md:text-lg text-slate-900 truncate uppercase font-bold mb-1">
                          {company}
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex items-center justify-between gap-3">
                          {isValidInfo(salary) && (
                            <span className="text-sm md:text-base text-slate-800 font-medium truncate">{salary}</span>
                          )}
                          <div className="text-[11px] md:text-xs text-gray-500 whitespace-nowrap text-right flex-shrink-0">
                            {isValidInfo(expireDate) ? `Hết hạn: ${expireDate}` : ''}
                          </div>
                        </div>
                        {isValidInfo(location) && (
                          <div className="text-sm text-gray-500 truncate flex items-center gap-1.5">
                            <MapPin size={14} className="flex-shrink-0" />
                            <span className="truncate">{location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {filteredJobs.length === 0 && (
              <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500">Chưa có dữ liệu việc làm nào. Hãy chạy script cào dữ liệu.</p>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
