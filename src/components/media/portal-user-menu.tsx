"use client";

import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, UserCircle } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";

// Variante do UserMenu exclusiva do portal — o link "Meu perfil" do menu
// padrão da LUMIBASE aponta para /configuracoes/perfil (rota administrativa),
// o que quebraria o white-label exigido no §5: o membro de mídia nunca deve
// ver ou navegar para a marca/telas da LUMIBASE durante o uso normal do
// portal.
export function PortalUserMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="w-full" onClick={() => setOpen((v) => !v)}>
        {children}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full min-w-[200px] rounded-[10px] border border-border bg-card-elevated p-1 shadow-lg">
          <Link
            href="/midia/perfil"
            className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-text-secondary hover:bg-card hover:text-text-primary"
            onClick={() => setOpen(false)}
          >
            <UserCircle size={16} />
            Meu perfil
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm text-error hover:bg-error/10"
            >
              <LogOut size={16} />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
