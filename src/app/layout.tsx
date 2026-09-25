import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sansDisplay = Inter({
  variable: "--font-sans-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUMIBASE — Lumière Agency",
  description: "Sistema operacional interno da Lumière Agency",
};

// Aplica o tema salvo (ou "dark", padrão da marca) antes da hidratação —
// roda de forma síncrona no <head> para não piscar o tema errado no load.
const themeInitScript = `(function(){try{var t=localStorage.getItem("lb-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      suppressHydrationWarning
      className={`${sansDisplay.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text-primary">
        {children}
      </body>
    </html>
  );
}
