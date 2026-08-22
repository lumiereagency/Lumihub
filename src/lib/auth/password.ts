import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Política mínima de senha: 8+ caracteres, letra e número.
export function isPasswordStrongEnough(plain: string): boolean {
  if (plain.length < 8) return false;
  if (!/[a-zA-Z]/.test(plain)) return false;
  if (!/[0-9]/.test(plain)) return false;
  return true;
}
