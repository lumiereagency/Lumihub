import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { mediaThemeStyle } from "@/lib/media/theme";
import { MediaLoginForm } from "./media-login-form";

export const dynamic = "force-dynamic";

export default async function MediaLoginPage() {
  const user = await getCurrentUser();
  if (user?.media) redirect("/midia/inicio");

  // LUMIBASE hoje opera com uma organização por implantação — a marca do
  // portal (pública, exibida antes de qualquer login) usa a primeira
  // configuração encontrada. Se o multi-tenant do módulo crescer, a rota
  // deve passar a receber a organização por subdomínio/slug em vez disto.
  const brand = await db.mediaBrandSettings.findFirst();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4" style={mediaThemeStyle(brand)}>
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.environmentName} className="h-14 w-auto object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-[image:var(--lh-accent-gradient)]" />
          )}
          <span className="text-2xl font-bold tracking-tight text-text-primary">
            {brand?.environmentName ?? "MÍDIA ADESF"}
          </span>
          <span className="text-sm text-text-tertiary">Portal da equipe de mídia</span>
        </div>
        <MediaLoginForm />
      </div>
    </div>
  );
}
