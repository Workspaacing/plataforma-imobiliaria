import { z } from "zod"

const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .pipe(z.email("E-mail inválido."))

const newPasswordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
})

export const magicLinkSchema = z.object({
  email: emailSchema,
})

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(120, "O nome pode ter no máximo 120 caracteres."),
  email: emailSchema,
  password: newPasswordSchema,
})

export const recoverPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "Repita a nova senha."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  })

export type SignInValues = z.infer<typeof signInSchema>
export type MagicLinkValues = z.infer<typeof magicLinkSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type RecoverPasswordValues = z.infer<typeof recoverPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
