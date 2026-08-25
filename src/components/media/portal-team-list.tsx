"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteMemberForm } from "@/components/media/invite-member-form";

const ROLE_LABEL: Record<string, string> = { LIDER: "Líder", MEMBRO: "Membro" };

interface MemberRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  phone: string | null;
  primaryFunction: string | null;
  enabledFunctions: string[];
}

export function PortalTeamList({ members, isLeader }: { members: MemberRow[]; isLeader: boolean }) {
  const [inviting, setInviting] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {isLeader && (
        <div className="flex justify-end">
          <Button onClick={() => setInviting(true)}>
            <Plus size={16} /> Convidar membro
          </Button>
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={<Users2 size={28} />}
          title="Nenhum membro ativo ainda"
          action={
            isLeader && (
              <Button onClick={() => setInviting(true)}>
                <Plus size={16} /> Convidar primeiro membro
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const content = (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Avatar name={m.name} src={m.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{m.name}</p>
                  <p className="truncate text-xs text-text-tertiary">{m.primaryFunction ?? "Sem função principal definida"}</p>
                  {m.enabledFunctions.length > 0 && <p className="truncate text-xs text-text-tertiary">{m.enabledFunctions.join(", ")}</p>}
                  {isLeader && m.phone && <p className="truncate text-xs text-text-tertiary">{m.phone}</p>}
                </div>
                <Badge tone={m.role === "LIDER" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
              </div>
            );
            return isLeader ? (
              <Link key={m.id} href={`/midia/equipe/${m.id}`}>
                {content}
              </Link>
            ) : (
              <div key={m.id}>{content}</div>
            );
          })}
        </div>
      )}

      <Drawer open={inviting} onClose={() => setInviting(false)} title="Convidar membro">
        <InviteMemberForm onSuccess={() => setInviting(false)} />
      </Drawer>
    </div>
  );
}
