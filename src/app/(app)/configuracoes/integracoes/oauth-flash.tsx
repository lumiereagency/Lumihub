"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormMessage } from "@/components/ui/form-message";

// Route Handlers (/api/integrations/oauth/[provider]/callback) não têm como
// devolver o resultado de volta a um Server Action — o resultado chega como
// query string após o redirect final. Lido aqui e removido da URL em seguida
// para não reaparecer numa atualização de página.
export function OAuthFlash() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get("oauth");
  const message = searchParams.get("message");
  if (!kind || !message) return null;

  const clear = () => router.replace("/configuracoes/integracoes");

  return (
    <div className="relative">
      <FormMessage error={kind === "error" ? message : undefined} success={kind === "success" ? message : undefined} />
      <button
        onClick={clear}
        className="absolute right-3 top-2.5 text-xs text-text-tertiary hover:text-text-primary"
        aria-label="Fechar"
      >
        Fechar
      </button>
    </div>
  );
}
