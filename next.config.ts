import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse/pdfjs-dist carregam o worker do PDF.js por caminho de arquivo em
   * tempo de execução. Se o Next empacotar esses pacotes, o worker deixa de ser
   * encontrado ("Setting up fake worker failed"). Mantê-los externos faz o Node
   * resolvê-los direto de node_modules.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
