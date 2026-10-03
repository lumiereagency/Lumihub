"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Mail, Phone, MapPin, AtSign, Globe, FileText } from "lucide-react";
import { updateClientAction, deleteClientAction } from "@/lib/actions/client-actions";
import { CLIENT_STATUS_LABELS } from "@/lib/validation/clients";
import { documentLabel, formatDocument } from "@/lib/documents";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ClientForm } from "../client-form";

interface ClientData {
  id: string;
  companyName: string;
  cnpj: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  instagram: string | null;
  website: string | null;
  status: string;
  notes: string | null;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "info" | "error"> = {
  ATIVO: "success",
  INATIVO: "neutral",
  PROSPECTO: "info",
  INADIMPLENTE: "error",
};

export function ClientDetailHeader({
  client,
  permissions,
  quoteHref,
}: {
  client: ClientData;
  permissions: { canEdit: boolean; canDelete: boolean };
  quoteHref?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`Excluir ${client.companyName}? Contratos e cobranças já registrados continuam no histórico, mas o cliente some das listagens.`)) return;
    startDelete(async () => {
      const result = await deleteClientAction(client.id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.push("/clientes");
    });
  }

  const initials = client.companyName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const contacts = [
    client.phone && { icon: Phone, text: client.phone },
    client.email && { icon: Mail, text: client.email },
    client.instagram && { icon: AtSign, text: client.instagram },
    client.website && { icon: Globe, text: client.website },
    client.address && { icon: MapPin, text: client.address },
  ].filter((c): c is { icon: typeof Phone; text: string } => Boolean(c));

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-lg font-semibold text-accent-light">{initials || "?"}</span>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight text-text-primary">{client.companyName}</h1>
              <Badge tone={STATUS_TONE[client.status] ?? "neutral"} dot>
                {CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] ?? client.status}
              </Badge>
            </div>
            <p className="text-sm text-text-tertiary">
              {[client.contactName, client.cnpj && `${documentLabel(client.cnpj)} ${formatDocument(client.cnpj)}`].filter(Boolean).join(" · ") || "Sem responsável cadastrado"}
            </p>
            {contacts.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {contacts.map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1 text-xs text-text-secondary">
                    <Icon size={13} className="shrink-0 text-text-tertiary" />
                    <span className="truncate">{text}</span>
                  </span>
                ))}
              </div>
            ) : (
              permissions.canEdit && (
                <button type="button" onClick={() => setEditing(true)} className="w-fit text-xs text-accent-light underline-offset-2 hover:underline">
                  Adicionar telefone, e-mail e endereço
                </button>
              )
            )}
            {client.notes && <p className="max-w-2xl text-sm text-text-tertiary">{client.notes}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quoteHref && (
            <Link href={quoteHref} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
              <FileText size={15} /> Novo orçamento
            </Link>
          )}
          {permissions.canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Editar
            </Button>
          )}
          {permissions.canDelete && (
            <Button variant="ghost" size="sm" disabled={deleting} onClick={handleDelete} className="text-text-tertiary hover:text-error">
              <Trash2 size={14} /> {deleting ? "Excluindo…" : "Excluir"}
            </Button>
          )}
        </div>
      </div>

      <Drawer open={editing} onClose={() => setEditing(false)} title="Editar cliente">
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          defaultValues={client}
          submitLabel="Salvar alterações"
          onSuccess={() => setEditing(false)}
        />
      </Drawer>
    </Card>
  );
}
