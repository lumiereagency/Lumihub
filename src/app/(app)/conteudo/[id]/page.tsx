import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { isChannelConnected } from "@/lib/integrations/messaging";
import type { MediaItem } from "@/lib/content/media";
import { BatchBoard, type PostRow } from "./batch-board";

export default async function BatchPage({ params }: PageProps<"/conteudo/[id]">) {
  const user = await requirePermission(permKey("TASKS", "VIEW"));
  const { id } = await params;
  const batch = await db.contentBatch.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { client: { select: { companyName: true, phone: true } }, posts: { orderBy: [{ scheduledFor: "asc" }, { position: "asc" }], include: { events: { orderBy: { createdAt: "desc" }, take: 8 } } } },
  });
  if (!batch) notFound();
  const whatsapp = await isChannelConnected(user.organizationId, "WHATSAPP");
  const posts: PostRow[] = batch.posts.map((p) => ({
    id: p.id,
    title: p.title,
    caption: p.caption,
    network: p.network,
    format: p.format,
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    status: p.status,
    version: p.version,
    feedback: p.feedback,
    media: ((p.media as unknown as MediaItem[]) ?? []).map((m, i) => ({ kind: m.kind, provider: m.provider ?? null, url: m.url, storageKey: m.storageKey ?? null, src: m.storageKey ? `/api/aprovacao/${batch.publicToken}/${p.id}/${i}` : null })),
    events: p.events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, actor: e.actor, at: e.createdAt.toISOString() })),
  }));
  return (
    <BatchBoard
      batch={{ id: batch.id, name: batch.name, client: batch.client.companyName, phone: batch.client.phone, sent: !!batch.sentAt }}
      posts={posts}
      whatsapp={whatsapp}
      perms={{ create: hasPermission(user, permKey("TASKS", "CREATE")), edit: hasPermission(user, permKey("TASKS", "EDIT")), del: hasPermission(user, permKey("TASKS", "DELETE")) }}
    />
  );
}
