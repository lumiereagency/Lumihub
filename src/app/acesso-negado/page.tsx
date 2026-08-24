import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <ShieldAlert className="text-accent" size={40} />
      <h1 className="text-xl font-semibold text-text-primary">Acesso negado</h1>
      <p className="max-w-sm text-sm text-text-tertiary">
        Você não tem permissão para acessar esta área do LUMIBASE. Entre em contato com um
        administrador se acredita que isso é um engano.
      </p>
      <Link href="/dashboard">
        <Button variant="secondary">Voltar ao Dashboard</Button>
      </Link>
    </div>
  );
}
