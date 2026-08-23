import { z } from "zod";

export const userSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  roleId: z.string().min(1, "Selecione um perfil."),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  roleId: z.string().min(1, "Selecione um perfil."),
  isActive: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do perfil."),
  permissionKeys: z.preprocess(
    (v) => (Array.isArray(v) ? v : v ? [v] : []),
    z.array(z.string()).min(1, "Selecione ao menos uma permissão."),
  ),
});

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.string())),
});

export type UserInput = z.infer<typeof userSchema>;
