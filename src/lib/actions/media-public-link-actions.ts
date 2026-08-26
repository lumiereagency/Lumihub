"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { rotatePublicScheduleLink } from "@/lib/media/schedule/public-schedule-link-service";

const MANAGE = permKey("MEDIA_ADESF", "MANAGE");

export async function rotatePublicScheduleLinkAction(): Promise<{ token: string }> {
  const user = await requirePermission(MANAGE);

  const link = await rotatePublicScheduleLink(user.organizationId);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_PUBLIC_LINK_ROTATED",
    entityType: "MediaPublicScheduleLink",
    entityId: link.id,
  });

  revalidatePath("/midia-adesf/configuracoes");
  return { token: link.token };
}
