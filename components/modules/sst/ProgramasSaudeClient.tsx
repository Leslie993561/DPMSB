"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";
import { formatarDataBr } from "@/lib/format";
import type { VersaoProgramaSaude } from "@/lib/sst/programas";
import { PROGRAMAS_SAUDE, type PrecisaoData, type ProgramaSaude, type StatusPrograma } from "@/lib/sst/domain";

const DESCRICAO_PROGRAMA: Record<ProgramaSaude, string> = {
  PCMSO: "Programa de Controle Médico de Saúde Ocupacional",
  LTCAT: "Laudo Técnico das Condições do Ambiente de Trabalho",
  PGR: "Programa de Gerenciamento de Riscos",
};

// A hospedagem recusa o corpo da requisição acima disso (413) antes até de chegar
// na rota — mesmo teto do TAMANHO_MAX em app/api/sst/programas/anexo/route.ts.
const TAMANHO_MAX_PDF = 4 * 1024 * 1024;

const ESTILO_STATUS: Record<StatusPrograma, string> = {
  Vigente: "bg-status-success-bg text-status-success",
  "Próximo do vencimento": "border border-status-warning-border bg-status-warning-bg text-status-warning",
  Vencido: "border border-status-danger-border bg-status-danger-bg text-status-danger",
};

function formatarVigencia(valor: string, precisao: PrecisaoData): string {
  if (!valor) return "—";
  if (precisao === "mes") {
    const [ano, mes] = valor.split("-");
    return mes && ano ? `${mes}/${ano}` : valor;
  }
  return formatarDataBr(valor);
}

function rotuloDiasRestantes(dias: number | null): string {
  if (dias === null) return "";
  if (dias < 0) return `venceu há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "vence hoje";
  return `${dias} dia(s) restante(s)`;
}

/** A hospedagem recusa corpo grande demais antes até de chegar na rota (ex.: PDF grande) e devolve
 * texto puro, não JSON — sem isso, `.json()` quebra com "Unexpected token" em vez de um erro legível. */
async function parseRespostaJson(res: Response): Promise<{ erro?: string; [chave: string]: unknown }> {
  try {
    return await res.json();
  } catch {
    return { erro: res.status === 413 ? "Arquivo muito grande para o servidor aceitar." : `Falha inesperada (HTTP ${res.status}).` };
  }
}

export function ProgramasSaudeClient({
  programasIniciais,
}: {
  programasIniciais: Record<ProgramaSaude, VersaoProgramaSaude | null>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PROGRAMAS_SAUDE.map((programa) => (
        <CardPrograma key={programa} programa={programa} versaoInicial={programasIniciais[programa]} />
      ))}
    </div>
  );
}

type ModalAberto = { modo: "novo" } | { modo: "editar"; versao: VersaoProgramaSaude };

function CardPrograma({ programa, versaoInicial }: { programa: ProgramaSaude; versaoInicial: VersaoProgramaSaude | null }) {
  const [historico, setHistorico] = useState<VersaoProgramaSaude[] | null>(null);
  const [linhaExpandida, setLinhaExpandida] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalAberto | null>(null);

  const carregarHistorico = useCallback(() => {
    return fetch(`/api/sst/programas/historico?programa=${programa}`)
      .then((r) => r.json())
      .then((dados) => setHistorico(dados.versoes ?? []));
  }, [programa]);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  // Enquanto o histórico ainda não carregou, usa o que o servidor já mandou
  // pronto (evita o card nascer vazio); depois disso o histórico manda.
  const versaoAtual = historico && historico.length > 0 ? historico[0] : historico ? null : versaoInicial;

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{programa}</p>
          <p className="text-[10.5px] text-foreground-muted">{DESCRICAO_PROGRAMA[programa]}</p>
        </div>
        {versaoAtual && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${ESTILO_STATUS[versaoAtual.status]}`}>
            {versaoAtual.status}
          </span>
        )}
      </div>

      {historico && (
        <div className="space-y-1">
          {historico.length === 0 ? (
            <p className="text-[12px] text-foreground-muted">Nenhum documento cadastrado ainda.</p>
          ) : (
            historico.map((v) => {
              const expandida = linhaExpandida === v.id;
              return (
                <div key={v.id} className="rounded border border-hairline/70 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-foreground">
                      {formatarVigencia(v.vigenciaInicio, v.precisaoFim)} → {formatarVigencia(v.vigenciaFim, v.precisaoFim)}
                    </span>
                    <button
                      type="button"
                      title="Ver autor e anexo"
                      onClick={() => setLinhaExpandida(expandida ? null : v.id)}
                      className="shrink-0 text-[13px] hover:opacity-70"
                    >
                      📎
                    </button>
                  </div>
                  {expandida && (
                    <div className="mt-1.5 space-y-1 border-t border-hairline/70 pt-1.5">
                      <p className="text-[10.5px] text-foreground-muted">Autor: {v.autor || "—"}</p>
                      {v.anexoNome ? (
                        <a
                          href={`/api/sst/programas/${v.id}/anexo`}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[10.5px] text-brand-primary underline underline-offset-2 hover:text-brand-primary-hover"
                        >
                          📎 {v.anexoNome}
                        </a>
                      ) : (
                        <p className="text-[10.5px] text-foreground-muted">Sem anexo.</p>
                      )}
                      <button
                        type="button"
                        onClick={() => setModal({ modo: "editar", versao: v })}
                        className="text-[10.5px] font-medium text-brand-primary hover:text-brand-primary-hover"
                      >
                        ✎ Editar
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setModal({ modo: "novo" })}
        className="mt-1 flex items-center justify-center gap-1.5 rounded border border-hairline px-3 py-2 text-[12px] font-medium text-foreground-muted transition-colors hover:bg-surface-page"
      >
        <span aria-hidden>⬆</span> Carregar novo documento
      </button>

      {modal && (
        <ModalVersaoPrograma
          programa={programa}
          versaoEditar={modal.modo === "editar" ? modal.versao : undefined}
          onFechar={() => setModal(null)}
          onSalvo={() => {
            setModal(null);
            void carregarHistorico();
          }}
        />
      )}
    </Card>
  );
}

function ModalVersaoPrograma({
  programa,
  versaoEditar,
  onFechar,
  onSalvo,
}: {
  programa: ProgramaSaude;
  versaoEditar?: VersaoProgramaSaude;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = Boolean(versaoEditar);
  const [precisao, setPrecisao] = useState<PrecisaoData>(versaoEditar?.precisaoFim ?? "mes");
  const [vigenciaInicio, setVigenciaInicio] = useState(versaoEditar?.vigenciaInicio ?? "");
  const [vigenciaFim, setVigenciaFim] = useState(versaoEditar?.vigenciaFim ?? "");
  const [autor, setAutor] = useState(versaoEditar?.autor ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tipoInput = precisao === "mes" ? "month" : "date";

  async function salvar() {
    if (!vigenciaInicio || !vigenciaFim || !autor.trim()) {
      setErro("Preencha início, vencimento e autor.");
      return;
    }
    if (arquivo && arquivo.size > TAMANHO_MAX_PDF) {
      setErro("Esse PDF passa de 4MB — o servidor recusa antes de chegar no portal. Comprima o arquivo e tente de novo.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      let anexoUrl: string | null = null;
      let anexoNome: string | null = null;
      if (arquivo) {
        const form = new FormData();
        form.append("arquivo", arquivo);
        const resUpload = await fetch("/api/sst/programas/anexo", { method: "POST", body: form });
        const dadosUpload = await parseRespostaJson(resUpload);
        if (!resUpload.ok) throw new Error(dadosUpload.erro ?? "Falha ao subir o PDF.");
        anexoUrl = (dadosUpload.url as string) ?? null;
        anexoNome = (dadosUpload.nome as string) ?? null;
      }

      const corpo = { vigenciaInicio, vigenciaFim, precisaoFim: precisao, autor: autor.trim(), anexoUrl, anexoNome };
      const res = editando
        ? await fetch(`/api/sst/programas/${versaoEditar!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          })
        : await fetch("/api/sst/programas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ programa, ...corpo }),
          });
      const dados = await parseRespostaJson(res);
      if (!res.ok) throw new Error(dados.erro ?? "Falha ao salvar.");
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="SST · Programas"
      titulo={editando ? `Editar documento — ${programa}` : `Novo documento — ${programa}`}
      subtitulo={editando ? "Corrige os dados desta versão — não cria uma nova" : "Registra uma nova versão; o histórico anterior fica guardado"}
      rodape={
        <>
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-hairline px-3 py-1.5 text-[12.5px] font-medium text-foreground-muted hover:bg-surface-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="ml-auto rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {erro && <p className="text-[12px] text-status-danger">{erro}</p>}

        <div>
          <p className="mb-1 text-[11px] font-medium text-foreground-muted">Precisão da data</p>
          <div className="flex gap-3 text-[12.5px]">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={precisao === "mes"} onChange={() => setPrecisao("mes")} /> Mês/ano
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={precisao === "dia"} onChange={() => setPrecisao("dia")} /> Data completa
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-foreground-muted">Início (data de aplicação)</span>
            <input
              type={tipoInput}
              value={vigenciaInicio}
              onChange={(e) => setVigenciaInicio(e.target.value)}
              className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[13px] text-foreground"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-foreground-muted">Vencimento</span>
            <input
              type={tipoInput}
              value={vigenciaFim}
              onChange={(e) => setVigenciaFim(e.target.value)}
              className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[13px] text-foreground"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-foreground-muted">Autor / responsável técnico</span>
          <input
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            placeholder="Ex.: CARLOS ROBERTO SANTIAGO CRM: BA 4828"
            className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[13px] text-foreground"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-foreground-muted">
            Documento (PDF{editando ? ", deixe em branco para manter o atual" : ", opcional"})
          </span>
          {editando && versaoEditar?.anexoNome && !arquivo && (
            <p className="mb-1 text-[10.5px] text-foreground-muted">Atual: 📎 {versaoEditar.anexoNome}</p>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="w-full text-[12.5px] text-foreground-muted"
          />
        </label>
      </div>
    </Modal>
  );
}
