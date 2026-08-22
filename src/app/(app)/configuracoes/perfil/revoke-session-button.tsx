"use client";

import { useTransition } from "react";
import { revokeSessionAction } from "@/lib/actions/profile-actions";
import { Button } from "@/components/ui/button";

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => revokeSessionAction(sessionId))}
    >
      {pending ? "Encerrando..." : "Encerrar"}
    </Button>
  );
}
