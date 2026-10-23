"use client";

import { useEffect, useRef, useState } from "react";
import { chavesMarcaveis, SECOES_CHECKLIST, TIPO_ANEXO_POR_ITEM, type EstadoChecklist } from "@/lib/checklistAdmissional";

const INPUT_CLASS =
  "rounded border border-hairline bg-background px-1.5 py-0.5 text-[11px] font-light text-foreground dark:border-brand-neutral/30";

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Check list do processo admissional do colaborador — cada marcação/data é salva na hora. */
export function ChecklistAdmissionalPanel({
  colaboradorId,
  nome,
  cargo,
  departamento,
  dataAdmissao,
}: {
  colaboradorId: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  dataAdmissao: string | null;
}) {
  const [dados, setDados] = useState<EstadoChecklist | null>(null);
  const [anexados, setAnexados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/colaboradores/${colaboradorId}/checklist`)
      .then((r) => r.json())
      .then((d) => {
        setDados(d.dados ?? {});
        setAnexados(new Set<string>(d.anexados ?? []));
      })
      .catch(() => setErro("Não foi possível carregar o check list."));
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [colaboradorId]);

  function atualizar(chave: string, valor: boolean | string) {
    const proximo = { ...(dados ?? {}), [chave]: valor };
    setDados(proximo);
    setErro(null);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      fetch(`/api/colaboradores/${colaboradorId}/checklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: proximo }),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => setErro("Não foi possível salvar a última alteração."));
    }, 400);
  }

  if (dados === null) {
    return <p className="text-[10.5px] text-foreground-muted">{erro ?? "Carregando..."}</p>;
  }

  const marcaveis = chavesMarcaveis();
  /** Item que o colaborador anexou pelo link de cadastro: fica marcado sozinho. */
  const anexadoPeloColaborador = (chave: string) => {
    const tipo = TIPO_ANEXO_POR_ITEM[chave];
    return tipo !== undefined && anexados.has(tipo);
  };
  const concluido = (chave: string) => dados[chave] === true || anexadoPeloColaborador(chave);
  const feitos = marcaveis.filter(concluido).length;

  return (
    <div className="flex flex-col gap-2 rounded border border-hairline bg-surface-page p-2 dark:border-brand-neutral/30">
      <div className="flex flex-col gap-0.5">
        <p className="text-[10px] font-semibold text-foreground-muted uppercase">Check list do processo admissional</p>
        <p className="text-[11px] text-foreground">
          <span className="font-medium">Novo colaborador:</span> {nome} · <span className="font-medium">Setor:</span> {departamento ?? "—"}
        </p>
        <p className="text-[11px] text-foreground">
          <span className="font-medium">Data de admissão:</span> {formatarData(dataAdmissao)} · <span className="font-medium">Cargo:</span>{" "}
          {cargo ?? "—"}
        </p>
        <p className="text-[10.5px] text-foreground-muted">
          {feitos} de {marcaveis.length} itens concluídos
        </p>
      </div>

      {SECOES_CHECKLIST.map((secao) => (
        <section key={secao.titulo} className="flex flex-col gap-1.5">
          <h4 className="border-b border-hairline pb-0.5 text-[10.5px] font-semibold text-brand-primary uppercase dark:border-brand-neutral/30">
            {secao.titulo}
          </h4>
          {secao.blocos.map((bloco, i) => (
            <div key={i} className="flex flex-col gap-1">
              {bloco.titulo && <p className="text-[10px] font-semibold text-foreground-muted">{bloco.titulo}</p>}
              {bloco.itens.map((item) => (
                <div key={item.chave} className="flex flex-col gap-0.5">
                  <label className="flex cursor-pointer items-start gap-1.5 text-[11.5px] text-foreground">
                    <input
                      type="checkbox"
                      checked={concluido(item.chave)}
                      disabled={anexadoPeloColaborador(item.chave)}
                      onChange={(e) => atualizar(item.chave, e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className={concluido(item.chave) ? "text-foreground-muted line-through" : undefined}>{item.rotulo}</span>                  </label>
                  {item.detalhes && (
                    <ul className="ml-6 list-disc text-[10.5px] text-foreground-muted">
                      {item.detalhes.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  )}
                  {item.nota && <p className="ml-6 text-[10.5px] text-foreground-muted italic">{item.nota}</p>}
                  {item.campos && (
                    <div className="ml-6 flex flex-wrap gap-2">
                      {item.campos.map((c) => (
                        <label key={c.chave} className="flex items-center gap-1 text-[10.5px] text-foreground-muted">
                          {c.rotulo}
                          <input
                            type={c.tipo}
                            value={typeof dados[c.chave] === "string" ? (dados[c.chave] as string) : ""}
                            onChange={(e) => atualizar(c.chave, e.target.value)}
                            className={INPUT_CLASS}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}

      {erro && <p className="text-[10.5px] text-status-danger">{erro}</p>}
    </div>
  );
}
