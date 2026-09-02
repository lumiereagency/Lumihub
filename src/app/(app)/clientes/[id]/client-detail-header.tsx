"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Mail, Phone, MapPin, AtSign, Globe } from "lucide-react";
import { updateClientAction, deleteClientAction } from "@/lib/actions/client-actions";
import { CLIENT_STATUS_LABELS } from "@/lib/validation/clients";
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
}: {
  client: ClientData;
  permissions: { canEdit: boolean; canDelete: boolean };
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

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[client.status] ?? "neutral"}>
              {CLIENT_STATUS_LABELS[client.status as keyof typeof CLIENT_STATUS_LABELS] ?? client.status}
            </Badge>
            {client.cnpj && <span className="text-xs text-text-tertiary">CNPJ {client.cnpj}</span>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
            {client.email && (
              <span className="flex items-center gap-1.5">
                <Mail size={14} /> {client.email}
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={14} /> {client.phone}
              </span>
            )}
            {client.address && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} /> {client.address}
              </span>
            )}
            {client.instagram && (
              <span className="flex items-center gap-1.5">
                <AtSign size={14} /> {client.instagram}
              </span>
            )}
            {client.website && (
              <span className="flex items-center gap-1.5">
                <Globe size={14} /> {client.website}
              </span>
            )}
          </div>
          {client.notes && <p className="max-w-2xl text-sm text-text-tertiary">{client.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          {permissions.canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Editar
            </Button>
          )}
          {permissions.canDelete && (
            <Button variant="danger" size="sm" disabled={deleting} onClick={handleDelete}>
              <Trash2 size={14} /> {deleting ? "Excluindo..." : "Excluir"}
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
