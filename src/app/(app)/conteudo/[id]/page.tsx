import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { isChannelConnected } from "@/lib/integrations/messaging";
import type { MediaItem } from "@/lib/content/media";
import { getSocialApp } from "@/lib/social/apps";
import { BatchBoard, type PostRow } from "./batch-board";
import type { AccountRow, TargetRow } from "./schedule-panel";

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
    media: ((p.media as unknown as MediaItem[]) ?? []).map((m, i) => ({ kind: m.kind, provider: m.provider ?? null, url: m.url, storageKey: m.storageKey ?? null, src: m.storageKey ? `/api/aprovacao/${batch.publicToken}/${p.id}/${i}` : null, embed: m.embed ?? null })),
    events: p.events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, actor: e.actor, at: e.createdAt.toISOString() })),
  }));
  const [accountsRaw, targetsRaw, tiktok] = await Promise.all([
    db.socialAccount.findMany({ where: { clientId: batch.clientId, organizationId: user.organizationId }, orderBy: [{ network: "asc" }, { name: "asc" }], select: { id: true, network: true, name: true, avatarUrl: true, status: true, statusMessage: true } }),
    db.contentPostTarget.findMany({ where: { post: { batchId: batch.id } }, orderBy: { createdAt: "asc" } }),
    getSocialApp(user.organizationId, "tiktok"),
  ]);
  const accounts: AccountRow[] = accountsRaw;
  const targetsByPost: Record<string, TargetRow[]> = {};
  for (const t of targetsRaw) {
    (targetsByPost[t.postId] ??= []).push({ id: t.id, accountId: t.accountId, network: t.network, status: t.status, scheduledFor: t.scheduledFor.toISOString(), lastError: t.lastError, externalUrl: t.externalUrl, caption: t.caption, format: ((t.options as { format?: string } | null)?.format) ?? null });
  }
  return (
    <BatchBoard
      accounts={accounts}
      targetsByPost={targetsByPost}
      tiktokPublic={tiktok ? tiktok.audited : undefined}
      batch={{ id: batch.id, clientId: batch.clientId, name: batch.name, client: batch.client.companyName, phone: batch.client.phone, sent: !!batch.sentAt }}
      posts={posts}
      whatsapp={whatsapp}
      perms={{ create: hasPermission(user, permKey("TASKS", "CREATE")), edit: hasPermission(user, permKey("TASKS", "EDIT")), del: hasPermission(user, permKey("TASKS", "DELETE")) }}
    />
  );
}
