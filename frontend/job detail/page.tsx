"use client";

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search, MapPin, Briefcase, ChevronDown,
  BarChart2, Clock, DollarSign, Award,
  Share2, Heart, Flag, Building2, Link2
} from 'lucide-react';
import { FaFacebook, FaLinkedin } from 'react-icons/fa';
import { logout } from '@/backend/auth/actions';
import scrapedData from '../../scraped_data.json';



function JobDetailContent({ user, jobId }: { user?: any, jobId?: string }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('detail');

  const currentId = jobId || searchParams.get('id');

  const job = useMemo(() => {
    // Giải mã an toàn 2 lần để tìm được URL gốc (tránh lỗi url chứa kí tự đặc biệt)
    let decodedId = currentId || '';
    try { decodedId = decodeURIComponent(decodedId); } catch(e) {}
    try { decodedId = decodeURIComponent(decodedId); } catch(e) {}

    let found = scrapedData.find(j => j.url === currentId || j.url === decodedId);
    if (found) {
      return {
        title: found.tieu_de || 'Chưa cập nhật',
        company: found.cong_ty || 'Chưa cập nhật',
        salary: found.muc_luong || 'Thỏa thuận',
        location: found.dia_diem || found.thong_tin_tuyen_dung?.dia_diem_lam_viec || 'Chưa cập nhật',
        exp: found.kinh_nghiem_lam_viec || 'Không yêu cầu',
        type: found.hinh_thuc_lam_viec || 'Toàn thời gian',
        level: found.cap_bac || 'Nhân viên',
        desc: found.thong_tin_tuyen_dung?.mo_ta_cong_viec || 'Không có thông tin mô tả chi tiết.',
        req: found.thong_tin_tuyen_dung?.yeu_cau_cong_viec || 'Không có thông tin yêu cầu.',
        expire: found.thong_tin_tuyen_dung?.het_han_nop || 'Đang cập nhật...',
        logo: found.logo !== 'N/A' ? found.logo : null,
        benefits: found.thong_tin_tuyen_dung?.quyen_loi || 'Thỏa thuận theo năng lực và quy định của công ty.'
      };
    }
    
    return {
       title: "Không tìm thấy thông tin việc làm",
       company: "N/A",
       salary: "N/A",
       location: "N/A",
       exp: "N/A",
       type: "N/A",
       level: "N/A",
       desc: "Công việc này có thể đã bị xóa hoặc URL không hợp lệ.",
       req: "N/A",
       expire: "N/A",
       logo: null,
       benefits: "N/A"
    };
  }, [currentId]);

  return (
    <div className="min-h-screen bg-[#F3F5F7] font-sans flex flex-col text-slate-800">

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
          <Link href="/search" className="text-slate-600 hover:text-[#2463eb] transition">Job Search</Link>
          <Link href="#" className="text-slate-600 hover:text-[#2463eb] transition">Market Insights</Link>
          <Link href="/ai" className="text-slate-600 hover:text-[#2463eb] transition">AI Assistant</Link>
          <Link href="/profile" className="text-slate-600 hover:text-[#2463eb] transition">My Profile</Link>
        </div>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2463eb] flex items-center justify-center font-bold">
                  {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span>Hi, {user.user_metadata?.full_name || 'User'}</span>
              </div>
              <button onClick={() => logout()} className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-6 py-2.5 rounded-md font-medium transition cursor-pointer hidden md:block">
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

      {/* --- SUB NAVBAR TÌM KIẾM --- */}
      <div className="bg-white py-3 px-4 md:px-12 w-full border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 border border-gray-300 p-2 rounded flex items-center w-full">
            <Search className="text-gray-400 mr-2" size={18} />
            <input
              type="text"
                placeholder={job.title}
              className="w-full outline-none text-slate-800 placeholder-gray-400 text-sm"
                defaultValue={job.title}
            />
          </div>

          <div className="w-full md:w-48 border border-gray-300 p-2 rounded flex items-center">
            <MapPin className="text-gray-400 mr-2" size={18} />
            <select className="w-full outline-none text-slate-800 bg-transparent text-sm appearance-none cursor-pointer">
              <option value="">Hà Nội</option>
              <option value="hcm">Hồ Chí Minh</option>
            </select>
          </div>

          <div className="w-full md:w-48 border border-gray-300 p-2 rounded flex items-center">
            <Briefcase className="text-gray-400 mr-2" size={18} />
            <select className="w-full outline-none text-slate-800 bg-transparent text-sm appearance-none cursor-pointer">
              <option value="">Ngành nghề</option>
              <option value="it">IT - Phần mềm</option>
            </select>
          </div>

          <button className="w-full md:w-32 bg-[#2463eb] hover:bg-[#1d4ed8] text-white px-4 py-2.5 rounded font-bold transition text-sm">
            TÌM VIỆC
          </button>
        </div>
      </div>

      {/* --- BREADCRUMB --- */}
      <div className="max-w-6xl mx-auto w-full px-4 py-3 text-sm text-gray-500">
        Trang chủ {'>'} Việc làm {'>'} {job.title}
      </div>

      {/* --- ROOT CONTENT WRAPPER --- */}
      <div className="max-w-6xl mx-auto w-full px-4 pb-12">

        {/* TOP JOB CARD */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start lg:items-center justify-between gap-6 mb-6 relative">

          <div className="flex items-start gap-5">
            <div className="w-24 h-24 border border-gray-100 bg-white rounded-lg flex items-center justify-center p-2 flex-shrink-0 shadow-sm mt-1">
              {job.logo ? (
                <img src={job.logo} alt={job.company} className="w-full h-full object-contain" />
              ) : (
                <div className="font-bold text-gray-400 text-sm text-center">{job.company.substring(0, 6)}</div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#2463eb] mb-2 leading-tight">
                {job.title}
              </h1>
              <p className="text-lg font-bold text-slate-700 mb-2">{job.company}</p>
              <div className="flex flex-col gap-1.5 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><MapPin size={16} /> Địa điểm làm việc: {job.location}</span>
                <span className="flex items-center gap-1.5"><Clock size={16} /> Hết hạn nộp: {job.expire}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full md:w-auto flex-col sm:flex-row gap-3">
            <button className="bg-[#2463eb] hover:bg-[#1d4ed8] text-white px-8 py-3 rounded text-sm font-bold transition whitespace-nowrap shadow-md">
              Ứng tuyển ngay
            </button>
            <button className="bg-white hover:bg-gray-50 text-slate-600 border border-slate-300 px-8 py-3 rounded text-sm font-bold transition whitespace-nowrap flex items-center justify-center gap-2">
              <Heart size={18} /> Lưu việc
            </button>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN: Main info */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">

              {/* TABS */}
              <div className="flex border-b border-gray-200 mb-6 gap-8">
                <button
                  className={`pb-3 font-bold text-base border-b-2 transition ${activeTab === 'detail' ? 'border-[#2463eb] text-[#2463eb]' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
                  onClick={() => setActiveTab('detail')}
                >
                  Chi tiết công việc
                </button>
                <button
                  className={`pb-3 font-bold text-base border-b-2 transition ${activeTab === 'company' ? 'border-[#2463eb] text-[#2463eb]' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
                  onClick={() => setActiveTab('company')}
                >
                  Giới thiệu công ty
                </button>
              </div>

              {/* KEY STATS BAR */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#f8f9fa] p-4 rounded-lg mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#2463eb] flex-shrink-0">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Thu nhập</p>
                    <p className="text-sm font-bold text-slate-800">{job.salary}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Loại hình</p>
                    <p className="text-sm font-bold text-slate-800">{job.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                    <Award size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Kinh nghiệm</p>
                    <p className="text-sm font-bold text-slate-800">{job.exp}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                    <BarChart2 size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Chức vụ</p>
                    <p className="text-sm font-bold text-slate-800">{job.level}</p>
                  </div>
                </div>
              </div>

              {/* TAGS */}
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="bg-gray-100 text-gray-600 px-3 py-1 text-xs rounded border border-gray-200">Tiếng Hàn</span>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 text-xs rounded border border-gray-200">Giáo dục đào tạo</span>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 text-xs rounded border border-gray-200">Quản lý giáo dục</span>
              </div>

              {/* LONG FORMAT DETAILS */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-[#2463eb] pl-3">Mô tả công việc</h3>
              <div className="text-sm text-gray-700 leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans text-sm">{job.desc}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-[#2463eb] pl-3">Yêu cầu</h3>
              <div className="text-sm text-gray-700 leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans text-sm">{job.req}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-[#2463eb] pl-3">Quyền lợi</h3>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{job.benefits}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-[#2463eb] pl-3">Thông tin chung</h3>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <ul className="list-disc pl-5 space-y-1">
                  <li>Mức lương: {job.salary}</li>
                  <li>Cấp bậc: {job.level}</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 border-l-4 border-[#2463eb] pl-3">Nơi làm việc</h3>
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <ul className="list-disc pl-5 space-y-1">
                  <li>{job.location}</li>
                    </ul>
                  </div>
                </div>

                {/* BOTTOM APPLY AREA */}
                <div className="mt-8 bg-gray-50 border border-gray-200 p-6 rounded-lg text-center">
                  <h4 className="font-bold text-slate-800 mb-2">Cách thức ứng tuyển</h4>
                  <p className="text-sm text-gray-500 mb-4">Ứng viên nộp hồ sơ trực tuyến bằng cách bấm nút <strong>Ứng tuyển</strong> bên dưới.</p>
                <p className="text-sm font-semibold text-slate-700 mb-4">Hạn nộp: {job.expire}</p>

                  <div className="flex justify-center gap-3">
                    <button className="bg-[#2463eb] hover:bg-[#1d4ed8] text-white px-8 py-2.5 rounded font-bold transition shadow">
                      Ứng tuyển ngay
                    </button>
                    <button className="bg-white hover:bg-gray-100 border border-gray-300 text-slate-600 px-6 py-2.5 rounded transition">
                      Báo cáo tin
                    </button>
                  </div>
                </div>

                {/* SHARE LINKS */}
                <div className="flex justify-end items-center gap-3 mt-6 border-t pt-4 border-gray-100">
                  <span className="text-sm text-gray-500 font-medium">Chia sẻ:</span>
                  <button className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-[#1877F2] hover:text-white transition"><FaFacebook size={16} /></button>
                  <button className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-[#0A66C2] hover:text-white transition"><FaLinkedin size={16} /></button>
                  <button className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 transition"><Link2 size={16} /></button>
                </div>

              </div>
            </div>

            {/* GIỚI THIỆU CÔNG TY BOTTOM BLOCK */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Giới thiệu công ty</h3>
                <Link href="#" className="text-[#2463eb] text-sm hover:underline font-medium">Xem trang công ty {'»'}</Link>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 bg-gray-50 p-4 rounded-md border border-gray-100">
              <strong>{job.company}</strong> là một trong những công ty hàng đầu trong lĩnh vực hiện tại. Chúng tôi mang đến môi trường làm việc chuyên nghiệp và cơ hội thăng tiến cho các ứng viên.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6">

            {/* COMPANY WIDGET */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 border-t-4 border-t-[#2463eb]">
              <h3 className="font-bold text-base text-slate-800 mb-4 line-clamp-2 leading-tight">
              {job.company} <span className="text-yellow-500">🏆</span>
              </h3>

              <div className="text-sm text-gray-600 space-y-3 mb-6">
                <p className="flex items-start gap-2">
                  <MapPin size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                <span>Địa chỉ công ty: {job.location}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Quy mô: 100 - 499 nhân viên</span>
                </p>
              </div>

              <a href="#" className="text-sm text-[#2463eb] hover:underline font-medium flex justify-center border border-[#2463eb] py-2 rounded">
                Xem chi tiết công ty
              </a>
            </div>

            {/* JOB HOT */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <span className="text-red-500">🔥</span> Job hot
                </h3>
              </div>

              <div className="p-4 space-y-4">
                {scrapedData.slice(0, 4).map((job, idx) => (
                  <Link key={idx} href={`/job/${encodeURIComponent(encodeURIComponent(job.url))}`} className="block group border-b border-gray-100 pb-4 last:border-0 last:pb-0 cursor-pointer">
                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-[#2463eb] transition line-clamp-2 mb-1">
                      {job.tieu_de || 'Chưa cập nhật'}
                    </h4>
                    <p className="text-xs text-gray-500 mb-2 truncate uppercase">{job.cong_ty}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800 bg-gray-100 px-2 py-1 rounded truncate max-w-[50%]">{job.muc_luong}</span>
                      <span className="text-gray-500 truncate max-w-[45%]">{job.dia_diem}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* CẦU NỐI KẾT NỐI Banner */}
            <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-100 p-5 text-center">
              <h3 className="font-bold text-blue-800 mb-2">Hỗ trợ tìm việc</h3>
              <p className="text-xs text-blue-600 mb-4">Bạn chưa tìm thấy cơ hội phù hợp? Đăng ký nhận thông báo việc làm tự động từ chúng tôi.</p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded w-full transition">
                Tạo thông báo việc làm
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export default function JobDetailPage({ user, jobId }: { user?: any, jobId?: string }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F3F5F7] flex items-center justify-center text-slate-500">Đang tải dữ liệu...</div>}>
      <JobDetailContent user={user} jobId={jobId} />
    </Suspense>
  );
}
