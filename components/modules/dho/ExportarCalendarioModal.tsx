"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { baixarCalendarioPdf, renderizarCalendario, type AcaoParaPdf, type DataParaPdf } from "@/lib/dho/exportarCalendarioPdf";

/**
 * Prévia do calendário do ano escolhido (datas comemorativas e títulos das
 * ações) no modelo anual da MSB, com o botão de baixar em PDF.
 */
export function ExportarCalendarioModal({
  anoInicial,
  datasIniciais,
  acoesIniciais,
  onFechar,
}: {
  anoInicial: number;
  datasIniciais: DataParaPdf[];
  acoesIniciais: AcaoParaPdf[];
  onFechar: () => void;
}) {
  const [ano, setAno] = useState(anoInicial);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function montar() {
      setPrevia(null);
      setErro(null);
      try {
        let datas = datasIniciais;
        let acoes = acoesIniciais;
        if (ano !== anoInicial) {
          const [resEventos, resDatas] = await Promise.all([
            fetch(`/api/dho/eventos?ano=${ano}`),
            fetch(`/api/dho/datas-comemorativas?ano=${ano}`),
          ]);
          if (!resEventos.ok || !resDatas.ok) throw new Error("Não foi possível carregar o calendário desse ano.");
          datas = ((await resDatas.json()).datas ?? []) as DataParaPdf[];
          acoes = ((await resEventos.json()).eventos ?? []) as AcaoParaPdf[];
        }
        const canvas = await renderizarCalendario(
          ano,
          datas.map((d) => ({ data: d.data, nome: d.nome, categoria: d.categoria })),
          acoes.map((e) => ({ data: e.data, dataFim: e.dataFim, titulo: e.titulo })),
        );
        if (cancelado) return;
        canvasRef.current = canvas;
        setPrevia(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível montar o calendário.");
      }
    }
    void montar();
    return () => {
      cancelado = true;
    };
  }, [ano, anoInicial, datasIniciais, acoesIniciais]);

  async function baixar() {
    if (!canvasRef.current) return;
    setBaixando(true);
    try {
      await baixarCalendarioPdf(canvasRef.current, ano);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Modal
      aberto
      onFechar={onFechar}
      eyebrow="Calendário"
      titulo="Exportar calendário"
      subtitulo="Datas comemorativas e ações do ano escolhido"
      largura="46rem"
      rodape={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAno((a) => a - 1)}
              className="rounded border border-hairline px-2 py-1 text-[11px] text-foreground-muted hover:bg-surface-page"
            >
              ‹ {ano - 1}
            </button>
            <span className="min-w-12 text-center text-[12.5px] font-semibold text-foreground">{ano}</span>
            <button
              type="button"
              onClick={() => setAno((a) => a + 1)}
              className="rounded border border-hairline px-2 py-1 text-[11px] text-foreground-muted hover:bg-surface-page"
            >
              {ano + 1} ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void baixar()}
              disabled={!previa || baixando}
              className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {baixando ? "Gerando PDF..." : "Baixar PDF"}
            </button>
          </div>
        </div>
      }
    >
      {erro ? (
        <p className="text-[12px] text-status-danger">{erro}</p>
      ) : previa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previa} alt={`Calendário ${ano}`} className="mx-auto w-full max-w-[34rem] rounded border border-hairline" />
      ) : (
        <p className="py-10 text-center text-[12px] text-foreground-muted">Montando o calendário de {ano}...</p>
      )}
    </Modal>
  );
}
