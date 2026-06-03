import { createClient } from '@/backend/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/v1/profile
 * Trả về toàn bộ profile data của user đang đăng nhập:
 * { profile, experiences, educations, skills, cv }
 * cv bao gồm signed_url được generate fresh (không lưu trong DB)
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch song song tất cả bảng để tối ưu latency
  const [profileRes, experiencesRes, educationsRes, skillsRes, cvRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('experiences').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('educations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('skills').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('user_cvs').select('*').eq('user_id', user.id).maybeSingle(),
    ])

  // Nếu chưa có profile row (user đăng ký trước khi có trigger), tạo mới
  let profile = profileRes.data
  if (!profile && !profileRes.error) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        country: 'Việt Nam',
        city: 'Hà Nội',
      })
      .select()
      .single()
    profile = newProfile
  }

  // Generate fresh signed URL cho CV (không lưu URL hết hạn trong DB)
  let cv = cvRes.data ?? null
  if (cv?.file_path) {
    const { data: signedData } = await supabase.storage
      .from('user-cvs')
      .createSignedUrl(cv.file_path, 60 * 60 * 24 * 365) // 1 năm

    if (signedData) {
      cv = { ...cv, signed_url: signedData.signedUrl }
    }
  }

  return NextResponse.json({
    profile,
    experiences: experiencesRes.data ?? [],
    educations: educationsRes.data ?? [],
    skills: skillsRes.data ?? [],
    cv,
  })
}
