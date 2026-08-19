import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Sidebar } from "@/components/nav/Sidebar";
import { obterNavCounts } from "@/lib/db/navCounts";
import "./globals.css";

/**
 * O manual de marca MSB exige a família Gotham (Bold/Medium/Book), que é uma
 * fonte paga e não está disponível via Google Fonts. Na ausência dos
 * arquivos oficiais, o próprio manual autoriza uma fonte de estrutura
 * similar — usamos Poppins (geométrica, mesmos 3 pesos: 700/500/400).
 */
const poppins = Poppins({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Portal Inteligente de Departamento Pessoal",
  description: "Assistente de DP com motor de cálculo determinístico e IA para interpretação e riscos.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const counts = await obterNavCounts();

  return (
    <html lang="pt-BR" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex h-full overflow-hidden bg-surface-page text-foreground">
        <Sidebar counts={counts} />
        <div className="flex h-full flex-1 flex-col overflow-y-auto">
          <main className="flex-1 px-4 py-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
