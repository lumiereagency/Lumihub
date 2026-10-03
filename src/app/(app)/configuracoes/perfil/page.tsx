import { Monitor, Smartphone } from "lucide-react";
import { describeUserAgent } from "@/lib/user-agent";
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

  // Sessão atual primeiro, depois a mais recente.
  const ordered = [...sessions].sort((a, b) => Number(b.id === user.sessionId) - Number(a.id === user.sessionId) || b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu perfil" description="Suas informações, sua senha e os aparelhos conectados à sua conta." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={user.name} src={user.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-text-primary">{user.name}</p>
                <p className="truncate text-sm text-text-tertiary">{user.email}</p>
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
        </div>

        <Card className="self-start">
          <CardHeader>
            <div>
              <CardTitle>Aparelhos conectados</CardTitle>
              <p className="mt-1 text-sm text-text-tertiary">
                {ordered.length} {ordered.length === 1 ? "sessão ativa" : "sessões ativas"}. Encerre as que você não reconhece.
              </p>
            </div>
          </CardHeader>
          <div className="flex flex-col divide-y divide-border">
            {ordered.map((session) => {
              const device = describeUserAgent(session.userAgent);
              const Icon = device.mobile ? Smartphone : Monitor;
              const current = session.id === user.sessionId;
              return (
                <div key={session.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={current ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-light" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-elevated text-text-tertiary"}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-text-primary">
                        {device.label}
                        {current && <Badge tone="success">Este aparelho</Badge>}
                      </p>
                      <p className="truncate text-xs text-text-tertiary">
                        {session.ip ?? "IP desconhecido"} · última atividade {formatRelative(session.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                  {!current && <RevokeSessionButton sessionId={session.id} />}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
