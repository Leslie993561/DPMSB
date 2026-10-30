import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse/pdfjs-dist carregam o worker do PDF.js por caminho de arquivo em
   * tempo de execução. Se o Next empacotar esses pacotes, o worker deixa de ser
   * encontrado ("Setting up fake worker failed"). Mantê-los externos faz o Node
   * resolvê-los direto de node_modules.
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  /**
   * O PDF.js importa o worker dinamicamente (import(workerSrc)), então o
   * rastreamento de arquivos da Vercel não o enxerga e ele fica fora da função
   * serverless (/var/task): "Cannot find module .../pdf.worker.mjs". Inclui os
   * arquivos do worker explicitamente nas rotas que leem PDF.
   */
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
