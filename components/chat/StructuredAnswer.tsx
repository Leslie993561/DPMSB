const SECOES = [
  "Resumo executivo",
  "Análise técnica",
  "Base legal",
  "Memória de cálculo",
  "Riscos",
  "Recomendações",
  "Checklist",
  "Próximos passos",
];

/**
 * Renderiza a resposta do assistente destacando os cabeçalhos das seções
 * padronizadas quando presentes. Não reinterpreta números — os valores
 * determinísticos são exibidos separadamente pela MemoriaCalculoTable.
 */
export function StructuredAnswer({ texto }: { texto: string }) {
  const linhas = texto.split("\n");

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {linhas.map((linha, i) => {
        const semMarkdown = linha.replace(/[#*\d.\s]/g, "").toLowerCase();
        const ehTitulo = SECOES.some(
          (s) => semMarkdown === s.replace(/[\s]/g, "").toLowerCase(),
        );

        if (linha.trim() === "") return <div key={i} className="h-2" />;

        if (ehTitulo) {
          return (
            <p key={i} className="pt-2 font-bold text-brand-primary">
              {linha.replace(/^[#*\s\d.]+/, "").replace(/\*+$/, "")}
            </p>
          );
        }

        return (
          <p key={i} className="text-foreground">
            {linha}
          </p>
        );
      })}
    </div>
  );
}
