"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart2, ChevronDown, ArrowUpRight, X } from "lucide-react";
import { logout } from "@/backend/auth/actions";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const INVALID = ["n/a", "không có thông tin", "không yêu cầu", "null", "undefined", "-", "", "thương lượng"];
const isValid = (v?: string) => !!v && !INVALID.includes(v.toLowerCase().trim());

const isFx = (s: string) =>
  /\b(usd|\$|eur|€|gbp|£|jpy|¥|sgd|aud|cad|hkd|krw|thb|myr|inr|cny|rmb)\b/i.test(s);

const parseSalary = (raw?: string): { min: number; max: number } | null => {
  if (!raw || !isValid(raw) || isFx(raw)) return null;
  const s = raw.toLowerCase();
  const trn = (tok: string) => {
    const m = tok.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
    return m ? parseFloat(m[1].replace(",", ".")) : null;
  };
  const over = s.match(/trên\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  if (over) { const v = trn(over[1] + "tr")!; return { min: v, max: v * 1.5 }; }
  const rng = s.match(/(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)?\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu)?)/);
  if (rng) { const lo = trn(rng[1] + "tr"); const hi = trn(rng[2] + "tr"); if (lo && hi) return { min: lo, max: hi }; }
  const single = s.match(/(\d+(?:[.,]\d+)?)\s*tr(?:iệu)?/);
  if (single) { const v = trn(single[1] + "tr")!; return { min: v, max: v }; }
  return null;
};

const avgSalary = (raw?: string) => {
  const r = parseSalary(raw);
  return r ? (r.min + r.max) / 2 : null;
};

const parseExp = (raw?: string): number | null => {
  if (!raw || !isValid(raw)) return null;
  const t = raw.toLowerCase();
  if (/không yêu cầu|chưa có/.test(t)) return 0;
  const rng = t.match(/(\d+)\s*[-–]\s*(\d+)\s*(năm|tháng)/);
  if (rng) { const isM = /tháng/.test(rng[3]); return ((+rng[1] + +rng[2]) / 2) / (isM ? 12 : 1); }
  const single = t.match(/(\d+)\s*(năm|tháng)/);
  if (single) { const v = +single[1]; return /tháng/.test(single[2]) ? v / 12 : v; }
  return null;
};

// ─── Compute salary stats for a filtered job list ─────────────────────────────
// Returns proper overall min/avg/max from all salary ranges in matched jobs.
function computeStats(jobs: any[]) {
  const ranges = jobs
    .map(j => parseSalary(j.muc_luong))
    .filter((r): r is { min: number; max: number } => r !== null);

  const validCount = ranges.length;

  if (validCount < 1) return { avg: 0, min: 0, max: 0, count: jobs.length, validCount, hasData: false };

  const allMins = ranges.map(r => r.min);
  const allMaxs = ranges.map(r => r.max);
  const allAvgs = ranges.map(r => (r.min + r.max) / 2);

  return {
    avg: allAvgs.reduce((a, b) => a + b) / allAvgs.length,
    min: Math.min(...allMins),
    max: Math.max(...allMaxs),
    count: jobs.length,
    validCount,
    hasData: true,
  };
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ user }: { user?: any }) {
  return (
    <nav className="flex justify-between items-center px-6 md:px-12 py-4 bg-white z-20 relative shadow-sm sticky top-0">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
          <BarChart2 size={24} className="text-blue-400" />
        </div>
        <span className="font-bold text-2xl text-slate-800">
          Career<span className="text-blue-600">Intel</span>
          <span className="block text-[10px] text-gray-500 font-normal -mt-1">Intelligent Job Market Hub</span>
        </span>
      </Link>

      <div className="hidden lg:flex items-center gap-8 font-semibold text-sm text-slate-800">
        <Link href="/search" className="hover:text-blue-600 transition">Job Search</Link>
        <Link href="/insights" className="text-blue-600 border-b-2 border-blue-600 pb-1">Market Insights</Link>
        <Link href="/ai" className="hover:text-blue-600 transition">AI Assistant</Link>
        <Link href="/profile" className="hover:text-blue-600 transition">My Profile</Link>
      </div>

      <div className="hidden lg:flex items-center gap-4 font-semibold text-sm text-slate-800">
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <span>Hi, {user.user_metadata?.full_name || "User"}</span>
            </div>
            <button onClick={() => logout()} className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-5 py-2 rounded-md font-medium transition cursor-pointer">
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link href="/signup"><button className="bg-[#f27a42] hover:bg-[#e06830] text-white px-5 py-2 rounded-md font-medium transition shadow-md">Sign Up</button></Link>
            <Link href="/login"><button className="bg-gray-100 hover:bg-gray-200 text-slate-800 px-5 py-2 rounded-md font-medium transition">Log In</button></Link>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── Salary bar (single row) ───────────────────────────────────────────────────
function SalaryBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold text-slate-700 w-14 text-right shrink-0">{value.toFixed(1)} Tr</span>
    </div>
  );
}


// ─── Company Logo ──────────────────────────────────────────────────────────────
function CompanyLogo({ logo, name, size = 38 }: { logo?: string; name?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = (name || "?").replace(/công ty|tnhh|cổ phần|tập đoàn/gi, "").trim().charAt(0).toUpperCase();
  const COLORS = ["#06b6d4", "#6366f1", "#f59e0b", "#10b981", "#f97316", "#8b5cf6"];
  const bg = COLORS[(name || "").charCodeAt(0) % COLORS.length];

  if (logo && logo.startsWith("http") && !err) {
    return (
      <div className="rounded-full overflow-hidden border border-gray-100 bg-white flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <img src={logo} alt={name || ""} className="w-full h-full object-contain" onError={() => setErr(true)} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: bg }}>
      {initials}
    </div>
  );
}

// ─── Selector card (A or B) ────────────────────────────────────────────────────
interface SelectorState { industry: string; level: string; }
const EMPTY_SEL: SelectorState = { industry: "", level: "" };

function SelectorCard({
  label, color, bgColor, borderColor, side,
  industries, levels, value, onChange,
}: {
  label: string; color: string; bgColor: string; borderColor: string; side: "A" | "B";
  industries: string[]; levels: string[];
  value: SelectorState;
  onChange: (v: SelectorState) => void;
}) {
  const hasAny = value.industry || value.level;
  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${hasAny ? borderColor + " bg-white shadow-sm" : "border-gray-200 bg-gray-50/60"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full ${bgColor} flex items-center justify-center text-xs font-bold text-white`} style={{ backgroundColor: color }}>
            {side}
          </div>
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</span>
        </div>
        {hasAny && (
          <button
            onClick={() => onChange(EMPTY_SEL)}
            className="text-gray-300 hover:text-gray-500 transition"
            title="Xoá bộ lọc"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown: Ngành nghề */}
      <div className="mb-2">
        <label className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1 block">Ngành nghề</label>
        <div className="relative">
          <select
            value={value.industry}
            onChange={e => onChange({ ...value, industry: e.target.value })}
            className="w-full text-sm text-slate-800 bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 outline-none appearance-none cursor-pointer focus:border-blue-400 transition"
          >
            <option value="">— Tất cả ngành —</option>
            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Dropdown: Cấp bậc */}
      <div>
        <label className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1 block">Cấp bậc</label>
        <div className="relative">
          <select
            value={value.level}
            onChange={e => onChange({ ...value, level: e.target.value })}
            className="w-full text-sm text-slate-800 bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 outline-none appearance-none cursor-pointer focus:border-blue-400 transition"
          >
            <option value="">— Tất cả cấp bậc —</option>
            {levels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MarketInsightsPage({ user, jobs = [] }: { user?: any; jobs?: any[] }) {

  // ── Distinct options ─────────────────────────────────────────────────────────
  const industryOpts = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach(j => (j.nganh_nghe || "").split(",").map((x: string) => x.trim()).filter(Boolean).forEach((ind: string) => s.add(ind)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "vi"));
  }, [jobs]);

  const levelOpts = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach(j => { const l = (j.cap_bac || "").trim(); if (isValid(l)) s.add(l); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "vi"));
  }, [jobs]);

  // ── Selector state ────────────────────────────────────────────────────────────
  const [selA, setSelA] = useState<SelectorState>(EMPTY_SEL);
  const [selB, setSelB] = useState<SelectorState>(EMPTY_SEL);

  // A side is "active" if at least one filter is chosen
  const activeA = !!(selA.industry || selA.level);
  const activeB = !!(selB.industry || selB.level);

  // ── Filter jobs for each side ─────────────────────────────────────────────────
  const filterJobs = (sel: SelectorState) => {
    return jobs.filter(j => {
      const industries = (j.nganh_nghe || "").split(",").map((x: string) => x.trim()).filter(Boolean);
      const level = (j.cap_bac || "").trim();
      const matchInd = !sel.industry || industries.includes(sel.industry);
      const matchLvl = !sel.level || level === sel.level;
      return matchInd && matchLvl;
    });
  };

  const jobsA = useMemo(() => activeA ? filterJobs(selA) : [], [selA, jobs]);
  const jobsB = useMemo(() => activeB ? filterJobs(selB) : [], [selB, jobs]);

  const statsA = useMemo(() => computeStats(jobsA), [jobsA]);
  const statsB = useMemo(() => computeStats(jobsB), [jobsB]);

  // Label for each side
  const labelA = [selA.industry, selA.level].filter(Boolean).join(" · ") || "Bên A";
  const labelB = [selB.industry, selB.level].filter(Boolean).join(" · ") || "Bên B";

  // Max for bar scaling
  const compareMax = Math.max(statsA?.max ?? 0, statsB?.max ?? 0) || 30;

  // ── Summary stats (global) ────────────────────────────────────────────────────
  const allAvg = jobs.map(j => avgSalary(j.muc_luong)).filter((v): v is number => v !== null);
  const overallAvg = allAvg.length ? allAvg.reduce((a, b) => a + b) / allAvg.length : 0;
  const maxSal = allAvg.length ? Math.max(...allAvg) : 0;

  // ── Top salary sections — derived from active filter sides ──────────────────
  const topSections = useMemo(() => {
    const buildSection = (srcJobs: any[], label: string, color: string, sel: SelectorState) => ({
      label,
      color,
      sel,
      items: srcJobs
        .map(j => ({ ...j, _avg: avgSalary(j.muc_luong) }))
        .filter(j => j._avg !== null)
        .sort((a: any, b: any) => b._avg - a._avg)
        .slice(0, 8),
    });
    const sections = [];
    if (activeA && statsA?.hasData) sections.push(buildSection(jobsA, labelA, "#0d9488", selA));
    if (activeB && statsB?.hasData) sections.push(buildSection(jobsB, labelB, "#6366f1", selB));
    return sections;
  }, [jobsA, jobsB, activeA, activeB, labelA, labelB, selA, selB, statsA?.hasData, statsB?.hasData]);

  return (
    <div className="min-h-screen bg-[#f4f2ee] font-sans flex flex-col">
      <Navbar user={user} />

      {/* ── Hero ── */}
      <div className="bg-gradient-to-r from-[#0f3057] via-[#1a4b6b] to-[#127d73] pt-7 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Market Insights</h1>
          <p className="text-blue-200 text-sm">Phân tích xu hướng thị trường việc làm và mức lương từ dữ liệu thực tế</p>

        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto w-full px-4 md:px-6 py-5 flex-1 space-y-5">

        {/* ─── SO SÁNH CÔNG VIỆC ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="text-center pt-5 pb-1">
            <h2 className="text-sm font-bold text-slate-700 tracking-widest uppercase">So sánh công việc</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Chọn ngành nghề và/hoặc cấp bậc cho mỗi bên để so sánh mức lương</p>
          </div>

          <div className="px-5 pb-5 pt-4">
            {/* Two selector cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <SelectorCard
                label="Bên A" side="A" color="#0d9488" bgColor="bg-teal-500" borderColor="border-teal-400"
                industries={industryOpts} levels={levelOpts}
                value={selA} onChange={setSelA}
              />
              <SelectorCard
                label="Bên B" side="B" color="#6366f1" bgColor="bg-indigo-500" borderColor="border-indigo-400"
                industries={industryOpts} levels={levelOpts}
                value={selB} onChange={setSelB}
              />
            </div>

            {/* ── Results ── */}
            {!activeA && !activeB ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <BarChart2 size={22} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">Chọn ngành nghề hoặc cấp bậc ở bất kỳ bên nào để xem phân tích lương</p>
              </div>
            ) : (
              <div>
                {/* Salary bars — show whichever side is active */}
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  So sánh mức lương
                  {activeA && <span className="text-[#0d9488] font-bold"> {labelA}</span>}
                  {activeA && activeB && <span className="text-gray-400"> vs</span>}
                  {activeB && <span className="text-[#6366f1] font-bold"> {labelB}</span>}
                </p>

                <div className="space-y-4">
                  {/* Min — only show row if at least one side has data */}
                  {(activeA && statsA?.hasData) || (activeB && statsB?.hasData) ? (
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1.5">Lương thấp nhất</p>
                      {activeA && statsA?.hasData && <SalaryBar label={labelA} value={statsA.min} max={compareMax} color="#0d9488" />}
                      {activeB && statsB?.hasData && <SalaryBar label={labelB} value={statsB.min} max={compareMax} color="#6366f1" />}
                    </div>
                  ) : null}
                  {/* Avg */}
                  {(activeA && statsA?.hasData) || (activeB && statsB?.hasData) ? (
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1.5">Lương trung bình</p>
                      {activeA && statsA?.hasData && <SalaryBar label={labelA} value={statsA.avg} max={compareMax} color="#0d9488" />}
                      {activeB && statsB?.hasData && <SalaryBar label={labelB} value={statsB.avg} max={compareMax} color="#6366f1" />}
                    </div>
                  ) : null}
                  {/* Max */}
                  {(activeA && statsA?.hasData) || (activeB && statsB?.hasData) ? (
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1.5">Lương cao nhất</p>
                      {activeA && statsA?.hasData && <SalaryBar label={labelA} value={statsA.max} max={compareMax} color="#0d9488" />}
                      {activeB && statsB?.hasData && <SalaryBar label={labelB} value={statsB.max} max={compareMax} color="#6366f1" />}
                    </div>
                  ) : null}
                  {/* No data at all */}
                  {!activeA && !activeB ? null : !(statsA?.hasData) && !(statsB?.hasData) ? (
                    <p className="text-xs text-gray-400 italic">Không có dữ liệu lương công khai cho bộ lọc này</p>
                  ) : null}
                </div>

                {/* Job count chips — only show sides with salary data */}
                <div className="flex gap-3 mt-4 flex-wrap">
                  {activeA && statsA?.hasData && (
                    <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-teal-100">
                      <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                      {labelA} — {statsA.validCount} tin có lương
                      <span className="text-teal-500 ml-1">· TB {statsA.avg.toFixed(1)} Tr</span>
                    </span>
                  )}
                  {activeB && statsB?.hasData && (
                    <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-3 py-1 rounded-full border border-indigo-100">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                      {labelB} — {statsB.validCount} tin có lương
                      <span className="text-indigo-400 ml-1">· TB {statsB.avg.toFixed(1)} Tr</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── TOP SALARY SECTIONS — dynamic from filters ─── */}
        {!activeA && !activeB ? (
          /* No filter selected — show gentle prompt */
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <BarChart2 size={18} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-400">Chọn bộ lọc ở trên để xem danh sách lương cao nhất theo tiêu chí của bạn</p>
          </div>
        ) : (
          topSections.map((sec, si) => sec.items.length > 0 && (
            <div key={si}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-800">
                  Mức lương trả cao nhất{" "}
                  <span style={{ color: sec.color }}>{sec.label}</span>
                </h2>
                <Link
                  href={`/search?${[
                    sec.sel.industry ? `category=${encodeURIComponent(sec.sel.industry)}` : null,
                    sec.sel.level ? `level=${encodeURIComponent(sec.sel.level)}` : null
                  ].filter(Boolean).join('&')}`}
                  className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                >
                  Xem tất cả <ArrowUpRight size={11} />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 {sec.items.map((job: any, idx: number) => {
                  return (
                    <Link href={`/job/${encodeURIComponent(job.url)}`} key={idx} className="block bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                      <div className="flex items-start gap-2 mb-3">
                        <CompanyLogo logo={job.logo} name={job.cong_ty} size={38} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2">
                            {(job.tieu_de || "").length > 38 ? job.tieu_de.slice(0, 38) + "…" : job.tieu_de}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{job.cong_ty || "—"}</p>
                          {job.dia_diem && isValid(job.dia_diem) && (
                            <p className="text-[10px] text-gray-400 truncate">
                              {job.dia_diem.replace(/^(làm việc:|nơi làm việc:|tại:)\s*/i, "").split(",")[0].trim()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-50 pt-2">
                        <div className="text-base font-bold text-slate-800 leading-tight">
                          {job._avg!.toFixed(1)}<span className="text-[11px] font-normal text-gray-400 ml-0.5">Tr</span>
                        </div>
                        <div className="text-[10px] text-gray-400">Lương trung bình</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}

      </div>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6 md:px-12 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex flex-wrap justify-center gap-5 text-xs font-medium text-gray-500">
            {["About Us", "Terms of Service", "Privacy Policy", "Contact"].map(l => (
              <a key={l} href="#" className="hover:text-slate-900 transition">{l}</a>
            ))}
          </div>
          <p className="text-xs text-gray-400">© 2026 CareerIntel. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

