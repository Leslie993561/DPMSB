"use client";

import type { ItemProgramacaoFerias } from "@/lib/db/programacaoFerias";
import { formatarMoeda, formatarDataBr } from "@/lib/format";

function competenciaLabel(dataIso: string): string {
  const [ano, mes] = dataIso.split("-");
  return `${mes}/${ano}`;
}

function retornoEstimado(item: ItemProgramacaoFerias): string {
  if (item.dataRetorno) return item.dataRetorno;
  const d = new Date(item.dataInicio);
  d.setDate(d.getDate() + item.dias);
  return d.toISOString().slice(0, 10);
}

export function DetalheCalculoModal({ item, onFechar }: { item: ItemProgramacaoFerias; onFechar: () => void }) {
  const d = item.detalhe;
  const brutoMaisEncargos = d.bruto + d.fgts + d.inssPatronal;
  const retorno = retornoEstimado(item);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-md border border-hairline bg-background shadow-drawer">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">Cálculo das férias</p>
            <h3 className="text-[13.5px] font-semibold text-foreground uppercase">{item.colaboradorNome}</h3>
            <p className="text-[10.5px] font-normal text-foreground-muted normal-case">
              {item.colaboradorCargo ?? "—"} · {item.colaboradorDepartamento ?? "—"}
            </p>
          </div>
          <button type="button" onClick={onFechar} className="text-foreground-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded border border-hairline bg-surface-page px-2 py-1.5">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Período programado</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">
                {formatarDataBr(item.dataInicio)} → {formatarDataBr(retorno)}
              </p>
            </div>
            <div className="rounded border border-hairline bg-surface-page px-2 py-1.5">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Dias de férias</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">
                {item.dias} de {item.diasDireito} dias
              </p>
            </div>
            <div className="rounded border border-hairline bg-surface-page px-2 py-1.5">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Abono pecuniário</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">{item.abono ? "Sim" : "Não"}</p>
            </div>
            <div className="rounded border border-hairline bg-surface-page px-2 py-1.5">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Salário base</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">{formatarMoeda(d.salarioBase)}</p>
            </div>
          </div>

          <div className="rounded border border-hairline p-3">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Memória de cálculo</p>
            <dl className="space-y-1 text-[11px]">
              <LinhaValor label="Salário base mensal (folha)" valor={d.salarioBase} />
              <LinhaValor label="Base diária (salário ÷ 30)" valor={d.valorDiario} />
              <LinhaValor label={`Férias · ${item.dias} dias`} valor={d.valorGozado} />
              <LinhaValor label="1/3 constitucional" valor={d.tercoConstitucional} />
              <LinhaValor label="Abono pecuniário" valor={item.abono ? d.abono + d.tercoAbono : null} />
              <LinhaValor label="Bruto das férias" valor={d.bruto} destaque />
              <LinhaValor label="(–) INSS" valor={-d.inss || 0} negativo />
              <LinhaValor label="(–) IRRF" valor={-d.irrf || 0} negativo />
              <LinhaValor label="Líquido a receber" valor={d.liquido} destaque cor="text-status-success" />
            </dl>
          </div>

          <div className="rounded border border-hairline p-3">
            <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Encargos da empresa</p>
            <dl className="space-y-1 text-[11px]">
              <LinhaValor label="FGTS 8%" valor={d.fgts} corValor="text-status-warning" />
              <LinhaValor label="INSS patronal 20%" valor={d.inssPatronal} corValor="text-status-warning" />
              <LinhaValor label="Bruto + encargos" valor={brutoMaisEncargos} destaque />
            </dl>
          </div>

          <div className="rounded border border-brand-dark-900 bg-brand-dark-900 p-3">
            <p className="text-[10px] font-semibold tracking-wide text-brand-white/70 uppercase">Custo total previsto</p>
            <p className="mt-1 text-lg font-bold text-brand-white">{formatarMoeda(item.custoPrevisto)}</p>
            <p className="mt-0.5 text-[10px] text-brand-white/60">
              {item.dias} dias · {formatarDataBr(item.dataInicio)} a {formatarDataBr(retorno)} ·
              competência {competenciaLabel(item.dataInicio)}
            </p>
          </div>

          {item.vencida ? (
            <div className="rounded border border-status-danger-border bg-status-danger-bg px-2.5 py-1.5 text-[11px] text-status-danger">
              <span aria-hidden>▲</span> Período vencido: o limite p/ gozo era {formatarDataBr(item.concessivoFim)} e restam{" "}
              {item.diasDireito - item.dias} dias — conceder de imediato. Descontos calculados sobre férias + 1/3; abono não
              integra a base de INSS e IRRF.
            </div>
          ) : (
            <div className="rounded border border-status-info-bg bg-status-info-bg px-2.5 py-1.5 text-[11px] text-brand-primary-800">
              <span aria-hidden>ⓘ</span> Limite p/ gozo em {formatarDataBr(item.concessivoFim)}. Descontos calculados sobre
              férias + 1/3; abono não integra a base de INSS e IRRF.
            </div>
          )}

          <p className="text-[10px] text-foreground-muted">
            Cálculo determinístico (lib/calc) — nunca aproximado ou digitado manualmente.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground-muted hover:bg-surface-page dark:border-brand-neutral/30"
          >
            Fechar
          </button>
          <a
            href={`/api/periodos-aquisitivos/exportar?tipo=colaborador&colaboradorId=${item.colaboradorId}`}
            download
            className="flex items-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover"
          >
            ↓ Exportar cálculo
          </a>
        </div>
      </div>
    </div>
  );
}

function LinhaValor({
  label,
  valor,
  destaque,
  negativo,
  cor,
  corValor,
}: {
  label: string;
  valor: number | null;
  destaque?: boolean;
  negativo?: boolean;
  cor?: string;
  corValor?: string;
}) {
  return (
    <div className={`flex justify-between ${destaque ? `font-semibold ${cor ?? "text-foreground"}` : "text-foreground-muted"}`}>
      <dt>{label}</dt>
      <dd className={negativo ? "text-status-danger" : corValor}>{valor === null ? "—" : formatarMoeda(valor)}</dd>
    </div>
  );
}
