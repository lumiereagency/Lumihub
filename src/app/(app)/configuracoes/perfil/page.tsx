import { Monitor } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { listActiveSessions } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "./change-password-form";
import { RevokeSessionButton } from "./revoke-session-button";

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `há ${diffD} d`;
}

export default async function ProfilePage() {
  const user = await requireUser();
  const sessions = await listActiveSessions(user.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu Perfil" description="Suas informações, segurança e sessões ativas." />

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div>
            <p className="text-lg font-semibold text-text-primary">{user.name}</p>
            <p className="text-sm text-text-tertiary">{user.email}</p>
            <Badge tone="accent" className="mt-2">
              {user.role.name}
            </Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <ChangePasswordForm />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessões ativas</CardTitle>
        </CardHeader>
        <div className="flex flex-col divide-y divide-border">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <Monitor size={18} className="text-text-tertiary" />
                <div>
                  <p className="text-sm text-text-primary">
                    {session.userAgent?.slice(0, 60) ?? "Dispositivo desconhecido"}
                    {session.id === user.sessionId && (
                      <span className="ml-2 text-xs text-accent-light">(sessão atual)</span>
                    )}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {session.ip ?? "IP desconhecido"} · última atividade {formatRelative(session.lastActiveAt)}
                  </p>
                </div>
              </div>
              {session.id !== user.sessionId && <RevokeSessionButton sessionId={session.id} />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
