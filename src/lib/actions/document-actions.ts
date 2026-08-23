"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { documentMetadataSchema } from "@/lib/validation/documents";
import { saveLocalFile, deleteLocalFile, MAX_UPLOAD_BYTES } from "@/lib/storage/local";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("DOCUMENTS", "CREATE"));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `Arquivo maior que o limite de ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` };
  }

  const parsed = documentMetadataSchema.safeParse({
    name: formData.get("name") || file.name,
    category: formData.get("category"),
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const { storageKey, size } = await saveLocalFile(user.organizationId, file);

  const document = await db.document.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      category: parsed.data.category,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      storageProvider: "local",
      storageKey,
      mimeType: file.type || "application/octet-stream",
      size,
      uploadedByUserId: user.id,
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_UPLOADED",
    entityType: "Document",
    entityId: document.id,
    metadata: { name: document.name, category: document.category },
  });

  revalidatePath("/documentos");
  return { success: "Documento enviado." };
}

export async function updateDocumentAction(documentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("DOCUMENTS", "EDIT"));

  const parsed = documentMetadataSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const document = await db.document.findFirst({ where: { id: documentId, organizationId: user.organizationId } });
  if (!document) return { error: "Documento não encontrado." };

  await db.document.update({
    where: { id: documentId },
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      clientId: parsed.data.clientId ?? null,
      projectId: parsed.data.projectId ?? null,
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_UPDATED",
    entityType: "Document",
    entityId: documentId,
  });

  revalidatePath("/documentos");
  return { success: "Documento atualizado." };
}

export async function deleteDocumentAction(documentId: string): Promise<void> {
  const user = await requirePermission(permKey("DOCUMENTS", "DELETE"));

  const document = await db.document.findFirst({ where: { id: documentId, organizationId: user.organizationId } });
  if (!document) return;

  await db.document.delete({ where: { id: documentId } });
  await deleteLocalFile(user.organizationId, document.storageKey);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_DELETED",
    entityType: "Document",
    entityId: documentId,
    metadata: { name: document.name },
  });

  revalidatePath("/documentos");
}
