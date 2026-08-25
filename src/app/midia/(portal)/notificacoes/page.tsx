import { Bell } from "lucide-react";
import { requireMediaMember } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions/notification-actions";

export default async function MediaPortalNotificationsPage() {
  const user = await requireMediaMember();

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div>
      <PageHeader
        title="Notificações"
        description="Avisos da liderança e da equipe de mídia."
        actions={
          hasUnread && (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary" size="sm">
                Marcar todas como lidas
              </Button>
            </form>
          )
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="Nenhuma notificação ainda" />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${!n.readAt ? "bg-card-elevated" : ""}`}>
              <div>
                <p className="text-sm font-medium text-text-primary">{n.title}</p>
                <p className="text-sm text-text-secondary">{n.body}</p>
                <p className="mt-1 text-xs text-text-tertiary">{n.createdAt.toLocaleString("pt-BR")}</p>
              </div>
              {!n.readAt && (
                <form action={markNotificationReadAction.bind(null, n.id)}>
                  <button type="submit" className="whitespace-nowrap text-xs text-accent-light hover:underline">
                    Marcar como lida
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
