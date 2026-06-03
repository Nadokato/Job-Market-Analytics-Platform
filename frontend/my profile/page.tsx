"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import RequireLogin from '@/frontend/components/RequireLogin';
import Navbar from '@/frontend/components/Navbar';
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
import { logout, updateProfile, upsertExperience, deleteExperience, upsertEducation, deleteEducation, upsertSkill, deleteSkill } from '@/backend/auth/actions';
import type { Experience, Education, Skill, UserCV } from '@/backend/types/profile';

const formatTimeRange = (startM: string, startY: string, endM: string, endY: string, isCurrent: boolean) => {
  if (!startY) return '';
  const startStr = startM ? `Tháng ${startM}/${startY}` : `${startY}`;
  const endStr = isCurrent ? 'Hiện tại' : (endM ? `Tháng ${endM}/${endY}` : (endY ? `${endY}` : ''));
  
  if (!endStr) return startStr;
  return `${startStr} - ${endStr}`;
};

export default function MyProfile({ user }: { user?: any }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExperienceModalOpen, setIsExperienceModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile data state (fetched from /api/v1/profile)
  const [profileLoaded, setProfileLoaded] = useState(false);

  // CV Upload state
  const [cvFile, setCvFile] = useState<(UserCV & { signed_url?: string }) | null>(null);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isDraggingCv, setIsDraggingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [isDeletingCv, setIsDeletingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const uploadCv = useCallback(async (file: File) => {
    setCvError(null);
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setCvError('Chỉ chấp nhận file PDF, DOC, DOCX');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCvError('File vượt quá 5MB');
      return;
    }
    setIsUploadingCv(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/v1/cv/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setCvError(data.error || 'Upload thất bại'); return; }
      setCvFile({ id: '', user_id: '', file_name: data.fileName, file_size: data.fileSize, file_type: data.fileType, uploaded_at: data.uploadedAt || new Date().toISOString(), signed_url: data.signedUrl });
    } catch {
      setCvError('Lỗi kết nối, vui lòng thử lại');
    } finally {
      setIsUploadingCv(false);
    }
  }, []);

  const handleCvInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCv(file);
    e.target.value = '';
  };

  const handleCvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCv(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadCv(file);
  };

  const handleDeleteCv = async () => {
    setIsDeletingCv(true);
    try {
      const res = await fetch('/api/v1/cv/upload', { method: 'DELETE' });
      if (res.ok) setCvFile(null);
    } finally {
      setIsDeletingCv(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const initialFirstName = fullName.split(' ')[0] || '';
  const initialLastName = fullName.split(' ').slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [country, setCountry] = useState('Việt Nam');
  const [city, setCity] = useState('Hà Nội');

  // Fetch profile data từ proper DB tables sau khi mount
  useEffect(() => {
    fetch('/api/v1/profile')
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          const fn = data.profile.full_name || '';
          setFirstName(fn.split(' ')[0] || '');
          setLastName(fn.split(' ').slice(1).join(' ') || '');
          setCountry(data.profile.country || 'Việt Nam');
          setCity(data.profile.city || 'Hà Nội');
        }
        if (data.experiences) setExperiences(data.experiences);
        if (data.educations) setEducations(data.educations);
        if (data.skills) setSkills(data.skills);
        if (data.cv) setCvFile(data.cv);
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await updateProfile(firstName, lastName, country, city);
    setIsSaving(false);
    setIsEditModalOpen(false);
  };

  // Experience Form State
  const [expTitle, setExpTitle] = useState('');
  const [expType, setExpType] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expCurrent, setExpCurrent] = useState(false);
  const [expStartMonth, setExpStartMonth] = useState('');
  const [expStartYear, setExpStartYear] = useState('');
  const [expEndMonth, setExpEndMonth] = useState('');
  const [expEndYear, setExpEndYear] = useState('');
  const [expLocation, setExpLocation] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);

  const openAddExperience = () => {
    setExpTitle('');
    setExpType('');
    setExpCompany('');
    setExpLocation('');
    setExpCurrent(false);
    setExpStartMonth('');
    setExpStartYear('');
    setExpEndMonth('');
    setExpEndYear('');
    setExpDescription('');
    setEditingExpId(null);
    setIsExperienceModalOpen(true);
  };

  const openEditExperience = (exp: Experience) => {
    setExpTitle(exp.title);
    setExpType(exp.type || '');
    setExpCompany(exp.company);
    setExpLocation(exp.location || '');
    setExpCurrent(exp.is_current);
    setExpStartMonth(exp.start_month || '');
    setExpStartYear(exp.start_year || '');
    setExpEndMonth(exp.end_month || '');
    setExpEndYear(exp.end_year || '');
    setExpDescription(exp.description || '');
    setEditingExpId(exp.id);
    setIsExperienceModalOpen(true);
  };

  const handleDeleteExperience = async () => {
    if (editingExpId) {
      setExperiences(prev => prev.filter(e => e.id !== editingExpId));
      setIsExperienceModalOpen(false);
      await deleteExperience(editingExpId);
    }
  };

  const handleSaveExperience = async () => {
    const newExp: Omit<Experience, 'user_id' | 'created_at'> = {
      id: editingExpId || Date.now().toString(),
      title: expTitle,
      type: expType,
      company: expCompany,
      location: expLocation,
      is_current: expCurrent,
      start_month: expStartMonth,
      start_year: expStartYear,
      end_month: expEndMonth,
      end_year: expEndYear,
      description: expDescription
    };

    if (editingExpId) {
      setExperiences(prev => prev.map(e => e.id === editingExpId ? { ...e, ...newExp } : e));
    } else {
      setExperiences(prev => [{ ...newExp, user_id: '' }, ...prev]);
    }
    setIsExperienceModalOpen(false);
    await upsertExperience(newExp);
  };

  const expDateError = (!expCurrent && expStartMonth && expStartYear && expEndMonth && expEndYear)
    ? (parseInt(expEndYear) * 12 + parseInt(expEndMonth) < parseInt(expStartYear) * 12 + parseInt(expStartMonth)
        ? 'Ngày kết thúc không được trước ngày bắt đầu.'
        : '')
    : '';

  // Education Form State
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [eduSchool, setEduSchool] = useState('');
  const [eduDegree, setEduDegree] = useState('');
  const [eduFieldOfStudy, setEduFieldOfStudy] = useState('');
  const [eduStartMonth, setEduStartMonth] = useState('');
  const [eduStartYear, setEduStartYear] = useState('');
  const [eduEndMonth, setEduEndMonth] = useState('');
  const [eduEndYear, setEduEndYear] = useState('');
  const [eduActivities, setEduActivities] = useState('');
  const [eduDescription, setEduDescription] = useState('');
  const [educations, setEducations] = useState<Education[]>([]);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);

  const openAddEducation = () => {
    setEduSchool('');
    setEduDegree('');
    setEduFieldOfStudy('');
    setEduStartMonth('');
    setEduStartYear('');
    setEduEndMonth('');
    setEduEndYear('');
    setEduActivities('');
    setEduDescription('');
    setEditingEduId(null);
    setIsEducationModalOpen(true);
  };

  const openEditEducation = (edu: Education) => {
    setEduSchool(edu.school);
    setEduDegree(edu.degree || '');
    setEduFieldOfStudy(edu.field_of_study || '');
    setEduStartMonth(edu.start_month || '');
    setEduStartYear(edu.start_year || '');
    setEduEndMonth(edu.end_month || '');
    setEduEndYear(edu.end_year || '');
    setEduActivities(edu.activities || '');
    setEduDescription(edu.description || '');
    setEditingEduId(edu.id);
    setIsEducationModalOpen(true);
  };

  const handleDeleteEducation = async () => {
    if (editingEduId) {
      setEducations(prev => prev.filter(e => e.id !== editingEduId));
      setIsEducationModalOpen(false);
      await deleteEducation(editingEduId);
    }
  };

  const handleSaveEducation = async () => {
    const newEdu: Omit<Education, 'user_id' | 'created_at'> = {
      id: editingEduId || Date.now().toString(),
      school: eduSchool,
      degree: eduDegree,
      field_of_study: eduFieldOfStudy,
      start_month: eduStartMonth,
      start_year: eduStartYear,
      end_month: eduEndMonth,
      end_year: eduEndYear,
      activities: eduActivities,
      description: eduDescription
    };

    if (editingEduId) {
      setEducations(prev => prev.map(e => e.id === editingEduId ? { ...e, ...newEdu } : e));
    } else {
      setEducations(prev => [{ ...newEdu, user_id: '' }, ...prev]);
    }
    setIsEducationModalOpen(false);
    await upsertEducation(newEdu);
  };

  const eduDateError = (eduStartMonth && eduStartYear && eduEndMonth && eduEndYear) 
    ? (parseInt(eduEndYear) * 12 + parseInt(eduEndMonth) < parseInt(eduStartYear) * 12 + parseInt(eduStartMonth) 
        ? 'Ngày kết thúc không được trước ngày bắt đầu.' 
        : '') 
    : '';

  // Skill Form State
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isSkillEditMode, setIsSkillEditMode] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const openAddSkill = () => {
    setSkillName('');
    setEditingSkillId(null);
    setIsSkillModalOpen(true);
  };

  const openEditSkill = (skill: Skill) => {
    setSkillName(skill.name);
    setEditingSkillId(skill.id);
    setIsSkillModalOpen(true);
  };

  const handleDeleteSkill = async () => {
    if (editingSkillId) {
      setSkills(prev => prev.filter(s => s.id !== editingSkillId));
      setIsSkillModalOpen(false);
      await deleteSkill(editingSkillId);
    }
  };

  const handleDeleteSkillDirect = async (id: string) => {
    setSkills(prev => prev.filter(s => s.id !== id));
    await deleteSkill(id);
  };

  const handleSaveSkill = async () => {
    if (!skillName.trim()) return;

    const newSkill: Omit<Skill, 'user_id' | 'created_at'> = {
      id: editingSkillId || Date.now().toString(),
      name: skillName,
      level: null,
    };

    if (editingSkillId) {
      setSkills(prev => prev.map(s => s.id === editingSkillId ? { ...s, ...newSkill } : s));
    } else {
      setSkills(prev => [{ ...newSkill, user_id: '' }, ...prev]);
    }
    setIsSkillModalOpen(false);
    await upsertSkill(newSkill);
  };

  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-[#f4f2ee]">
        {/* --- HEADER / NAVBAR --- */}
        <Navbar user={user} activeTab="profile" />

        <RequireLogin type="profile" />
      </div>
    );
  }

  return (
    <div className="bg-[#f4f2ee] min-h-screen pb-10 text-[#000000e6]">
      {/* --- HEADER / NAVBAR --- */}
      <Navbar user={user} activeTab="profile" />

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
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Pencil size={24} />
                </button>
              </div>

              {/* Profile Details */}
              <div className="px-6 mt-2">
                <h1 className="text-[24px] font-semibold leading-tight">
                   {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'User'}
                </h1>
                <div className="text-[14px] text-gray-500 mt-1 flex items-center gap-1">
                  <span>{city || country ? `${city}${city && country ? ', ' : ''}${country}` : 'No location specified'}</span>
                </div>
              </div>
            </div>

            {/* Upload your CV */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Tải lên CV của bạn</h2>
              <p className="text-[14px] text-gray-800 mb-6">Tải lên CV mới nhất của bạn để dễ dàng ứng tuyển và thu hút sự chú ý từ nhà tuyển dụng.</p>

              {/* Hidden file input */}
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleCvInputChange}
              />

              {cvFile ? (
                /* Đã có CV — hiển thị thẻ file */
                <div className="border border-gray-200 rounded-lg p-5 flex items-center gap-4 bg-[#f8faff]">
                  {/* Icon theo loại file */}
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: cvFile.file_type === 'application/pdf' ? '#fff1f0' : '#f0f7ff' }}>
                    {cvFile.file_type === 'application/pdf' ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#ff4d4f" opacity=".15"/>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#ff4d4f" strokeWidth="1.5" fill="none"/>
                        <polyline points="14 2 14 8 20 8" stroke="#ff4d4f" strokeWidth="1.5" fill="none"/>
                        <text x="6" y="17" fontSize="6" fontWeight="700" fill="#ff4d4f">PDF</text>
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#1890ff" opacity=".15"/>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#1890ff" strokeWidth="1.5" fill="none"/>
                        <polyline points="14 2 14 8 20 8" stroke="#1890ff" strokeWidth="1.5" fill="none"/>
                        <text x="5" y="17" fontSize="5.5" fontWeight="700" fill="#1890ff">DOC</text>
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-slate-800 truncate">{cvFile.file_name}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">
                      {formatFileSize(cvFile.file_size)} · Cập nhật {new Date(cvFile.uploaded_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={cvFile.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[13px] font-medium text-[#0a66c2] bg-[#e8f0fe] hover:bg-[#d2e3fc] px-3 py-1.5 rounded-md transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Xem
                    </a>
                    <button
                      onClick={() => cvInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      Thay thế
                    </button>
                    <button
                      onClick={handleDeleteCv}
                      disabled={isDeletingCv}
                      className="flex items-center gap-1.5 text-[13px] font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      {isDeletingCv ? 'Đang xoá...' : 'Xoá'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Chưa có CV — khu vực kéo thả */
                <div
                  onClick={() => !isUploadingCv && cvInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingCv(true); }}
                  onDragLeave={() => setIsDraggingCv(false)}
                  onDrop={handleCvDrop}
                  className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors ${
                    isDraggingCv
                      ? 'border-[#0a66c2] bg-[#e8f0fe] cursor-copy'
                      : isUploadingCv
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                      : 'border-gray-300 bg-gray-50 hover:bg-[#f0f6ff] hover:border-[#0a66c2] cursor-pointer'
                  } group`}
                >
                  {isUploadingCv ? (
                    <>
                      <div className="w-14 h-14 bg-white border border-gray-200 shadow-sm rounded-full flex items-center justify-center mb-4">
                        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <h3 className="text-[16px] font-semibold text-[#0a66c2]">Đang tải lên...</h3>
                      <p className="text-[14px] text-gray-500 mt-1">Vui lòng chờ</p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-white border border-gray-200 shadow-sm text-gray-500 group-hover:text-[#0a66c2] group-hover:border-[#0a66c2] rounded-full flex items-center justify-center mb-4 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      </div>
                      <h3 className="text-[16px] font-semibold text-slate-800 group-hover:text-[#0a66c2] transition-colors">
                        {isDraggingCv ? 'Thả file vào đây' : 'Nhấn để tải lên hoặc kéo thả'}
                      </h3>
                      <p className="text-[14px] text-gray-500 mt-1">PDF, DOC, DOCX (Tối đa 5MB)</p>
                    </>
                  )}
                </div>
              )}

              {/* Thông báo lỗi */}
              {cvError && (
                <div className="mt-3 flex items-center gap-2 text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {cvError}
                </div>
              )}
            </div>

            {/* Experience Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Kinh nghiệm làm việc</h2>
              
              {experiences.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {experiences.map((exp) => {
                    const timeRange = formatTimeRange(exp.start_month || '', exp.start_year || '', exp.end_month || '', exp.end_year || '', exp.is_current);
                    
                    return (
                      <div key={exp.id} className="flex items-start justify-between text-slate-800">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0">
                            <Briefcase size={24} className="text-gray-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[16px]">{exp.title}</h3>
                            <p className="text-[14px] mt-0.5">{exp.company}{exp.type ? ` · ${exp.type}` : ''}</p>
                            <p className="text-[14px] text-gray-500 mt-0.5">
                              {timeRange}
                            </p>
                            {exp.location && <p className="text-[14px] text-gray-500 mt-0.5">{exp.location}</p>}
                            {exp.description && <p className="text-[14px] mt-2 whitespace-pre-line">{exp.description}</p>}
                          </div>
                        </div>
                        <button 
                          onClick={() => openEditExperience(exp)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                        >
                          <Pencil size={20} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-start gap-4 text-gray-400">
                  <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0">
                    <Briefcase size={24} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[16px]">Chức danh</h3>
                    <p className="text-[14px] mt-0.5">Tổ chức/Công ty</p>
                    <p className="text-[14px] mt-0.5">2023 - Hiện tại</p>
                  </div>
                </div>
              )}
              
              <button 
                onClick={openAddExperience}
                className="mt-5 border border-[#0a66c2] text-[#0a66c2] px-4 py-[5px] rounded-full font-semibold hover:bg-[#eaf3ff] transition-colors leading-6 text-[15px] border-[1.5px]"
              >
                Thêm kinh nghiệm
              </button>
            </div>

            {/* Education Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <h2 className="text-[20px] font-semibold mb-2">Học vấn</h2>
              
              {educations.length > 0 ? (
                <div className="flex flex-col gap-6 mt-2">
                  {educations.map((edu) => {
                    const timeRange = formatTimeRange(edu.start_month || '', edu.start_year || '', edu.end_month || '', edu.end_year || '', false);
                    
                    return (
                      <div key={edu.id} className="flex items-start justify-between text-slate-800">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0">
                            <Building2 size={24} className="text-gray-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-[16px]">{edu.school}</h3>
                            <p className="text-[14px] mt-0.5">
                              {edu.degree}{edu.field_of_study ? `, ${edu.field_of_study}` : ''}
                            </p>
                            <p className="text-[14px] text-gray-500 mt-0.5">
                              {timeRange}
                            </p>
                            {edu.activities && <p className="text-[14px] text-gray-500 mt-0.5">Hoạt động: {edu.activities}</p>}
                            {edu.description && <p className="text-[14px] mt-2 whitespace-pre-line">{edu.description}</p>}
                          </div>
                        </div>
                        <button 
                          onClick={() => openEditEducation(edu)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
                        >
                          <Pencil size={20} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-start gap-4 text-gray-400">
                  <div className="w-12 h-12 bg-gray-100 flex items-center justify-center shrink-0">
                    <Building2 size={24} className="text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[16px]">Trường học</h3>
                    <p className="text-[14px] mt-0.5">Bằng cấp, Chuyên ngành</p>
                    <p className="text-[14px] mt-0.5">2023 - 2027</p>
                  </div>
                </div>
              )}
              
              <button 
                onClick={openAddEducation}
                className="mt-5 border border-[#0a66c2] text-[#0a66c2] px-4 py-[5px] rounded-full font-semibold hover:bg-[#eaf3ff] transition-colors leading-6 text-[15px] border-[1.5px]"
              >
                Thêm học vấn
              </button>
            </div>

            {/* Skills Box */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[20px] font-semibold">Kỹ năng</h2>
                <div className="flex items-center gap-2">
                  <button onClick={openAddSkill} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <Plus size={24} />
                  </button>
                  {skills.length > 0 && (
                    <button onClick={() => setIsSkillEditMode(!isSkillEditMode)} className={`p-2 rounded-full transition-colors ${isSkillEditMode ? 'bg-[#eaf3ff] text-[#0a66c2]' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <Pencil size={20} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col text-slate-800">
                {skills.length > 0 ? skills.map((skill, index) => (
                  <div key={skill.id} className={`py-4 flex justify-between items-center ${index !== skills.length - 1 ? 'border-b border-gray-200' : ''}`}>
                    <span className="text-[15px] font-medium">{skill.name}</span>
                    {isSkillEditMode ? (
                      <button onClick={() => handleDeleteSkillDirect(skill.id)} className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors">
                        <X size={20} />
                      </button>
                    ) : (
                      <button onClick={() => openEditSkill(skill)} className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <Pencil size={20} />
                      </button>
                    )}
                  </div>
                )) : (
                  <p className="text-[14px] text-gray-500 italic mt-2">Chưa có kỹ năng nào.</p>
                )}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="hidden lg:flex w-[27%] flex-col gap-4">
            
            {/* Top Right Card (Profile lang & URL) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-start group">
                <div>
                  <h3 className="font-semibold text-[15px] leading-tight">Ngôn ngữ hồ sơ</h3>
                  <p className="text-[14px] text-gray-500 mt-1">Tiếng Việt</p>
                </div>
                <button className="text-gray-600 p-1 rounded-full hover:bg-gray-100">
                  <Pencil size={20} />
                </button>
              </div>
              <div className="p-4 flex justify-between items-start group">
                <div>
                  <h3 className="font-semibold text-[15px] leading-tight">Hồ sơ công khai & URL</h3>
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
                <h3 className="font-semibold text-[16px]">Có thể bạn quan tâm</h3>
                <p className="text-[14px] text-gray-500 mb-4">Trang dành cho bạn</p>
                
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <div className="w-12 h-12 bg-gray-800 shrink-0 flex items-center justify-center text-white text-xs font-bold">
                      <img src="https://ui-avatars.com/api/?name=TCV&background=003366&color=fff&size=48" alt="TopCV" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[15px] truncate">TopCV Vietnam</h4>
                      <p className="text-[12px] text-gray-500 truncate">Dịch vụ nhân sự</p>
                      <p className="text-[12px] text-gray-500 mb-2 truncate">169.558 người theo dõi</p>
                      <button className="border border-gray-600 text-gray-600 px-4 py-1 rounded-full font-semibold hover:bg-gray-100 transition-colors text-[14px] border-[1px] flex items-center gap-1 w-max">
                         <Plus size={16} /> Theo dõi
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="w-12 h-12 shrink-0 bg-white border border-gray-200">
                       <img src="https://ui-avatars.com/api/?name=VNG&background=fff&color=f05123&size=48" alt="VNGGames" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[15px] truncate">VNGGames</h4>
                      <p className="text-[12px] text-gray-500 truncate">Công nghệ thông tin và Internet</p>
                      <p className="text-[12px] text-gray-500 mb-2 truncate">58,998 người theo dõi</p>
                      <button className="border border-gray-600 text-gray-600 px-4 py-1 rounded-full font-semibold hover:bg-gray-100 transition-colors text-[14px] border-[1px] flex items-center gap-1 w-max">
                         <Plus size={16} /> Theo dõi
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 mt-2 hover:bg-gray-50 transition-colors rounded-b-lg">
                <button className="w-full py-3 text-center text-[15px] font-semibold text-gray-600 flex items-center justify-center gap-1">
                  Xem tất cả
                  <ArrowRight size={18} className="mt-0.5" />
                </button>
              </div>
            </div>

            {/* Ad Banner */}
            <div className="rounded-lg shadow-sm border border-gray-200 overflow-hidden bg-[#001c38] text-white">
              <div className="p-4 relative pb-0">
                <div className="text-[10px] absolute top-2 right-2 text-gray-300">Quảng cáo</div>
                <div className="font-bold text-[14px] flex items-center gap-1 pt-1 opacity-90">
                  in
                </div>
                <p className="text-[16px] text-center mt-2 mx-2 mb-4 leading-snug">
                  Tìm việc dễ dàng hơn <span className="text-[#72b5fb] font-semibold">qua mạng lưới kết nối của bạn</span>
                </p>
                <div className="flex justify-center h-28 relative">
                   <div className="w-32 bg-[#fff] bg-opacity-20 rounded-t-xl mx-auto h-full flex flex-col justify-end overflow-hidden">
                       <div className="flex justify-center -mb-2">
                          <div className="w-8 h-10 bg-[#a3b1c6] rounded-full -mx-1" />
                          <div className="w-10 h-12 bg-[#ecb22e] rounded-full -mx-1 z-10" />
                          <div className="w-8 h-10 bg-[#e0561f] rounded-full -mx-1" />
                       </div>
                   </div>
                   <button className="absolute bottom-16 left-[25%] bg-[#0a66c2] text-white px-3 py-1 rounded-full text-[10px] font-semibold border border-white">
                      Khám phá việc làm
                   </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-[700px] max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-[20px] font-semibold text-slate-800">Chỉnh sửa thông tin</h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              
              <h3 className="text-[18px] font-semibold text-slate-800 mb-4">Thông tin cơ bản</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Tên*</label>
                  <input 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                  <div className="text-right text-[12px] text-gray-500 mt-1">{firstName.length}/50</div>
                </div>
                
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Họ*</label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                  <div className="text-right text-[12px] text-gray-500 mt-1">{lastName.length}/50</div>
                </div>
              </div>

              <h3 className="text-[18px] font-semibold text-slate-800 mt-10 mb-4">Địa điểm</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Quốc gia/Khu vực*</label>
                  <input 
                    type="text" 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>
                
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Thành phố</label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#0a66c2] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#004182] transition-colors text-[16px] disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Experience Modal */}
      {isExperienceModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-[750px] max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-[20px] font-semibold text-slate-800">
                {editingExpId ? 'Chỉnh sửa kinh nghiệm làm việc' : 'Thêm kinh nghiệm làm việc'}
              </h2>
              <button 
                onClick={() => setIsExperienceModalOpen(false)}
                className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1"> 
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Chức danh*</label>
                  <input 
                    type="text" 
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder="Ví dụ: Nhân viên bán hàng"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>
                
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Hình thức*</label>
                  <input 
                    type="text" 
                    value={expType}
                    onChange={(e) => setExpType(e.target.value)}
                    placeholder="VD: Toàn thời gian, Bán thời gian..."
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Công ty hoặc tổ chức*</label>
                  <input 
                    type="text" 
                    value={expCompany}
                    onChange={(e) => setExpCompany(e.target.value)}
                    placeholder="VD: Viettel"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="expCurrent"
                    checked={expCurrent}
                    onChange={(e) => setExpCurrent(e.target.checked)}
                    className="w-4 h-4 text-[#0a66c2] rounded border-gray-400 focus:ring-[#0a66c2]"
                  />
                  <label htmlFor="expCurrent" className="text-[14px] text-gray-700 select-none cursor-pointer">
                    Hiện đang làm việc tại vị trí này
                  </label>
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Ngày bắt đầu*</label>
                  <div className="flex gap-4">
                    <select 
                      value={expStartMonth}
                      onChange={(e) => setExpStartMonth(e.target.value)}
                      className="w-1/2 border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white"
                    >
                      <option value="">Tháng*</option>
                      {[...Array(12)].map((_, i) => <option key={i} value={i+1}>Tháng {i+1}</option>)}
                    </select>
                    <select 
                      value={expStartYear}
                      onChange={(e) => setExpStartYear(e.target.value)}
                      className="w-1/2 border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white"
                    >
                      <option value="">Năm*</option>
                      {[...Array(50)].map((_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{year}</option>
                      })}
                    </select>
                  </div>
                </div>

                {!expCurrent && (
                  <div>
                    <label className="block text-[14px] text-gray-700 mb-1">Ngày kết thúc*</label>
                    <div className="flex gap-4">
                      <select 
                        value={expEndMonth}
                        onChange={(e) => setExpEndMonth(e.target.value)}
                        className={`w-1/2 border ${expDateError ? 'border-red-500' : 'border-gray-500'} rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white`}
                      >
                        <option value="">Tháng*</option>
                        {[...Array(12)].map((_, i) => <option key={i} value={i+1}>Tháng {i+1}</option>)}
                      </select>
                      <select 
                        value={expEndYear}
                        onChange={(e) => setExpEndYear(e.target.value)}
                        className={`w-1/2 border ${expDateError ? 'border-red-500' : 'border-gray-500'} rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white`}
                      >
                        <option value="">Năm*</option>
                        {[...Array(50)].map((_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <option key={year} value={year}>{year}</option>
                        })}
                      </select>
                    </div>
                    {expDateError && <p className="text-red-500 text-[12px] mt-1">{expDateError}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Địa điểm</label>
                  <input 
                    type="text" 
                    value={expLocation}
                    onChange={(e) => setExpLocation(e.target.value)}
                    placeholder="VD: Hà Nội, Việt Nam"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Mô tả</label>
                  <textarea 
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition resize-y"
                  />
                  <div className="text-right text-[12px] text-gray-500 mt-1">{expDescription.length}/2000</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t border-gray-200 flex ${editingExpId ? 'justify-between' : 'justify-end'}`}>
              {editingExpId && (
                <button 
                  onClick={handleDeleteExperience}
                  className="text-gray-600 font-semibold hover:bg-gray-100 px-5 py-2 rounded-full transition-colors text-[16px]"
                >
                  Xóa
                </button>
              )}
              <button 
                onClick={handleSaveExperience}
                disabled={!!expDateError || !expTitle || !expType || !expCompany || !expStartMonth || !expStartYear || (!expCurrent && (!expEndMonth || !expEndYear))}
                className="bg-[#0a66c2] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#004182] transition-colors text-[16px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Education Modal */}
      {isEducationModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-[750px] max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-[20px] font-semibold text-slate-800">
                {editingEduId ? 'Chỉnh sửa học vấn' : 'Thêm học vấn'}
              </h2>
              <button 
                onClick={() => setIsEducationModalOpen(false)}
                className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1"> 
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Trường học *</label>
                  <input 
                    type="text" 
                    value={eduSchool}
                    onChange={(e) => setEduSchool(e.target.value)}
                    placeholder="Ví dụ: Bách Khoa"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>
                
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Bằng cấp </label>
                  <input 
                    type="text" 
                    value={eduDegree}
                    onChange={(e) => setEduDegree(e.target.value)}
                    placeholder="Ví dụ: Cử nhân Khoa học"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Ngành học </label>
                  <input 
                    type="text" 
                    value={eduFieldOfStudy}
                    onChange={(e) => setEduFieldOfStudy(e.target.value)}
                    placeholder="Ví dụ: Kỹ thuật phần mềm"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                  />
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Ngày bắt đầu </label>
                  <div className="flex gap-4">
                    <select 
                      value={eduStartMonth}
                      onChange={(e) => setEduStartMonth(e.target.value)}
                      className="w-1/2 border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white"
                    >
                      <option value="">Tháng</option>
                      {[...Array(12)].map((_, i) => <option key={i} value={i+1}>Tháng {i+1}</option>)}
                    </select>
                    <select 
                      value={eduStartYear}
                      onChange={(e) => setEduStartYear(e.target.value)}
                      className="w-1/2 border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white"
                    >
                      <option value="">Năm</option>
                      {[...Array(50)].map((_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{year}</option>
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Ngày kết thúc </label>
                  <div className="flex gap-4">
                    <select 
                      value={eduEndMonth}
                      onChange={(e) => setEduEndMonth(e.target.value)}
                      className={`w-1/2 border ${eduDateError ? 'border-red-500' : 'border-gray-500'} rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white`}
                    >
                      <option value="">Tháng</option>
                      {[...Array(12)].map((_, i) => <option key={i} value={i+1}>Tháng {i+1}</option>)}
                    </select>
                    <select 
                      value={eduEndYear}
                      onChange={(e) => setEduEndYear(e.target.value)}
                      className={`w-1/2 border ${eduDateError ? 'border-red-500' : 'border-gray-500'} rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition bg-white`}
                    >
                      <option value="">Năm</option>
                      {[...Array(50)].map((_, i) => {
                        const year = new Date().getFullYear() - i + 7; // future years for end date
                        return <option key={year} value={year}>{year}</option>
                      })}
                    </select>
                  </div>
                  {eduDateError && <p className="text-red-500 text-[12px] mt-1">{eduDateError}</p>}
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Hoạt động và xã hội</label>
                  <textarea 
                    value={eduActivities}
                    onChange={(e) => setEduActivities(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Nhập vào"
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition resize-y"
                  />
                  <div className="text-right text-[12px] text-gray-500 mt-1">{eduActivities.length}/500</div>
                </div>

                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Mô tả </label>
                  <textarea 
                    value={eduDescription}
                    onChange={(e) => setEduDescription(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition resize-y"
                  />
                  <div className="text-right text-[12px] text-gray-500 mt-1">{eduDescription.length}/1000</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t border-gray-200 flex ${editingEduId ? 'justify-between' : 'justify-end'}`}>
              {editingEduId && (
                <button 
                  onClick={handleDeleteEducation}
                  className="text-gray-600 font-semibold hover:bg-gray-100 px-5 py-2 rounded-full transition-colors text-[16px]"
                >
                  Xóa
                </button>
              )}
              <button 
                onClick={handleSaveEducation}
                disabled={!!eduDateError || !eduSchool}
                className="bg-[#0a66c2] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#004182] transition-colors text-[16px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Skill Modal */}
      {isSkillModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-[500px] max-h-[90vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-[20px] font-semibold text-slate-800">
                {editingSkillId ? 'Chỉnh sửa kỹ năng' : 'Thêm kỹ năng'}
              </h2>
              <button 
                onClick={() => setIsSkillModalOpen(false)}
                className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1"> 
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] text-gray-700 mb-1">Tên kỹ năng*</label>
                  <input 
                    type="text" 
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="VD: Giao tiếp, ReactJS..."
                    className="w-full border border-gray-500 rounded px-3 py-2 text-[14px] outline-none focus:border-[#0a66c2] focus:ring-1 focus:ring-[#0a66c2] transition"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t border-gray-200 flex ${editingSkillId ? 'justify-between' : 'justify-end'}`}>
              {editingSkillId && (
                <button 
                  onClick={handleDeleteSkill}
                  className="text-gray-600 font-semibold hover:bg-gray-100 px-5 py-2 rounded-full transition-colors text-[16px]"
                >
                  Xóa
                </button>
              )}
              <button 
                onClick={handleSaveSkill}
                disabled={!skillName.trim()}
                className="bg-[#0a66c2] text-white px-5 py-2 rounded-full font-semibold hover:bg-[#004182] transition-colors text-[16px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
