import { z } from 'zod'

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập email.')
    .email('Email không đúng định dạng.'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu.'),
})

export const SignupSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập email.')
    .email('Email không đúng định dạng.'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.'),
  name: z
    .string()
    .min(1, 'Vui lòng nhập họ tên.')
    .max(100, 'Họ tên không được vượt quá 100 ký tự.'),
})
