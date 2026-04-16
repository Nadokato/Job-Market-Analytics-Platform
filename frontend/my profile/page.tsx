"use client";
import React from 'react';
import Link from 'next/link';
import { 
  Camera, 
  Pencil, 
  MoreHorizontal, 
  Eye, 
  Users, 
  BarChart2, 
  Search, 
  X, 
  ArrowRight,
  Briefcase,
  Building2,
  Settings,
  HelpCircle,
  ShieldAlert,
  Plus
} from 'lucide-react';
import { logout } from '@/backend/auth/actions';

export default function MyProfile({ user }: { user?: any }) {
  return (
    <div className="bg-[#f4f2ee] min-h-screen pb-10 text-[#000000e6]">
      {/* --- HEADER / NAVBAR --- */}
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
          <Link href="//search" className="text-blue-600 border-b-2 border-blue-600 pb-1">Job Search</Link>
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

      <main className="max-w-[1128px] mx-auto pt-6 px-4 xl:px-0">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column */}
          <div className="w-full lg:w-[73%] flex flex-col gap-4">
            
            {/* Profile Intro Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative pb-6">
              {/* Cover Image Area */}
              <div className="h-[200px] bg-[#a0b4b7] relative">
                {/* A light grey sweeping curve decoration similar to LinkedIn's default */}
                <div className="absolute top-0 right-0 w-3/4 h-full bg-[#cbd5db] rounded-bl-[100%] opacity-50 pointer-events-none"></div>
                
                <button className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-sm text-gray-600 hover:bg-gray-100 transition-colors">
                  <Camera size={20} />
                </button>
              </div>

              {/* Avatar Overlay */}
              <div className="absolute top-[100px] left-6">
                <div className="w-[152px] h-[152px] bg-white rounded-full p-1 relative">
                  <div className="w-full h-full rounded-full border-4 border-white overflow-hidden object-cover bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-6xl">
                    {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                </div>
              </div>

              {/* Edit Icon */}
              <div className="flex justify-end pt-4 pr-6">
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Pencil size={24} />
                </button>
              </div>

              {/* Profile Details */}
              <div className="px-6 mt-2">
                <h1 className="text-[24px] font-semibold leading-tight">
                   {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </h1>
                <p className="text-[16px] mt-1">--</p>
                <div className="text-[14px] text-gray-500 mt-1 flex items-center gap-1">
                  <span>Hanoi Capital Region</span>
                  <span>·</span>
                  <button className="text-[#0a66c2] font-semibold hover:underline decoration-[1.5px] underline-offset-1">
                    Contact info
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="bg-[#0a66c2] text-white px-4 py-1.5 rounded-full font-semibold hover:bg-[#004182] transition-colors leading-6 text-[15px]">
                    Open to
                  </button>
                  <button className="border border-[#0a66c2] text-[#0a66c2] px-4 py-1.5 rounded-full font-semibold hover:bg-[#eaf3ff] transition-colors leading-6 text-[15px] border-[1.5px]">
                    Add section
                  </button>
                  <button className="border border-gray-500 text-gray-600 px-4 py-1.5 rounded-full font-semibold hover:bg-gray-100 transition-colors shadow-sm leading-6 text-[15px]">
                    Enhance profile
                  </button>
                  <button className="border border-gray-500 text-gray-600 w-[34px] h-[34px] rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Upload your CV */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Upload your CV</h2>
              <p className="text-[14px] text-gray-800 mb-6">Upload your latest CV to easily apply for jobs and get discovered by recruiters.</p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-[#f0f6ff] hover:border-[#0a66c2] transition-colors cursor-pointer group">
                <div className="w-14 h-14 bg-white border border-gray-200 shadow-sm text-gray-500 group-hover:text-[#0a66c2] group-hover:border-[#0a66c2] rounded-full flex items-center justify-center mb-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                </div>
                <h3 className="text-[16px] font-semibold text-slate-800 group-hover:text-[#0a66c2] transition-colors">Click to upload or drag and drop</h3>
                <p className="text-[14px] text-gray-500 mt-1">PDF, DOC, DOCX (Max. 5MB)</p>
              </div>
            </div>

            {/* Experience Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Experience</h2>
              <p className="text-[14px] text-gray-800 mb-6">Showcase your accomplishments and get up to 2X as many profile views and connections.</p>
              
              <div className="flex items-start gap-4 text-gray-400">
                <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0">
                  <Briefcase size={24} className="text-gray-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-[16px]">Job title</h3>
                  <p className="text-[14px] mt-0.5">Organization</p>
                  <p className="text-[14px] mt-0.5">2023 - Present · 2 yrs</p>
                </div>
              </div>
              
              <button className="mt-5 border border-[#0a66c2] text-[#0a66c2] px-4 py-[5px] rounded-full font-semibold hover:bg-[#eaf3ff] transition-colors leading-6 text-[15px] border-[1.5px]">
                Add experience
              </button>
            </div>

            {/* Education Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Education</h2>
              <p className="text-[14px] text-gray-800 mb-6">Show your qualifications and be up to 2X more likely to receive a recruiter InMail.</p>
              
              <div className="flex items-start gap-4 text-gray-400">
                <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0">
                  <Building2 size={24} className="text-gray-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-[16px]">School</h3>
                  <p className="text-[14px] mt-0.5">Degree, Field of Study</p>
                  <p className="text-[14px] mt-0.5">2023 - Present · 2 yrs</p>
                </div>
              </div>
              
              <button className="mt-5 border border-[#0a66c2] text-[#0a66c2] px-4 py-[5px] rounded-full font-semibold hover:bg-[#eaf3ff] transition-colors leading-6 text-[15px] border-[1.5px]">
                Add education
              </button>
            </div>

            {/* Skills Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Skills</h2>
              <p className="text-[14px] text-gray-800 mb-6">Communicate your fit for new opportunities — 50% of hirers use skills data to fill their roles.</p>
              
              <div className="text-gray-400 space-y-4 mb-5">
                 <p className="text-[16px] font-semibold border-b border-gray-200 pb-2">Soft skills</p>
                 <p className="text-[16px] font-semibold border-b border-gray-200 pb-2">Technical Skills</p>
              </div>
              
              <button className="mt-2 border border-[#0a66c2] text-[#0a66c2] px-4 py-[5px] rounded-full font-semibold hover:bg-[#eaf3ff] transition-colors leading-6 text-[15px] border-[1.5px]">
                Add skills
              </button>
            </div>

          </div>

          {/* Right Column */}
          <div className="hidden lg:flex w-[27%] flex-col gap-4">
            
            {/* Top Right Card (Profile lang & URL) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-start group">
                <div>
                  <h3 className="font-semibold text-[15px] leading-tight">Profile language</h3>
                  <p className="text-[14px] text-gray-500 mt-1">English</p>
                </div>
                <button className="text-gray-600 p-1 rounded-full hover:bg-gray-100">
                  <Pencil size={20} />
                </button>
              </div>
              <div className="p-4 flex justify-between items-start group">
                <div>
                  <h3 className="font-semibold text-[15px] leading-tight">Public profile & URL</h3>
                  <p className="text-[12px] text-gray-500 mt-1 break-all w-[90%]">
                    www.linkedin.com/in/nadokato-undefined-4bb549402
                  </p>
                </div>
                <button className="text-gray-600 p-1 rounded-full hover:bg-gray-100">
                  <Pencil size={20} />
                </button>
              </div>
            </div>

            {/* You might like */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4">
                <h3 className="font-semibold text-[16px]">You might like</h3>
                <p className="text-[14px] text-gray-500 mb-4">Pages for you</p>
                
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <div className="w-12 h-12 bg-gray-800 shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      <img src="https://ui-avatars.com/api/?name=TCV&background=003366&color=fff&size=48" alt="TopCV" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[15px] truncate">TopCV Vietnam</h4>
                      <p className="text-[12px] text-gray-500 truncate">Human Resources Services</p>
                      <p className="text-[12px] text-gray-500 mb-2 truncate">169.558 followers</p>
                      <button className="border border-gray-600 text-gray-600 px-4 py-1 rounded-full font-semibold hover:bg-gray-100 transition-colors text-[14px] border-[1px] flex items-center gap-1 w-max">
                         <Plus size={16} /> Follow
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="w-12 h-12 shrink-0 bg-white border border-gray-200">
                       <img src="https://ui-avatars.com/api/?name=VNG&background=fff&color=f05123&size=48" alt="VNGGames" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[15px] truncate">VNGGames</h4>
                      <p className="text-[12px] text-gray-500 truncate">Technology, Information and Internet</p>
                      <p className="text-[12px] text-gray-500 mb-2 truncate">58,998 followers</p>
                      <button className="border border-gray-600 text-gray-600 px-4 py-1 rounded-full font-semibold hover:bg-gray-100 transition-colors text-[14px] border-[1px] flex items-center gap-1 w-max">
                         <Plus size={16} /> Follow
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 mt-2 hover:bg-gray-50 transition-colors rounded-b-lg">
                <button className="w-full py-2.5 flex items-center justify-center gap-1 text-[15px] font-semibold text-gray-600">
                  Show all <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Ad Banner */}
            <div className="rounded-lg shadow-sm border border-gray-200 overflow-hidden bg-[#001c38] text-white">
              <div className="p-4 relative pb-0">
                <div className="text-[10px] absolute top-2 right-2 text-gray-300">Ad</div>
                <div className="font-bold text-[14px] flex items-center gap-1 pt-1 opacity-90">
                  in
                </div>
                <p className="text-[16px] text-center mt-2 mx-2 mb-4 leading-snug">
                  Your job search <span className="text-[#72b5fb] font-semibold">powered by your network</span>
                </p>
                <div className="flex justify-center h-28 relative">
                   <div className="w-32 bg-[#fff] bg-opacity-20 rounded-t-xl mx-auto h-full flex flex-col justify-end overflow-hidden">
                       <div className="flex justify-center -mb-2">
                          {/* Simplistic mock representation of people */}
                          <div className="w-8 h-10 bg-[#a3b1c6] rounded-full -mx-1" />
                          <div className="w-10 h-12 bg-[#ecb22e] rounded-full -mx-1 z-10" />
                          <div className="w-8 h-10 bg-[#e0561f] rounded-full -mx-1" />
                       </div>
                   </div>
                   <button className="absolute bottom-16 left-[25%] bg-[#0a66c2] text-white px-3 py-1 rounded-full text-[10px] font-semibold border border-white">
                      Explore jobs
                   </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

    </div>
  );
}
