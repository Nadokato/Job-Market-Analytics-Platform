'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/backend/supabase/server'
import type { Experience, Education, Skill } from '@/backend/types/profile'
import { LoginSchema, SignupSchema } from './schemas'

// ============================================================
// AUTH ACTIONS
// ============================================================

export async function login(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message }
  }

  const { email, password } = parsed.data

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const parsed = SignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: null }
  }

  const { email, password, name } = parsed.data

  // Giữ full_name trong user_metadata để Navbar hiển thị tên user
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    return { error: error.message, success: null }
  }

  return { success: 'Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận tài khoản.', error: null }
}

export async function logout() {
  const supabase = await createClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (token) {
      const { blacklistToken } = await import('@/backend/lib/redisSecurity')
      await blacklistToken(token)
    }
  } catch (err) {
    console.error('[Logout Action] Lỗi khi đưa token vào blacklist:', err)
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ============================================================
// PROFILE ACTIONS — Ghi vào bảng public.profiles
// ============================================================

export async function updateProfile(
  firstName: string,
  lastName: string,
  country: string,
  city: string
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const fullName = `${firstName} ${lastName}`.trim()

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: fullName,
      country,
      city,
      updated_at: new Date().toISOString(),
    })

  if (error) return { error: error.message }

  // Cập nhật full_name trong user_metadata để Navbar vẫn hiển thị đúng
  await supabase.auth.updateUser({ data: { full_name: fullName } })

  revalidatePath('/profile')
  return { success: true }
}

// ============================================================
// EXPERIENCE ACTIONS — Ghi vào bảng public.experiences
// ============================================================

export async function upsertExperience(
  experience: Omit<Experience, 'user_id' | 'created_at'>
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('experiences')
    .upsert({ ...experience, user_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function deleteExperience(id: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('experiences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

// ============================================================
// EDUCATION ACTIONS — Ghi vào bảng public.educations
// ============================================================

export async function upsertEducation(
  education: Omit<Education, 'user_id' | 'created_at'>
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('educations')
    .upsert({ ...education, user_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function deleteEducation(id: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('educations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

// ============================================================
// SKILL ACTIONS — Ghi vào bảng public.skills
// ============================================================

export async function upsertSkill(
  skill: Omit<Skill, 'user_id' | 'created_at'>
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('skills')
    .upsert({ ...skill, user_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function deleteSkill(id: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('skills')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

// ============================================================
// CV ACTIONS — Ghi vào bảng public.user_cvs
// ============================================================

export async function saveUserCV(cvData: {
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_at: string
}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  // Xóa CV cũ của user trước (chỉ giữ 1 CV mỗi lúc)
  await supabase.from('user_cvs').delete().eq('user_id', user.id)

  const { error } = await supabase
    .from('user_cvs')
    .insert({
      user_id: user.id,
      ...cvData,
    })

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}

export async function deleteUserCV() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('user_cvs')
    .delete()
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  return { success: true }
}
