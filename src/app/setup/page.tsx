import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

// Fase 45 — Multi-organização: esta tela não é exclusiva do primeiro acesso
// da implantação, fica disponível a qualquer momento para cadastrar uma nova
// empresa isolada. Só redireciona quem já está logado (dashboard já é a
// organização certa para essa sessão).
export default async function SetupPage() {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="text-2xl font-semibold tracking-tight text-gold-light">LUMIHUB</span>
          <span className="text-sm text-text-tertiary">
            Cadastre sua empresa no LUMIHUB — cada organização tem seus
            próprios dados, usuários e permissões, totalmente isolados.
          </span>
        </div>
        <SetupForm />
        <p className="mt-4 text-center text-sm text-text-tertiary">
          Sua empresa já está cadastrada?{" "}
          <Link href="/login" className="text-gold-light hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
