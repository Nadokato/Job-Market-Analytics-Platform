"use client";
import Link from 'next/link';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, BarChart2, Briefcase, ChevronDown } from 'lucide-react';
import { FaFacebook, FaTwitter, FaYoutube } from 'react-icons/fa';
import { logout } from '@/backend/auth/actions';
import { useRouter } from 'next/navigation';

const toggleItem = <T,>(arr: T[], item: T): T[] =>
  arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

interface DropdownFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  searchable?: boolean;
}

const DropdownFilter = ({ label, icon, options, selected, onToggle, onClear, searchable }: DropdownFilterProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (options.length === 0) return null;
  const activeCount = selected.length;

  const filteredOptions = searchable && query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative w-full md:w-56">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center px-3 py-2 text-slate-800 bg-transparent cursor-pointer select-none outline-none justify-between h-full"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {icon}
          <span className="truncate text-[15px] text-gray-700">
            {activeCount === 0 ? label : activeCount === 1 ? selected[0] : `${label} (${activeCount})`}
          </span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-3 z-50 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[240px] max-w-[280px] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            {activeCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
              >
                Xóa ({activeCount})
              </button>
            )}
          </div>
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded outline-none focus:border-blue-400 placeholder-gray-400 text-slate-700"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">Không tìm thấy lựa chọn</div>
            ) : (
              filteredOptions.map((opt) => {
                const isActive = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={(e) => { e.stopPropagation(); onToggle(opt); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-gray-50'
                      }`}
                  >
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isActive ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                      {isActive && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function HomePage({ user }: { user?: any }) {
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchLocations, setSearchLocations] = useState<string[]>([]);
  const [searchCategories, setSearchCategories] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/v1/jobs/options')
      .then(r => r.json())
      .then(d => {
        if (d.locations) setLocationOptions(d.locations);
        if (d.categories) setCategoryOptions(d.categories);
      });
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchKeyword) params.set('keyword', searchKeyword);
    searchLocations.forEach(loc => params.append('location', loc));
    searchCategories.forEach(cat => params.append('category', cat));
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen font-sans bg-[#f4f2ee] flex flex-col relative overflow-hidden">

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
          <a href="/insights" className="hover:text-blue-600 transition">Market Insights</a>
          <a href="/ai" className="hover:text-blue-600 transition">AI Assistant</a>
          <a href="/profile" className="hover:text-blue-600 transition">My Profile</a>
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
      <div className="bg-gradient-to-r from-[#0f3057] via-[#1a4b6b] to-[#127d73] pt-20 pb-48 px-4 relative">
        <div className="max-w-4xl mx-auto text-center text-white relative">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Your Intelligence Hub for the Modern Job Market
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-10 font-light">
            Aggregate job postings, analyze market trends, and get AI-powered career guidance—all in one place
          </p>

          {/* Search Bar */}
          <div className="bg-white p-1.5 rounded-lg flex flex-col md:flex-row items-center gap-2 shadow-xl relative z-30">
            <div className="flex-1 flex items-center px-3 py-2 w-full">
              <Search className="text-gray-400 mr-2" size={20} />
              <input
                type="text"
                placeholder="Từ khóa, chức danh hoặc công ty"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full outline-none text-slate-800 placeholder-gray-400 bg-transparent"
              />
            </div>

            <div className="hidden md:block w-px h-8 bg-gray-200" />

            <DropdownFilter
              label="Tất cả địa điểm"
              icon={<MapPin className="text-gray-400" size={20} />}
              options={locationOptions}
              selected={searchLocations}
              onToggle={(v) => setSearchLocations(toggleItem(searchLocations, v))}
              onClear={() => setSearchLocations([])}
              searchable
            />

            <div className="hidden md:block w-px h-8 bg-gray-200" />

            <DropdownFilter
              label="Ngành nghề"
              icon={<Briefcase className="text-gray-400" size={20} />}
              options={categoryOptions}
              selected={searchCategories}
              onToggle={(v) => setSearchCategories(toggleItem(searchCategories, v))}
              onClear={() => setSearchCategories([])}
              searchable
            />

            <button
              onClick={handleSearch}
              className="w-full md:w-auto bg-[#2463eb] hover:bg-blue-700 text-white px-8 py-3 rounded-md font-bold transition"
            >
              TÌM VIỆC
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
