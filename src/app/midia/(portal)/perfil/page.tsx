import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { MediaAvatarForm, MediaProfileForm } from "./media-profile-forms";

const ROLE_LABEL: Record<string, string> = { LIDER: "Líder de Mídia", MEMBRO: "Membro" };

export default async function MediaPortalProfilePage() {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({
    where: { userId: user.id },
    include: { functions: { include: { function: true } } },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title="Meu Perfil" description="Suas informações no Mídia ADESF." />

      <div className="flex flex-col gap-6">
        <MediaAvatarForm name={user.name} avatarUrl={user.avatarUrl} />

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
      </div>
    </div>
  );
}
