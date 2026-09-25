"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function ProgramasSaudeClient({
  programasIniciais,
}: {
  programasIniciais: Record<ProgramaSaude, VersaoProgramaSaude | null>;
}) {
  const router = useRouter();
  const [programaAberto, setProgramaAberto] = useState<ProgramaSaude | null>(null);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {PROGRAMAS_SAUDE.map((programa) => {
          const versao = programasIniciais[programa];
          return (
            <Card key={programa} className="flex flex-col gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{programa}</p>
                  <p className="text-[10.5px] text-foreground-muted">{DESCRICAO_PROGRAMA[programa]}</p>
                </div>
                {versao && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${ESTILO_STATUS[versao.status]}`}>
                    {versao.status}
                  </span>
                )}
              </div>

              {versao ? (
                <>
                  <div className="flex items-center gap-4 text-[12px] text-foreground">
                    <span>
                      <span className="text-foreground-muted">Início: </span>
                      <span className="font-medium">{formatarVigencia(versao.vigenciaInicio, versao.precisaoFim)}</span>
                    </span>
                    <span>
                      <span className="text-foreground-muted">Validade: </span>
                      <span className="font-medium">{formatarVigencia(versao.vigenciaFim, versao.precisaoFim)}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground-muted">{rotuloDiasRestantes(versao.diasRestantes)}</p>
                  <p className="text-[11px] text-foreground-muted">Autor: {versao.autor || "—"}</p>
                  {versao.anexoNome && (
                    <a
                      href={`/api/sst/programas/${versao.id}/anexo`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-primary underline underline-offset-2 hover:text-brand-primary-hover"
                    >
                      📎 {versao.anexoNome}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-foreground-muted">Nenhum documento cadastrado ainda.</p>
              )}

              <button
                type="button"
                onClick={() => setProgramaAberto(programa)}
                className="mt-1 flex items-center justify-center gap-1.5 rounded border border-hairline px-3 py-2 text-[12px] font-medium text-foreground-muted transition-colors hover:bg-surface-page"
              >
                <span aria-hidden>⬆</span> Carregar novo documento
              </button>
            </Card>
          );
        })}
      </div>

      {programaAberto && (
        <ModalNovaVersao
          programa={programaAberto}
          onFechar={() => setProgramaAberto(null)}
          onSalvo={() => {
            setProgramaAberto(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ModalNovaVersao({
  programa,
  onFechar,
  onSalvo,
}: {
  programa: ProgramaSaude;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [precisao, setPrecisao] = useState<PrecisaoData>("mes");
  const [vigenciaInicio, setVigenciaInicio] = useState("");
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [autor, setAutor] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tipoInput = precisao === "mes" ? "month" : "date";

  async function salvar() {
    if (!vigenciaInicio || !vigenciaFim || !autor.trim()) {
      setErro("Preencha início, vencimento e autor.");
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
        const dadosUpload = await resUpload.json();
        if (!resUpload.ok) throw new Error(dadosUpload.erro ?? "Falha ao subir o PDF.");
        anexoUrl = dadosUpload.url;
        anexoNome = dadosUpload.nome;
      }

      const res = await fetch("/api/sst/programas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programa, vigenciaInicio, vigenciaFim, precisaoFim: precisao, autor: autor.trim(), anexoUrl, anexoNome }),
      });
      const dados = await res.json();
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
      titulo={`Novo documento — ${programa}`}
      subtitulo="Registra uma nova versão; o histórico anterior fica guardado"
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
          <span className="mb-1 block text-[11px] font-medium text-foreground-muted">Documento (PDF, opcional)</span>
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
