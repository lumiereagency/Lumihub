import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

// Storage local (provider "local", default do schema). Fica fora de `public/`
// para nunca ser servido diretamente pelo Next — todo acesso passa pela rota
// /api/documentos/[id], que valida organização e permissão antes de ler o
// arquivo. Fases futuras (32/33/34) podem trocar por Google Drive/Dropbox
// reais sem mudar o contrato de Document.storageKey.
const STORAGE_ROOT = path.join(process.cwd(), "storage", "documents");

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

function sanitizeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

export async function saveLocalFile(organizationId: string, file: File): Promise<{ storageKey: string; size: number }> {
  const dir = path.join(STORAGE_ROOT, organizationId);
  await fs.mkdir(dir, { recursive: true });

  const storageKey = `${randomUUID()}${sanitizeExtension(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, storageKey), buffer);

  return { storageKey, size: buffer.length };
}

export async function readLocalFile(organizationId: string, storageKey: string): Promise<Buffer> {
  return fs.readFile(path.join(STORAGE_ROOT, organizationId, storageKey));
}

export async function deleteLocalFile(organizationId: string, storageKey: string): Promise<void> {
  await fs.unlink(path.join(STORAGE_ROOT, organizationId, storageKey)).catch((err) => {
    if (err.code !== "ENOENT") throw err;
  });
}
