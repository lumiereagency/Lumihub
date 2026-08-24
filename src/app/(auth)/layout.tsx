import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" />
          <span className="text-2xl font-bold tracking-tight text-text-primary">LUMIBASE</span>
          <span className="text-sm text-text-tertiary">Sistema operacional da Lumière Agency</span>
        </div>
        {children}
      </div>
    </div>
  );
}
