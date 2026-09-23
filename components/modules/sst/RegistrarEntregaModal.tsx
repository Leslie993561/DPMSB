"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import type { ColaboradorEpi } from "@/lib/sst/epi";

const INPUT =
  "rounded border border-hairline bg-background px-2 py-1 text-[11.5px] text-foreground outline-none focus:border-brand-primary";

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Selecao {
  marcado: boolean;
  qtd: string;
  ca: string;
  dataEntrega: string;
  dataTroca: string;
}

export function RegistrarEntregaModal({
  colaborador,
  todosEpis,
  onFechar,
  onCriada,
}: {
  colaborador: ColaboradorEpi;
  /** Catálogo completo — só aparece quando o cargo não tem função na matriz. */
  todosEpis: string[];
  onFechar: () => void;
  onCriada: () => void;
}) {
  const opcoes = colaborador.episObrigatorios.length > 0 ? colaborador.episObrigatorios : todosEpis;
  const [selecao, setSelecao] = useState<Record<string, Selecao>>(() =>
    Object.fromEntries(opcoes.map((epi) => [epi, { marcado: false, qtd: "1", ca: "", dataEntrega: hojeIso(), dataTroca: "" }])),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const marcados = opcoes.filter((epi) => selecao[epi].marcado);
  const todosMarcados = marcados.length === opcoes.length;

  function alterar(epi: string, parcial: Partial<Selecao>) {
    setSelecao((s) => ({ ...s, [epi]: { ...s[epi], ...parcial } }));
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/sst/epi/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: colaborador.id,
          itens: marcados.map((epi) => ({
            epi,
            qtd: Math.max(1, Number(selecao[epi].qtd) || 1),
            ca: selecao[epi].ca,
            dataEntrega: selecao[epi].dataEntrega,
            dataTroca: selecao[epi].dataTroca || null,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Falha ao gerar o link.");
      setLink(d.link);
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o link.");
    } finally {
      setEnviando(false);
    }
  }

  const assunto = encodeURIComponent("Ficha de entrega de EPI para assinatura");
  const corpo = encodeURIComponent(
    `Olá, ${colaborador.nome.split(" ")[0]}!\n\nSegue o link para conferir e assinar a sua ficha de entrega de EPI:\n${link ?? ""}\n\nPara assinar, entre com o seu e-mail profissional.\n\nRH · MSB`,
  );

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Gestão de EPI"
      titulo="Registrar entrega de EPI"
      subtitulo={colaborador.nome}
      largura="44rem"
      rodape={
        link ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onFechar}
              className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover"
            >
              Concluir
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={marcados.length === 0 || enviando}
              className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {enviando ? "Gerando link..." : "Enviar link de assinatura"}
            </button>
          </div>
        )
      }
    >
      {link ? (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-foreground">
            Ficha gerada com {marcados.length} EPI(s). Envie o link abaixo para {colaborador.nome.split(" ")[0]}. Para assinar, é preciso entrar com o
            e-mail profissional{colaborador.email ? ` (${colaborador.email})` : ""}. O link vale por 7 dias.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface-page p-2">
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{link}</span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                setCopiado(true);
              }}
              className="shrink-0 rounded bg-brand-primary px-2.5 py-1 text-[11.5px] font-medium text-brand-white hover:bg-brand-primary-hover"
            >
              {copiado ? "Copiado ✓" : "Copiar link"}
            </button>
          </div>
          {colaborador.email ? (
            <a
              href={`mailto:${colaborador.email}?subject=${assunto}&body=${corpo}`}
              className="self-start text-[12px] font-medium text-brand-primary hover:text-brand-primary-hover"
            >
              Abrir e-mail para {colaborador.email} →
            </a>
          ) : (
            <p className="text-[11.5px] text-status-warning">
              Este colaborador não tem e-mail profissional no Quadro — sem ele não conseguirá assinar. Cadastre o
              e-mail antes de enviar o link.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-foreground-muted">
              {colaborador.funcaoMatriz
                ? `EPIs da função ${colaborador.funcaoMatriz}`
                : "Cargo sem função na matriz — mostrando todo o catálogo"}
            </p>
            <button
              type="button"
              onClick={() => opcoes.forEach((epi) => alterar(epi, { marcado: !todosMarcados }))}
              className="text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover"
            >
              {todosMarcados ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>

          <div className="flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
            {opcoes.map((epi) => {
              const s = selecao[epi];
              return (
                <div key={epi} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
                    <input
                      type="checkbox"
                      checked={s.marcado}
                      onChange={(e) => alterar(epi, { marcado: e.target.checked })}
                      className="accent-brand-primary"
                    />
                    <span className="truncate">{epi}</span>
                  </label>
                  {s.marcado && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex flex-col text-[9.5px] text-foreground-muted">
                        Quant.
                        <input
                          type="number"
                          min={1}
                          value={s.qtd}
                          onChange={(e) => alterar(epi, { qtd: e.target.value })}
                          className={INPUT + " w-14"}
                        />
                      </label>
                      <label className="flex flex-col text-[9.5px] text-foreground-muted">
                        C.A.
                        <input
                          value={s.ca}
                          onChange={(e) => alterar(epi, { ca: e.target.value })}
                          placeholder="Nº"
                          className={INPUT + " w-20"}
                        />
                      </label>
                      <label className="flex flex-col text-[9.5px] text-foreground-muted">
                        Entrega
                        <input
                          type="date"
                          value={s.dataEntrega}
                          onChange={(e) => alterar(epi, { dataEntrega: e.target.value })}
                          className={INPUT}
                        />
                      </label>
                      <label className="flex flex-col text-[9.5px] text-foreground-muted">
                        Troca prevista
                        <input
                          type="date"
                          value={s.dataTroca}
                          onChange={(e) => alterar(epi, { dataTroca: e.target.value })}
                          className={INPUT}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {erro && <p className="text-[11.5px] text-status-danger">{erro}</p>}
        </div>
      )}
    </Modal>
  );
}
