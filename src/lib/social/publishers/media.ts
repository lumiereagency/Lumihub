import "server-only";
import { readLocalFile } from "@/lib/storage/local";
import type { MediaItem } from "@/lib/content/media";
import type { PublishInput } from "./types";

export function imageMime(item: MediaItem): string {
  const key = item.storageKey ?? "";
  return key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
}

export async function imageBytes(i: PublishInput, item: MediaItem): Promise<Buffer> {
  if (!item.storageKey) throw new Error("A imagem do post não está mais disponível.");
  return readLocalFile(i.account.organizationId, item.storageKey);
}
