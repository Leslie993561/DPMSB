import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse/pdfjs-dist carregam o worker do PDF.js por caminho de arquivo em
   * tempo de execução. Se o Next empacotar esses pacotes, o worker deixa de ser
   * encontrado ("Setting up fake worker failed"). Mantê-los externos faz o Node
   * resolvê-los direto de node_modules.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  /**
   * O SST é outro app (React+Vite, banco próprio) publicado em outro projeto da
   * Vercel. Estes rewrites o servem sob /sst DESTE domínio, para ele abrir na
   * mesma janela do portal e não como um site separado. O app do SST é buildado
   * com base "/sst/", então os assets e as funções dele já pedem esse prefixo —
   * aqui o prefixo é removido antes de repassar.
   */
  async rewrites() {
    const sst = process.env.SST_ORIGEM ?? "https://portal-sst-xi.vercel.app";
    return [
      { source: "/sst", destination: `${sst}/` },
      { source: "/sst/:caminho*", destination: `${sst}/:caminho*` },
    ];
  },
};

export default nextConfig;
