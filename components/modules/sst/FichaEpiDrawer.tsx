"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/shared/Drawer";
import { Modal } from "@/components/shared/Modal";
import { iniciais } from "@/lib/format";
import type { ColaboradorEpi } from "@/lib/sst/epi";
import type { DocumentoFicha, FichaResumo } from "@/lib/sst/fichas";
import { DocumentoFichaEpi } from "./DocumentoFichaEpi";
import { EditarFichaModal } from "./EditarFichaModal";
import { RegistrarEntregaModal } from "./RegistrarEntregaModal";

/** "DD/MM/AAAA" anterior a hoje; sem data de troca nunca vence. */
function trocaVencida(dataBr: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  if (!m) return false;
  const hoje = new Date();
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

export function FichaEpiDrawer({
  colaborador,
  catalogo,
  itensFardamento,
  onFechar,
}: {
  colaborador: ColaboradorEpi | null;
  /** Todos os EPIs do catálogo com o C.A. padrão. */
  catalogo: { epi: string; ca: string }[];
  itensFardamento: string[];
  onFechar: () => void;
}) {
  const router = useRouter();
  const [fichas, setFichas] = useState<FichaResumo[] | null>(null);
  const [episEntregues, setEpisEntregues] = useState<string[]>([]);
  const [trocas, setTrocas] = useState<{ epi: string; dataTroca: string }[]>([]);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [documento, setDocumento] = useState<DocumentoFicha | null>(null);
  const [editandoFicha, setEditandoFicha] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!colaborador) return;
    fetch(`/api/sst/epi/fichas?colaboradorId=${colaborador.id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Falha ao carregar o histórico.");
        setFichas(d.fichas);
        setEpisEntregues(d.episEntregues);
        setTrocas(d.trocas);
      })
      .catch((e: Error) => setErroCarga(e.message));
  }, [colaborador]);

  useEffect(() => {
    setFichas(null);
    setErroCarga(null);
    setRegistrando(false);
    setDocumento(null);
    carregar();
  }, [carregar]);

  async function excluir(f: FichaResumo) {
    const aviso =
      f.status === "assinada"
        ? `A entrega de ${f.dataEntrega} já foi assinada. Excluir apaga o documento assinado e as entregas dessa ficha. Continuar?`
        : `Excluir a entrega de ${f.dataEntrega}? O link de assinatura deixa de funcionar.`;
    if (!window.confirm(aviso)) return;
    const r = await fetch(`/api/sst/epi/fichas/${f.id}`, { method: "DELETE" });
    if (!r.ok) {
      window.alert((await r.json()).erro ?? "Não foi possível excluir.");
      return;
    }
    carregar();
    router.refresh();
  }

  async function dispensarTroca(epi: string, dataTroca: string) {
    if (!colaborador) return;
    await fetch("/api/sst/epi/trocas-dispensadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaboradorId: colaborador.id, epi, dataTroca }),
    });
    carregar();
  }

  async function dispensarDivergencia(epi: string) {
    if (!colaborador) return;
    await fetch("/api/sst/epi/divergencias-dispensadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaboradorId: colaborador.id, epi }),
    });
    carregar();
  }

  async function abrirDocumento(id: string) {
    const r = await fetch(`/api/sst/epi/fichas/${id}`);
    const d = await r.json();
    if (r.ok) setDocumento(d.documento);
  }

  if (!colaborador) return null;

  const entregues = new Set(episEntregues);
  const semEntrega = colaborador.episObrigatorios.filter((epi) => !entregues.has(epi));
  const vencidos = trocas.filter((t) => trocaVencida(t.dataTroca));

  return (
    <>
      <Drawer aberto onFechar={onFechar} titulo="Ficha do colaborador" subtitulo={colaborador.nome} largura="30rem">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[15px] font-bold text-brand-white">
              {iniciais(colaborador.nome)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-foreground">{colaborador.nome}</p>
              <p className="text-[12px] text-foreground-muted">
                {colaborador.cargo ?? "—"} · {colaborador.departamento ?? "—"}
              </p>
              <p className="text-[10.5px] text-foreground-muted/80">
                Matriz de EPI: {colaborador.funcaoMatriz ?? "função não encontrada"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRegistrando(true)}
            className="rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-hover"
          >
            Registrar entrega de EPI e Fardamento
          </button>

          {fichas !== null &&
            (colaborador.funcaoMatriz === null ? (
              <div className="rounded-md border border-hairline bg-surface-page px-3 py-2.5 text-[12px] text-foreground-muted">
                O cargo deste colaborador não tem função correspondente na matriz de EPI.
              </div>
            ) : semEntrega.length > 0 ? (
              <div className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2.5 text-status-danger">
                <p className="text-[12.5px] font-semibold">
                  ⚠ Divergência: {semEntrega.length} EPI(s) obrigatório(s) sem entrega registrada
                </p>
                <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px]">
                  {semEntrega.map((epi) => (
                    <li key={epi} className="flex items-center gap-1.5">
                      <span className="flex-1">{epi}</span>
                      <button
                        type="button"
                        onClick={() => void dispensarDivergencia(epi)}
                        title="Excluir esta divergência (ex.: não se aplica de fato a este colaborador)"
                        aria-label={`Excluir divergência de ${epi}`}
                        className="shrink-0 rounded px-1 text-status-danger/50 hover:bg-status-danger/10 hover:text-status-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : vencidos.length === 0 ? (
              <div className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2.5 text-[12px] text-status-success">
                Todos os EPIs obrigatórios da função têm entrega registrada e estão dentro do prazo de troca.
              </div>
            ) : null)}

          {fichas !== null && vencidos.length > 0 && (
            <div className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2.5 text-status-danger">
              <p className="text-[12.5px] font-semibold">⚠ Troca necessária: {vencidos.length} EPI(s) com prazo de troca vencido</p>
              <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px]">
                {vencidos.map((t) => (
                  <li key={t.epi} className="flex items-center gap-1.5">
                    <span className="flex-1">
                      {t.epi} <span className="text-[11px] opacity-80">· venceu em {t.dataTroca}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void dispensarTroca(t.epi, t.dataTroca)}
                      title="Excluir este aviso (ex.: já foi trocado ou descartado)"
                      aria-label={`Excluir aviso de troca vencida de ${t.epi}`}
                      className="shrink-0 rounded px-1 text-status-danger/50 hover:bg-status-danger/10 hover:text-status-danger"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[13px] font-semibold text-foreground">Histórico de entregas ({fichas?.length ?? 0})</p>

            {erroCarga ? (
              <p className="mt-3 text-[12px] text-status-danger">{erroCarga}</p>
            ) : fichas === null ? (
              <p className="mt-3 text-[12px] text-foreground-muted">Carregando...</p>
            ) : fichas.length === 0 ? (
              <p className="mt-3 text-[12px] text-foreground-muted">Nenhuma entrega registrada para este colaborador ainda.</p>
            ) : (
              <div className="mt-2 flex flex-col divide-y divide-hairline/70 rounded-md border border-hairline">
                {fichas.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2">
                    {f.status === "assinada" ? (
                      <span className="text-[12.5px] font-medium text-foreground">{f.dataEntrega || "—"}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditandoFicha(f.id)}
                        title="Editar os itens desta ficha"
                        aria-label={`Editar a ficha de ${f.dataEntrega}`}
                        className="text-[12.5px] font-medium text-brand-primary underline decoration-dotted underline-offset-2 hover:text-brand-primary-hover"
                      >
                        {f.dataEntrega || "—"}
                      </button>
                    )}
                    <span className="flex-1 truncate text-center text-[10.5px] font-light whitespace-nowrap text-foreground-muted/80">{f.conteudo}</span>
                    {f.status === "assinada" ? (
                      <button
                        type="button"
                        onClick={() => void abrirDocumento(f.id)}
                        title="Ver documento assinado"
                        aria-label={`Ver documento assinado da entrega de ${f.dataEntrega}`}
                        className="rounded px-1.5 py-0.5 text-[15px] text-brand-primary hover:bg-brand-primary-100"
                      >
                        📎
                      </button>
                    ) : f.expirada ? (
                      <span className="text-[11px] text-status-danger">Link expirado · sem assinatura</span>
                    ) : (
                      <span className="flex items-center gap-2 text-[11px] text-status-warning">
                        Aguardando assinatura
                        {f.link && (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(f.link!);
                              setCopiada(f.id);
                            }}
                            className="font-medium text-brand-primary hover:text-brand-primary-hover"
                          >
                            {copiada === f.id ? "copiado ✓" : "copiar link"}
                          </button>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void excluir(f)}
                      title="Excluir entrega"
                      aria-label={`Excluir entrega de ${f.dataEntrega}`}
                      className="rounded px-1.5 py-0.5 text-[13px] text-foreground-muted hover:bg-status-danger-bg hover:text-status-danger"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {registrando && (
        <RegistrarEntregaModal
          colaborador={colaborador}
          catalogo={catalogo}
          itensFardamento={itensFardamento}
          onFechar={() => setRegistrando(false)}
          onCriada={() => {
            carregar();
            router.refresh();
          }}
        />
      )}

      {documento && (
        <Modal
          aberto
          onFechar={() => setDocumento(null)}
          eyebrow="Documento assinado"
          titulo={`Ficha de entrega de EPI nº ${documento.numero}`}
          subtitulo={documento.colaborador.nome}
          largura="40rem"
        >
          <DocumentoFichaEpi documento={documento} anexoHref={`/api/sst/epi/fichas/${documento.id}/anexo`} />
        </Modal>
      )}

      {editandoFicha && (
        <EditarFichaModal
          fichaId={editandoFicha}
          colaboradorNome={colaborador.nome}
          onFechar={() => setEditandoFicha(null)}
          onSalvo={() => {
            setEditandoFicha(null);
            carregar();
            router.refresh();
          }}
        />
      )}
    </>
  );
}
