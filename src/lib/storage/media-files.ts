import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

// Storage local para imagens do módulo Mídia ADESF (avatares de membros e
// identidade visual/logo da organização). Segue o mesmo padrão de
// @/lib/storage/local.ts (fora de `public/`, chave aleatória, uma pasta por
// organização) mas serve por uma rota pública (/api/midia/arquivos/...) sem
// checagem de permissão — ao contrário de Document, imagens de
// avatar/logo não são dado sensível, e a chave é um UUID imprevisível.
const STORAGE_ROOT = path.join(process.cwd(), "storage", "media-files");

export const MAX_MEDIA_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export function isAllowedMediaImageType(mimeType: string): boolean {
  return mimeType in ALLOWED_MIME_TYPES;
}

export function mimeTypeForKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const entry = Object.entries(ALLOWED_MIME_TYPES).find(([, e]) => e === ext);
  return entry?.[0] ?? "application/octet-stream";
}

export async function saveMediaImage(organizationId: string, file: File): Promise<string> {
  const dir = path.join(STORAGE_ROOT, organizationId);
  await fs.mkdir(dir, { recursive: true });

  const ext = ALLOWED_MIME_TYPES[file.type] ?? "";
  const key = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, key), buffer);

  return `/api/midia/arquivos/${organizationId}/${key}`;
}

export async function readMediaImage(organizationId: string, key: string): Promise<Buffer> {
  return fs.readFile(path.join(STORAGE_ROOT, organizationId, key));
}

// Aceita a própria URL pública salva no banco (ex: User.avatarUrl,
// MediaBrandSettings.logoUrl) e remove o arquivo correspondente, se houver.
export async function deleteMediaImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const match = url.match(/^\/api\/midia\/arquivos\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+\.[a-z]+)$/);
  if (!match) return;
  const [, organizationId, key] = match;
  await fs.unlink(path.join(STORAGE_ROOT, organizationId, key)).catch((err) => {
    if (err.code !== "ENOENT") throw err;
  });
}
