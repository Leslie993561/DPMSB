const LABEL_TIPO_ASO: Record<string, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno: "Retorno ao Trabalho",
  demissional: "Demissional",
};

export interface ItemFichaExameView {
  exame: string;
  codigo: string;
  dataRealizacao: string;
  dataVencimento: string | null;
}

export interface FichaExameView {
  id: string;
  tipoAso: string;
  itens: ItemFichaExameView[];
  anexoUrl: string | null;
  anexoNome: string | null;
}

/**
 * Detalhe de uma ficha de exame ocupacional (ASO): exames realizados com
 * código/data/vencimento, e o link pro PDF anexado — mesmo padrão do
 * DocumentoFichaEpi, usado tanto no drawer da Gestão de Exames quanto na aba
 * Documentos ASO do Quadro de Colaboradores.
 */
export function DocumentoFichaExame({
  ficha,
  colaborador,
  anexoHref,
}: {
  ficha: FichaExameView;
  colaborador: { nome: string; cargo: string | null; departamento: string | null };
  anexoHref: string;
}) {
  return (
    <div className="flex flex-col gap-3 text-[12px] text-foreground">
      <p className="text-[10px] font-semibold tracking-[0.1em] text-brand-primary-800 uppercase">
        ASO — {LABEL_TIPO_ASO[ficha.tipoAso] ?? ficha.tipoAso}
      </p>

      {ficha.anexoUrl && (
        <a
          href={anexoHref}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-1.5 rounded-md border border-hairline bg-surface-page px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-050"
        >
          📎 Baixar anexo{ficha.anexoNome ? ` — ${ficha.anexoNome}` : ""}
        </a>
      )}

      <div className="rounded-md border border-hairline px-3 py-2">
        <p>
          <span className="font-semibold">NOME DO COLABORADOR:</span> {colaborador.nome}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-6">
          <span>
            <span className="font-semibold">SETOR:</span> {colaborador.departamento ?? "—"}
          </span>
          <span>
            <span className="font-semibold">CARGO:</span> {colaborador.cargo ?? "—"}
          </span>
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-hairline">
        <p className="bg-surface-page px-2.5 py-1 text-center text-[10px] font-bold tracking-[0.12em] text-foreground uppercase">
          Exames realizados
        </p>
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-t border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
              <th className="px-2.5 py-1.5">Código</th>
              <th className="px-2.5 py-1.5">Exame</th>
              <th className="px-2.5 py-1.5">Data de avaliação</th>
              <th className="px-2.5 py-1.5">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {ficha.itens.map((i, idx) => (
              <tr key={idx} className="border-t border-hairline/70">
                <td className="px-2.5 py-1.5 text-foreground-muted">{i.codigo || "—"}</td>
                <td className="px-2.5 py-1.5 font-medium">{i.exame}</td>
                <td className="px-2.5 py-1.5">{i.dataRealizacao || "—"}</td>
                <td className="px-2.5 py-1.5">{i.dataVencimento || "Sem periódico"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
