import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Poppins } from "next/font/google";
import { db } from "@/lib/db";
import type { MediaItem } from "@/lib/content/media";
import { FORMAT_LABELS, NETWORK_LABELS } from "@/lib/content/media";
import { ApprovalView, type ApprovalPost } from "./approval-view";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-poppins" });

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Aprovação de conteúdo · Lumière",
  description: "Veja e aprove os posts preparados para você.",
  robots: { index: false, follow: false },
};

export default async function ApprovalPage({ params }: PageProps<"/aprovacao/[token]">) {
  const { token } = await params;
  if (!token || token.length < 16 || token.length > 64) notFound();
  const batch = await db.contentBatch.findUnique({
    where: { publicToken: token },
    include: { client: { select: { companyName: true, contactName: true } }, posts: { where: { status: { not: "RASCUNHO" } }, orderBy: [{ scheduledFor: "asc" }, { position: "asc" }] } },
  });
  if (!batch) notFound();

  const posts: ApprovalPost[] = batch.posts.map((p) => ({
    id: p.id,
    title: p.title,
    caption: p.caption,
    network: NETWORK_LABELS[p.network] ?? p.network,
    format: FORMAT_LABELS[p.format] ?? p.format,
    vertical: p.format === "REELS" || p.format === "STORIES",
    scheduledFor: p.scheduledFor?.toISOString() ?? null,
    status: p.status,
    feedback: p.feedback,
    media: ((p.media as unknown as MediaItem[]) ?? []).map((m, i) => ({ kind: m.kind, provider: m.provider ?? null, embed: m.embed ?? null, url: m.url, src: m.storageKey ? `/api/aprovacao/${token}/${p.id}/${i}` : null })),
  }));

  return (
    <div className={poppins.variable}>
      <ApprovalView
        token={token}
        batchName={batch.name}
        clientName={batch.client.companyName}
        greeting={(batch.client.contactName || batch.client.companyName).split(" ")[0]}
        posts={posts}
      />
    </div>
  );
}
