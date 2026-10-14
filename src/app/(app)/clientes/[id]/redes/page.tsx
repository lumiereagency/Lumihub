import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integrations/vault";
import { getSocialApp } from "@/lib/social/apps";
import type { Candidate } from "@/lib/social/connect";
import { simulationEnabled } from "@/lib/social/publish";
import { RedesView } from "./redes-view";

export default async function ClientNetworksPage({ params, searchParams }: PageProps<"/clientes/[id]/redes">) {
  const user = await requirePermission(permKey("TASKS", "VIEW"));
  const { id } = await params;
  const sp = await searchParams;
  const client = await db.client.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null }, select: { id: true, companyName: true } });
  if (!client) notFound();

  const accounts = await db.socialAccount.findMany({ where: { clientId: id, organizationId: user.organizationId }, orderBy: [{ network: "asc" }, { name: "asc" }], select: { id: true, network: true, name: true, avatarUrl: true, status: true, statusMessage: true, createdAt: true } });
  const [meta, youtube, tiktok] = await Promise.all([getSocialApp(user.organizationId, "meta"), getSocialApp(user.organizationId, "youtube"), getSocialApp(user.organizationId, "tiktok")]);

  let pick: { sessionId: string; candidates: { key: string; network: string; name: string; avatarUrl: string | null; already: boolean }[] } | null = null;
  const sessionId = typeof sp.escolher === "string" ? sp.escolher : null;
  if (sessionId) {
    const session = await db.socialConnectSession.findFirst({ where: { id: sessionId, organizationId: user.organizationId, clientId: id, userId: user.id, expiresAt: { gt: new Date() } } });
    if (session) {
      const all = JSON.parse(decryptSecret({ encryptedValue: session.payloadEnc, iv: session.payloadIv, authTag: session.payloadTag })) as Candidate[];
      const have = new Set(accounts.map((a) => `${a.network}:${a.name}`));
      pick = { sessionId: session.id, candidates: all.map((c) => ({ key: c.key, network: c.network, name: c.name, avatarUrl: c.avatarUrl, already: have.has(`${c.network}:${c.name}`) })) };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/clientes/${id}`} className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary">
          <ChevronLeft size={15} /> {client.companyName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Redes sociais</h1>
        <p className="mt-1 text-sm text-text-tertiary">Contas do cliente que a Lumibase publica sozinha, na hora marcada, depois da aprovação.</p>
      </div>
      <RedesView
        clientId={id}
        accounts={accounts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        apps={{ meta: !!meta, youtube: !!youtube, tiktok: !!tiktok }}
        pick={pick}
        error={typeof sp.erro === "string" ? sp.erro : null}
        canEdit={hasPermission(user, permKey("TASKS", "EDIT"))}
        simulation={simulationEnabled()}
      />
    </div>
  );
}
