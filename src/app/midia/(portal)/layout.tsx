import { requireMediaMember, isMediaLeader } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { mediaThemeStyle } from "@/lib/media/theme";
import { MediaPortalShell } from "@/components/media/portal-shell";

export const dynamic = "force-dynamic";

export default async function MediaPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMediaMember();
  const brand = await db.mediaBrandSettings.findUnique({ where: { organizationId: user.organizationId } });
  const permissions = Array.from(user.permissions);

  return (
    <div style={mediaThemeStyle(brand)}>
      <MediaPortalShell
        permissions={permissions}
        environmentName={brand?.environmentName ?? "MÍDIA ADESF"}
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          roleLabel: isMediaLeader(user) ? "Líder de Mídia" : "Membro de Mídia",
        }}
      >
        {children}
      </MediaPortalShell>
    </div>
  );
}
