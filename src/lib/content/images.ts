import "server-only";
import { saveLocalFile } from "@/lib/storage/local";

// Imagens de post: reduzidas para no máximo 1600 px (JPEG) antes de guardar —
// ficam leves no disco e abrem rápido no celular do cliente.
export const MAX_IMAGE_INPUT = 15 * 1024 * 1024;

export async function saveContentImage(organizationId: string, file: File): Promise<{ storageKey: string } | { error: string }> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return { error: "Envie imagens JPG, PNG ou WebP. Para vídeo, cole o link." };
  if (file.size > MAX_IMAGE_INPUT) return { error: "A imagem passa de 15 MB. Envie uma menor ou cole o link do Drive." };
  try {
    const sharp = (await import("sharp")).default;
    const input = Buffer.from(await file.arrayBuffer());
    const out = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const small = new File([new Uint8Array(out)], "post.jpg", { type: "image/jpeg" });
    const { storageKey } = await saveLocalFile(organizationId, small);
    return { storageKey };
  } catch {
    // Sem conseguir reduzir (formato raro): guarda como veio, se couber.
    if (file.size > 8 * 1024 * 1024) return { error: "Não consegui reduzir esta imagem. Tente um JPG ou PNG menor." };
    const { storageKey } = await saveLocalFile(organizationId, file);
    return { storageKey };
  }
}
