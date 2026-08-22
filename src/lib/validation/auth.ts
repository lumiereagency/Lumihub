import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
  remember: z.coerce.boolean().optional().default(false),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra.")
      .regex(/[0-9]/, "A senha deve conter ao menos um número."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra.")
      .regex(/[0-9]/, "A senha deve conter ao menos um número."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const setupOrganizationSchema = z
  .object({
    companyName: z.string().trim().min(2, "Informe o nome da empresa."),
    adminName: z.string().trim().min(2, "Informe seu nome."),
    adminEmail: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
    password: z
      .string()
      .min(8, "A senha deve ter ao menos 8 caracteres.")
      .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra.")
      .regex(/[0-9]/, "A senha deve conter ao menos um número."),
    confirmPassword: z.string(),
    timezone: z.string().min(1),
    currency: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
