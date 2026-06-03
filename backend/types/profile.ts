// TypeScript interfaces cho profile data
// Khớp với schema trong supabase/migrations/001_profile_tables.sql

export interface Profile {
  id: string
  full_name: string | null
  country: string | null
  city: string | null
  created_at: string
  updated_at: string
}

export interface Experience {
  id: string            // timestamp string, ví dụ: "1778252330214"
  user_id: string
  title: string
  company: string
  type: string | null
  location: string | null
  start_month: string | null
  start_year: string | null
  end_month: string | null
  end_year: string | null
  is_current: boolean
  description: string | null
  created_at?: string
}

export interface Education {
  id: string
  user_id: string
  school: string
  degree: string | null
  field_of_study: string | null
  start_month: string | null
  start_year: string | null
  end_month: string | null
  end_year: string | null
  activities: string | null
  description: string | null
  created_at?: string
}

export interface Skill {
  id: string
  user_id: string
  name: string
  level: string | null
  created_at?: string
}

export interface UserCV {
  id: string
  user_id: string
  file_name: string
  file_path: string     // path trong Storage bucket: "{user_id}/{timestamp}_{filename}"
  file_size: number | null
  file_type: string | null
  uploaded_at: string
  signed_url?: string   // generated on-demand, không lưu DB
}
