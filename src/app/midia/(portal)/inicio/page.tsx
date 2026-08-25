import Link from "next/link";
import { Sparkles, Clock, Bell } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Estrutura exigida pela especificação (§35): Minha Próxima Escala / Minha
// Função / Minha Disponibilidade / Avisos — todos com dado real (nenhuma
// escala/aviso é simulado nesta fase).
export default async function MediaPortalHomePage() {
  const user = await requireMediaMember();

  const member = await db.mediaMember.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      functions: { include: { function: true } },
      availabilityRecurring: { orderBy: { dayOfWeek: "asc" } },
    },
  });

  const primaryFunction = member.functions.find((f) => f.isPrimary)?.function.name ?? null;
  const enabledFunctions = member.functions.filter((f) => !f.isPrimary).map((f) => f.function.name);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}.`} description="Bem-vindo à Mídia ADESF." />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minha próxima escala</h2>
        <p className="text-sm text-text-secondary">Nenhuma escala disponível.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minha função</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">
            <Sparkles size={12} /> {primaryFunction ?? "Não definida"}
          </Badge>
          {enabledFunctions.map((name) => (
            <Badge key={name} tone="neutral">
              {name}
            </Badge>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Minha disponibilidade</h2>
        {member.availabilityRecurring.length === 0 ? (
          <p className="mb-3 text-sm text-text-secondary">Você ainda não configurou sua disponibilidade.</p>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2">
            {member.availabilityRecurring.map((s) => (
              <Badge key={s.id} tone="neutral">
                {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime}
              </Badge>
            ))}
          </div>
        )}
        <Link
          href="/midia/disponibilidade"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary hover:brightness-110"
        >
          <Clock size={14} /> Atualizar disponibilidade
        </Link>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-tertiary">Avisos</h2>
        <EmptyState icon={<Bell size={24} />} title="Nenhum aviso no momento" />
      </section>
    </div>
  );
}
