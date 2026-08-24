import type { Metadata } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sansDisplay = Instrument_Sans({
  variable: "--font-sans-display",
  subsets: ["latin"],
});

const monoNumeric = IBM_Plex_Mono({
  variable: "--font-mono-numeric",
  weight: ["500", "600"],
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
      className={`${sansDisplay.variable} ${monoNumeric.variable} h-full antialiased`}
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
