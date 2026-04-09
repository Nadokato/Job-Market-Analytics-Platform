"use client";
import Link from 'next/link';

import React from 'react';
import { Search, MapPin, BarChart2 } from 'lucide-react';
import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa';
import { logout } from '@/backend/auth/actions';

export default function HomePage({ user }: { user?: any }) {
  return (
    <div className="min-h-screen font-sans bg-gray-50 flex flex-col relative overflow-hidden">

      {/* --- HEADER / NAVBAR --- */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white">
            <BarChart2 size={24} className="text-blue-400" />
          </div>
          <span className="font-bold text-2xl text-slate-800">
            Career<span className="text-blue-600">Intel</span>
            <span className="block text-[10px] text-gray-500 font-normal -mt-1">Intelligent Job Market Hub</span>
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
          <a href="/search" className="hover:text-blue-600 transition">Job Search</a>
          <a href="#" className="hover:text-blue-600 transition">Market Insights</a>
          <a href="#" className="hover:text-blue-600 transition">AI Assistant</a>
          <a href="#" className="hover:text-blue-600 transition">My Profile</a>
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

      {/* --- HERO SECTION --- */}
      <div className="bg-gradient-to-r from-[#0f3057] via-[#1a4b6b] to-[#127d73] pt-20 pb-48 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center text-white relative z-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Your Intelligence Hub for the Modern Job Market
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-10 font-light">
            Aggregate job postings, analyze market trends, and get AI-powered career guidance—all in one place
          </p>

          {/* Search Bar (Glassmorphism) */}
          <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl flex flex-col md:flex-row gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <div className="flex-1 flex items-center bg-white rounded-lg px-4 py-3">
              <Search className="text-gray-400 mr-3" size={20} />
              <input
                type="text"
                placeholder="Job Title or Keywords"
                className="w-full text-gray-800 outline-none placeholder-gray-400 bg-transparent"
              />
            </div>

            <div className="hidden md:flex items-center justify-center px-2">
              <div className="h-8 w-px bg-white/30"></div>
            </div>

            <div className="flex-1 flex items-center bg-white rounded-lg px-4 py-3">
              <MapPin className="text-gray-400 mr-3" size={20} />
              <input
                type="text"
                placeholder="Location"
                className="w-full text-gray-800 outline-none placeholder-gray-400 bg-transparent"
              />
            </div>

            <button className="bg-[#2463eb] hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition shadow-md w-full md:w-auto">
              Find Jobs
            </button>
          </div>
        </div>

        {/* Abstract Background Elements */}
        <div className="absolute right-0 top-10 opacity-30 hidden lg:block">
          <BarChart2 size={300} className="text-teal-400" strokeWidth={0.5} />
        </div>
      </div>

      {/* --- FEATURE CARDS SECTION --- */}
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-8 px-6 -mt-28 relative z-20 pb-20">

        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col items-center text-center hover:-translate-y-1 transition duration-300">
          <div className="h-44 w-full mb-6 flex items-center justify-center">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-3">
                <div className="px-3 py-1 border shadow-sm rounded font-bold text-blue-700 bg-white">in</div>
                <div className="px-3 py-1 border shadow-sm rounded font-bold text-green-600 bg-white">TopCV</div>
                <div className="px-3 py-1 border shadow-sm rounded font-bold text-gray-700 bg-white">Joboko</div>
              </div>
              <div className="text-teal-600 text-2xl font-bold">→</div>
              <div className="w-16 h-20 bg-[#12586b] rounded-lg border-b-8 border-[#0c4354] flex flex-col gap-2 p-2 shadow-inner">
                <div className="h-2 w-full bg-teal-400 rounded-full"></div>
                <div className="h-2 w-full bg-teal-400 rounded-full"></div>
                <div className="h-2 w-full bg-teal-400 rounded-full"></div>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">Aggregated Job Postings</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Access millions of listings aggregated from major global and regional portals instantly.
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col items-center text-center hover:-translate-y-1 transition duration-300">
          <div className="h-44 w-full mb-6 flex items-center justify-center">
            <div className="w-full h-full flex flex-col gap-2 p-2">
              <div className="flex-1 flex gap-2">
                <div className="flex-1 border border-gray-100 shadow-sm rounded flex items-end p-2 bg-white">
                  <svg viewBox="0 0 100 50" className="w-full h-full text-teal-400 stroke-current"><polyline fill="none" strokeWidth="3" points="0,40 20,25 40,35 60,10 80,15 100,0" /></svg>
                </div>
                <div className="flex-1 border border-gray-100 shadow-sm rounded flex items-end justify-around px-2 pb-1 bg-white">
                  <div className="w-3 bg-blue-500 h-[40%] rounded-t-sm"></div>
                  <div className="w-3 bg-orange-400 h-[80%] rounded-t-sm"></div>
                  <div className="w-3 bg-green-500 h-[60%] rounded-t-sm"></div>
                  <div className="w-3 bg-teal-400 h-[30%] rounded-t-sm"></div>
                </div>
              </div>
              <div className="flex-1 border border-gray-100 shadow-sm rounded flex items-center justify-center p-2 bg-white relative">
                <span className="text-sm font-bold text-teal-700 absolute top-2 left-4">Data Science</span>
                <span className="text-xs font-semibold text-blue-600 absolute bottom-2 left-6">Python</span>
                <span className="text-xs font-semibold text-green-500 absolute top-4 right-4">React</span>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">Real-Time Market Analytics</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Explore interactive dashboards visualizing salary ranges, skill demand, and industry growth.
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col items-center text-center hover:-translate-y-1 transition duration-300">
          <div className="h-44 w-full mb-6 flex items-center justify-center relative">
            <div className="w-28 h-28 bg-[#cbf0eb] rounded-full flex items-center justify-center relative">
              <div className="w-16 h-14 bg-white rounded-2xl border-4 border-[#32b5a1] flex flex-col items-center justify-center gap-1.5 shadow-sm">
                <div className="flex gap-3">
                  <div className="w-2.5 h-2.5 bg-slate-800 rounded-full"></div>
                  <div className="w-2.5 h-2.5 bg-slate-800 rounded-full"></div>
                </div>
                <div className="w-6 h-1 bg-slate-800 rounded-full"></div>
              </div>
              <div className="absolute -top-1 -right-2 bg-blue-500 rounded-lg p-1.5 px-2.5 flex gap-1 shadow-md">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">AI-Powered Career Assistant</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Get personalized job recommendations, CV optimization tips, and interview preparation advice from our intelligent chatbot.
          </p>
        </div>

      </div>

      <div className="flex-1"></div>

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-gray-200 py-6 px-6 md:px-12 mt-auto z-20 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-600">
            <a href="#" className="hover:text-slate-900 transition">About Us</a>
            <a href="#" className="hover:text-slate-900 transition">Terms of Service</a>
            <a href="#" className="hover:text-slate-900 transition">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900 transition">Contact</a>
          </div>

          {/* Social Icons */}
          <div className="flex gap-4 text-gray-500">
            <a href="#" className="hover:text-blue-600 transition"><FaFacebook size={20} /></a>
            <a href="#" className="hover:text-black transition"><FaTwitter size={20} /></a>
            <a href="#" className="hover:text-red-600 transition"><FaYoutube size={20} /></a>
            <a href="#" className="hover:text-black transition flex items-center justify-center w-5 h-5 rounded font-bold text-xs bg-gray-500 text-white hover:bg-black">
              t
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
