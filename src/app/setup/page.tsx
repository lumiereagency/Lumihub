import { redirect } from "next/navigation";
import { hasAnyOrganization } from "@/lib/auth/bootstrap";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyOrganization()) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-semibold tracking-tight text-gold-light">LUMIHUB</span>
          <span className="text-sm text-text-tertiary">
            Configuração inicial do sistema operacional da sua empresa
          </span>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}
