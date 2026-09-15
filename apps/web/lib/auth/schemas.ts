// zod/mini: estes schemas vão para o navegador nos formulários públicos (login,
// cadastro, recuperação); a versão completa do zod pesava ~100 KB no celular.
import * as z from "zod/mini"

const emailSchema = z.pipe(
  z.string().check(z.trim(), z.minLength(1, "Informe seu e-mail.")),
  z.email("E-mail inválido.")
)

const newPasswordSchema = z
  .string()
  .check(
    z.minLength(8, "A senha precisa ter pelo menos 8 caracteres."),
    z.maxLength(72, "A senha pode ter no máximo 72 caracteres.")
  )

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().check(z.minLength(1, "Informe sua senha.")),
})

export const magicLinkSchema = z.object({
  email: emailSchema,
})

export const signUpSchema = z.object({
  fullName: z
    .string()
    .check(
      z.trim(),
      z.minLength(3, "Informe seu nome completo."),
      z.maxLength(120, "O nome pode ter no máximo 120 caracteres.")
    ),
  email: emailSchema,
  password: newPasswordSchema,
})

export const recoverPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().check(z.minLength(1, "Repita a nova senha.")),
  })
  .check(
    z.refine((values) => values.password === values.confirmPassword, {
      error: "As senhas não conferem.",
      path: ["confirmPassword"],
    })
  )

export type SignInValues = z.infer<typeof signInSchema>
export type MagicLinkValues = z.infer<typeof magicLinkSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type RecoverPasswordValues = z.infer<typeof recoverPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
