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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sansDisplay.variable} ${monoNumeric.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-text-primary">
        {children}
      </body>
    </html>
  );
}
