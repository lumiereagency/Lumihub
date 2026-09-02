import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { YoutubeProspectingSearch } from "./youtube-prospecting-search";

export default async function CrmYoutubeProspectingPage() {
  await requirePermission(permKey("CRM", "CREATE"));

  return (
    <div>
      <PageHeader
        title="Prospecção IA — YouTube"
        description="Busca canais por nicho e aponta quem tem audiência grande mas pouca recorrência de cortes/Shorts."
        actions={
          <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-accent-light hover:underline">
            <ArrowLeft size={14} /> Voltar ao CRM
          </Link>
        }
      />
      <YoutubeProspectingSearch />
    </div>
  );
}
