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
  editandoCa: boolean;
  dataEntrega: string;
  dataTroca: string;
}

export function RegistrarEntregaModal({
  colaborador,
  catalogo,
  itensFardamento,
  onFechar,
  onCriada,
}: {
  colaborador: ColaboradorEpi;
  /** Catálogo com C.A. padrão; a lista completa só aparece quando o cargo não tem função na matriz. */
  catalogo: { epi: string; ca: string }[];
  /** Itens de fardamento do catálogo (Custo e Valores). */
  itensFardamento: string[];
  onFechar: () => void;
  onCriada: () => void;
}) {
  const opcoes = colaborador.episObrigatorios.length > 0 ? colaborador.episObrigatorios : catalogo.map((c) => c.epi);
  const caPadrao = (epi: string) => catalogo.find((c) => c.epi === epi)?.ca ?? "";
  const [selecao, setSelecao] = useState<Record<string, Selecao>>(() =>
    Object.fromEntries(opcoes.map((epi) => [epi, { marcado: false, qtd: "1", ca: caPadrao(epi), editandoCa: false, dataEntrega: hojeIso(), dataTroca: "" }])),
  );
  const [fardamento, setFardamento] = useState<Record<string, { marcado: boolean; qtd: string; dataEntrega: string }>>(
    () => Object.fromEntries(itensFardamento.map((t) => [t, { marcado: false, qtd: "1", dataEntrega: hojeIso() }])),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [envio, setEnvio] = useState<{ para: string | null; erro: string | null }>({ para: null, erro: null });
  const [copiado, setCopiado] = useState(false);
  const [anexo, setAnexo] = useState<{ url: string; nome: string } | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);

  async function anexarPdf(arquivo: File) {
    setErroAnexo(null);
    if (arquivo.type !== "application/pdf") {
      setErroAnexo("Só é permitido anexar PDF.");
      return;
    }
    setEnviandoAnexo(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const r = await fetch("/api/sst/epi/anexo", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Falha ao anexar o PDF.");
      setAnexo({ url: d.url, nome: d.nome });
    } catch (e) {
      setErroAnexo(e instanceof Error ? e.message : "Falha ao anexar o PDF.");
    } finally {
      setEnviandoAnexo(false);
    }
  }

  const marcados = opcoes.filter((epi) => selecao[epi].marcado);
  const todosMarcados = marcados.length === opcoes.length;
  const fardamentoMarcado = itensFardamento.filter((t) => fardamento[t].marcado);
  const totalItens = marcados.length + fardamentoMarcado.length;

  function alterarFardamento(tipo: string, parcial: Partial<{ marcado: boolean; qtd: string; dataEntrega: string }>) {
    setFardamento((s) => ({ ...s, [tipo]: { ...s[tipo], ...parcial } }));
  }

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
          fardamento: fardamentoMarcado.map((tipo) => ({
            tipo,
            qtd: Math.max(1, Number(fardamento[tipo].qtd) || 1),
            dataEntrega: fardamento[tipo].dataEntrega,
          })),
          anexoUrl: anexo?.url ?? null,
          anexoNome: anexo?.nome ?? null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Falha ao gerar o link.");
      setLink(d.link);
      setEnvio({ para: d.emailEnviadoPara, erro: d.erroEmail });
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
      titulo="Registrar entrega de EPI e Fardamento"
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
              disabled={totalItens === 0 || enviando || enviandoAnexo || !colaborador.email}
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
          {envio.para ? (
            <p className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2 text-[12.5px] text-status-success">
              ✓ Ficha gerada com {totalItens} item(ns) e link de assinatura enviado para <strong>{envio.para}</strong>.
              O link vale por 7 dias.
            </p>
          ) : (
            <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[12.5px] text-status-warning">
              Ficha gerada com {totalItens} item(ns), mas o e-mail não foi enviado: {envio.erro} Copie o link abaixo e
              envie para {colaborador.nome.split(" ")[0]}.
            </p>
          )}
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
          {!envio.para && colaborador.email && (
            <a
              href={`mailto:${colaborador.email}?subject=${assunto}&body=${corpo}`}
              className="self-start text-[12px] font-medium text-brand-primary hover:text-brand-primary-hover"
            >
              Abrir e-mail para {colaborador.email} →
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {colaborador.email ? (
            <p className="text-[11px] text-foreground-muted">
              O link de assinatura será enviado para <strong className="text-foreground">{colaborador.email}</strong>.
            </p>
          ) : (
            <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[11.5px] text-status-warning">
              Este colaborador não tem e-mail profissional no Quadro de Colaboradores — cadastre o e-mail para poder
              enviar a ficha para assinatura.
            </p>
          )}
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

          <div className="flex items-center gap-2 text-[11px]">
            <label className="cursor-pointer font-medium text-brand-primary hover:text-brand-primary-hover">
              {enviandoAnexo ? "Anexando..." : anexo ? "Trocar PDF anexado" : "📎 Anexar PDF"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={enviandoAnexo}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void anexarPdf(arquivo);
                  e.target.value = "";
                }}
              />
            </label>
            {anexo && (
              <span className="flex items-center gap-1 truncate text-foreground-muted">
                {anexo.nome}
                <button
                  type="button"
                  onClick={() => setAnexo(null)}
                  aria-label="Remover anexo"
                  className="text-foreground-muted hover:text-status-danger"
                >
                  ✕
                </button>
              </span>
            )}
            {erroAnexo && <span className="text-status-danger">{erroAnexo}</span>}
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
                      <div className="flex flex-col text-[9.5px] text-foreground-muted">
                        C.A.
                        {s.editandoCa ? (
                          <input
                            autoFocus
                            value={s.ca}
                            onChange={(e) => alterar(epi, { ca: e.target.value })}
                            onBlur={() => alterar(epi, { editandoCa: false })}
                            placeholder="Nº"
                            className={INPUT + " w-20"}
                          />
                        ) : (
                          <span className="flex h-[26px] w-20 items-center justify-between rounded border border-transparent px-1 text-[11.5px] text-foreground">
                            {s.ca || "—"}
                            <button
                              type="button"
                              onClick={() => alterar(epi, { editandoCa: true })}
                              title="Editar C.A."
                              aria-label={`Editar C.A. de ${epi}`}
                              className="rounded px-0.5 text-foreground-muted hover:text-brand-primary"
                            >
                              ✏️
                            </button>
                          </span>
                        )}
                      </div>
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

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] font-semibold tracking-wide text-foreground uppercase">Fardamento</p>
            <button
              type="button"
              onClick={() => {
                const marcar = fardamentoMarcado.length !== itensFardamento.length;
                itensFardamento.forEach((tipo) => alterarFardamento(tipo, { marcado: marcar }));
              }}
              className="text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover"
            >
              {fardamentoMarcado.length === itensFardamento.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>
          <div className="flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
            {itensFardamento.map((tipo) => {
              const f = fardamento[tipo];
              return (
                <div key={tipo} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2.5 py-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
                    <input
                      type="checkbox"
                      checked={f.marcado}
                      onChange={(e) => alterarFardamento(tipo, { marcado: e.target.checked })}
                      className="accent-brand-primary"
                    />
                    <span className="truncate">{tipo}</span>
                  </label>
                  {f.marcado && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex flex-col text-[9.5px] text-foreground-muted">
                        Quant.
                        <input
                          type="number"
                          min={1}
                          value={f.qtd}
                          onChange={(e) => alterarFardamento(tipo, { qtd: e.target.value })}
                          className={INPUT + " w-14"}
                        />
                      </label>
                      <label className="flex flex-col text-[9.5px] text-foreground-muted">
                        Entrega
                        <input
                          type="date"
                          value={f.dataEntrega}
                          onChange={(e) => alterarFardamento(tipo, { dataEntrega: e.target.value })}
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
