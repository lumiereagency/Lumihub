import { Logo } from "@/components/layout/logo";

// Porta de entrada da base: painel da marca (sempre no preto com halo
// dourado, como a capa do Guia) e o formulário ao lado. No celular, a marca
// vira um cabeçalho compacto acima do formulário.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#0B0A08] p-12 lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_45%,rgba(214,178,102,0.22),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(214,178,102,0.10),transparent_65%)]" />
        <p className="relative text-[11px] font-medium uppercase tracking-[0.28em] text-[#D6B266]">Lumière Agency</p>
        <div className="relative flex flex-col items-center gap-7 text-center">
          <Logo size="lg" gradientId="lb-auth-mark" className="h-auto w-44" />
          <div className="flex flex-col items-center gap-3">
            <span className="bg-[linear-gradient(120deg,#F6DDA0,#D6B266_45%,#9E7B37)] bg-clip-text pl-[0.32em] text-3xl font-semibold tracking-[0.32em] text-transparent">
              LUMIBASE
            </span>
            <span className="h-px w-10 bg-[#D6B266]/60" />
            <span className="max-w-xs text-[15px] font-light text-[#C9C1B1]">O sistema operacional da Lumière: comercial, operação, financeiro e equipe num só lugar.</span>
          </div>
        </div>
        <p className="relative text-[11px] uppercase tracking-[0.24em] text-[#6E675A]">Acesso restrito ao time</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <Logo size="lg" gradientId="lb-auth-mark-mobile" className="h-auto w-24" />
            <span className="bg-[linear-gradient(120deg,#F6DDA0,#D6B266_45%,#9E7B37)] bg-clip-text pl-[0.3em] text-xl font-semibold tracking-[0.3em] text-transparent">
              LUMIBASE
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
