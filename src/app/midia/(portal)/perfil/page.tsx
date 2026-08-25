import Link from "next/link";
import { Clock } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { MediaAvatarForm, MediaProfileForm } from "./media-profile-forms";

const ROLE_LABEL: Record<string, string> = { LIDER: "Líder de Mídia", MEMBRO: "Membro" };
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function MediaPortalProfilePage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({
    where: { userId: user.id },
    include: { functions: { include: { function: true } }, availabilityRecurring: { orderBy: { dayOfWeek: "asc" } } },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title="Meu Perfil" description="Suas informações no Mídia ADESF." />

      <div className="flex flex-col gap-6">
        <MediaAvatarForm name={user.name} avatarUrl={user.avatarUrl} />

        <p className="text-sm text-text-tertiary">{user.email}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{ROLE_LABEL[member.role]}</Badge>
          {member.functions.map((f) => (
            <Badge key={f.id} tone={f.isPrimary ? "success" : "neutral"}>
              {f.function.name}
              {f.isPrimary ? " · principal" : ""}
            </Badge>
          ))}
        </div>

        <MediaProfileForm name={user.name} phone={member.phone} />

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-text-primary">Disponibilidade</p>
          {member.availabilityRecurring.length === 0 ? (
            <p className="mb-2 text-sm text-text-tertiary">Você ainda não configurou sua disponibilidade.</p>
          ) : (
            <div className="mb-2 flex flex-wrap gap-2">
              {member.availabilityRecurring.map((s) => (
                <Badge key={s.id} tone="neutral">
                  {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime}
                </Badge>
              ))}
            </div>
          )}
          <Link href="/midia/disponibilidade" className="inline-flex items-center gap-1.5 text-sm text-accent-light hover:underline">
            <Clock size={14} /> Editar disponibilidade
          </Link>
        </div>
      </div>
    </div>
  );
}
