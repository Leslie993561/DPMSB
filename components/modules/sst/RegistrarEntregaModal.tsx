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

/** Linha extra do mesmo EPI (ex.: entregou parte num dia, o resto noutro) — sem "marcado", já implícita. */
type LinhaExtra = Omit<Selecao, "marcado">;

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
  const obrigatorios = colaborador.episObrigatorios;
  const naoObrigatorios = catalogo.map((c) => c.epi).filter((epi) => !obrigatorios.includes(epi));
  const opcoes = [...obrigatorios, ...naoObrigatorios];
  const caPadrao = (epi: string) => catalogo.find((c) => c.epi === epi)?.ca ?? "";
  const [selecao, setSelecao] = useState<Record<string, Selecao>>(() =>
    Object.fromEntries(opcoes.map((epi) => [epi, { marcado: false, qtd: "1", ca: caPadrao(epi), editandoCa: false, dataEntrega: hojeIso(), dataTroca: "" }])),
  );
  const [extras, setExtras] = useState<Record<string, LinhaExtra[]>>({});
  const [fardamento, setFardamento] = useState<Record<string, { marcado: boolean; qtd: string; dataEntrega: string }>>(
    () => Object.fromEntries(itensFardamento.map((t) => [t, { marcado: false, qtd: "1", dataEntrega: hojeIso() }])),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [envio, setEnvio] = useState<{ para: string | null; erro: string | null } | null>(null);
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
  const totalExtras = marcados.reduce((acc, epi) => acc + (extras[epi]?.length ?? 0), 0);
  const totalItens = marcados.length + totalExtras + fardamentoMarcado.length;

  function alterarFardamento(tipo: string, parcial: Partial<{ marcado: boolean; qtd: string; dataEntrega: string }>) {
    setFardamento((s) => ({ ...s, [tipo]: { ...s[tipo], ...parcial } }));
  }

  function alterar(epi: string, parcial: Partial<Selecao>) {
    setSelecao((s) => ({ ...s, [epi]: { ...s[epi], ...parcial } }));
  }

  /** "+" ao lado da linha: entregou o mesmo EPI em outro dia (ou com outro C.A.) além da linha principal. */
  function adicionarExtra(epi: string) {
    setExtras((s) => ({
      ...s,
      [epi]: [...(s[epi] ?? []), { qtd: "1", ca: caPadrao(epi), editandoCa: false, dataEntrega: hojeIso(), dataTroca: "" }],
    }));
  }

  function alterarExtra(epi: string, idx: number, parcial: Partial<LinhaExtra>) {
    setExtras((s) => ({ ...s, [epi]: (s[epi] ?? []).map((l, i) => (i === idx ? { ...l, ...parcial } : l)) }));
  }

  function removerExtra(epi: string, idx: number) {
    setExtras((s) => ({ ...s, [epi]: (s[epi] ?? []).filter((_, i) => i !== idx) }));
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
          itens: [
            ...marcados.map((epi) => ({
              epi,
              qtd: Math.max(1, Number(selecao[epi].qtd) || 1),
              ca: selecao[epi].ca,
              dataEntrega: selecao[epi].dataEntrega,
              dataTroca: selecao[epi].dataTroca || null,
            })),
            ...marcados.flatMap((epi) =>
              (extras[epi] ?? []).map((l) => ({
                epi,
                qtd: Math.max(1, Number(l.qtd) || 1),
                ca: l.ca,
                dataEntrega: l.dataEntrega,
                dataTroca: l.dataTroca || null,
              })),
            ),
          ],
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
      setFichaId(d.fichaId);
      setLink(d.link);
      onCriada();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o link.");
    } finally {
      setEnviando(false);
    }
  }

  /** "Concluir" é quem dispara o e-mail de fato — dá chance de conferir o link antes de mandar pro colaborador. */
  async function concluir() {
    if (!fichaId || !colaborador.email) {
      onFechar();
      return;
    }
    setConcluindo(true);
    try {
      const r = await fetch(`/api/sst/epi/fichas/${fichaId}/enviar-email`, { method: "POST" });
      const d = await r.json();
      setEnvio({ para: d.emailEnviadoPara ?? null, erro: d.erroEmail ?? null });
      if (d.emailEnviadoPara) {
        onFechar();
      }
    } catch {
      setEnvio({ para: null, erro: "Não foi possível enviar o e-mail agora." });
    } finally {
      setConcluindo(false);
    }
  }

  const assunto = encodeURIComponent("Ficha de entrega de EPI para assinatura");
  const corpo = encodeURIComponent(
    `Olá, ${colaborador.nome.split(" ")[0]}!\n\nSegue o link para conferir e assinar a sua ficha de entrega de EPI:\n${link ?? ""}\n\nPara assinar, entre com o seu e-mail profissional.\n\nRH · MSB`,
  );

  /** Larguras fixas iguais na linha principal e nas extras, pra Quant./C.A./Entrega/Troca ficarem um embaixo do outro. */
  const GRADE_LINHA = "grid grid-cols-[1fr_3.5rem_5rem_8.5rem_8.5rem_1.5rem] items-center gap-x-2";

  /** Campos de Quant./C.A./Entrega/Troca — usado na linha principal e em cada linha extra do mesmo EPI. */
  function camposLinha(epi: string, valores: LinhaExtra, onChange: (parcial: Partial<LinhaExtra>) => void, caIdPrefix: string) {
    return (
      <>
        <label className="flex flex-col text-[9.5px] text-foreground-muted">
          Quant.
          <input
            type="number"
            min={1}
            value={valores.qtd}
            onChange={(e) => onChange({ qtd: e.target.value })}
            className={INPUT + " w-14"}
          />
        </label>
        <div className="flex flex-col text-[9.5px] text-foreground-muted">
          C.A.
          {valores.editandoCa ? (
            <input
              autoFocus
              value={valores.ca}
              onChange={(e) => onChange({ ca: e.target.value })}
              onBlur={() => onChange({ editandoCa: false })}
              placeholder="Nº"
              className={INPUT + " w-20"}
            />
          ) : (
            <span className="flex h-[26px] w-20 items-center justify-between rounded border border-transparent px-1 text-[11.5px] text-foreground">
              {valores.ca || "—"}
              <button
                type="button"
                onClick={() => onChange({ editandoCa: true })}
                title="Editar C.A."
                aria-label={`Editar C.A. de ${epi} (${caIdPrefix})`}
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
            value={valores.dataEntrega}
            onChange={(e) => onChange({ dataEntrega: e.target.value })}
            className={INPUT + " w-full"}
          />
        </label>
        <label className="flex flex-col text-[9.5px] text-foreground-muted">
          Troca prevista
          <input
            type="date"
            value={valores.dataTroca}
            onChange={(e) => onChange({ dataTroca: e.target.value })}
            className={INPUT + " w-full"}
          />
        </label>
      </>
    );
  }

  function linhaEpi(epi: string) {
    const s = selecao[epi];
    const linhasExtras = extras[epi] ?? [];
    return (
      <div key={epi} className="flex flex-col gap-1.5 px-2.5 py-2">
        <div className={GRADE_LINHA}>
          <label className="flex min-w-0 cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
            <input
              type="checkbox"
              checked={s.marcado}
              onChange={(e) => alterar(epi, { marcado: e.target.checked })}
              className="accent-brand-primary"
            />
            <span className="truncate">{epi}</span>
          </label>
          {s.marcado && camposLinha(epi, s, (parcial) => alterar(epi, parcial), "principal")}
          {s.marcado ? (
            <button
              type="button"
              onClick={() => adicionarExtra(epi)}
              title="Registrar outra entrega deste EPI com quantidade/data diferente"
              aria-label={`Adicionar outra entrega de ${epi}`}
              className="shrink-0 justify-self-start rounded-full border border-hairline px-1.5 text-[13px] font-semibold text-brand-primary hover:bg-brand-primary-050"
            >
              +
            </button>
          ) : (
            <span />
          )}
        </div>
        {s.marcado &&
          linhasExtras.map((linha, idx) => (
            <div key={idx} className={GRADE_LINHA}>
              <span />
              {camposLinha(epi, linha, (parcial) => alterarExtra(epi, idx, parcial), `extra ${idx + 1}`)}
              <button
                type="button"
                onClick={() => removerExtra(epi, idx)}
                title="Remover esta entrega extra"
                aria-label={`Remover entrega extra ${idx + 1} de ${epi}`}
                className="rounded px-1 text-[11px] text-foreground-muted hover:bg-status-danger-bg hover:text-status-danger"
              >
                ✕
              </button>
            </div>
          ))}
      </div>
    );
  }

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
              onClick={() => void concluir()}
              disabled={concluindo}
              className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {concluindo ? "Enviando..." : envio?.erro ? "Tentar enviar de novo" : "Concluir"}
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
              disabled={totalItens === 0 || enviando || enviandoAnexo}
              className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {enviando ? "Gerando link..." : "Gerar link de assinatura"}
            </button>
          </div>
        )
      }
    >
      {link ? (
        <div className="flex flex-col gap-3">
          {envio?.para ? (
            <p className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2 text-[12.5px] text-status-success">
              ✓ Ficha gerada com {totalItens} item(ns) e link de assinatura enviado para <strong>{envio.para}</strong>.
              O link vale por 7 dias.
            </p>
          ) : envio?.erro ? (
            <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[12.5px] text-status-warning">
              Ficha gerada com {totalItens} item(ns), mas o e-mail não foi enviado: {envio.erro} Copie o link abaixo e
              envie para {colaborador.nome.split(" ")[0]}, ou clique em "Tentar enviar de novo".
            </p>
          ) : colaborador.email ? (
            <p className="rounded-md border border-hairline bg-surface-page px-3 py-2 text-[12.5px] text-foreground-muted">
              Ficha gerada com {totalItens} item(ns). Confira o link abaixo e clique em <strong>Concluir</strong> para
              enviar por e-mail para <strong>{colaborador.email}</strong>.
            </p>
          ) : (
            <p className="rounded-md border border-hairline bg-surface-page px-3 py-2 text-[12.5px] text-foreground-muted">
              Ficha gerada com {totalItens} item(ns). Este colaborador não tem e-mail cadastrado — copie o link abaixo
              e envie manualmente. Concluir só fecha esta tela.
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
          {envio?.erro && colaborador.email && (
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
              Depois de gerar o link, clique em <strong>Concluir</strong> para enviar por e-mail para{" "}
              <strong className="text-foreground">{colaborador.email}</strong>.
            </p>
          ) : (
            <p className="rounded-md border border-status-warning-border bg-status-warning-bg px-3 py-2 text-[11.5px] text-status-warning">
              Este colaborador não tem e-mail profissional no Quadro de Colaboradores — dá pra gerar o link mesmo assim
              e enviar manualmente.
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-foreground-muted">
              {colaborador.funcaoMatriz ? `Função ${colaborador.funcaoMatriz}` : "Cargo sem função na matriz"}
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

          {obrigatorios.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Obrigatórios para o cargo</p>
              <div className="flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
                {obrigatorios.map((epi) => linhaEpi(epi))}
              </div>
            </div>
          )}

          {naoObrigatorios.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                Outros EPIs (não obrigatórios para o cargo)
              </p>
              <div className="flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
                {naoObrigatorios.map((epi) => linhaEpi(epi))}
              </div>
            </div>
          )}

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
