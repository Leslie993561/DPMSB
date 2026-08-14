"use client";

import { useState } from "react";
import { formatarMoeda, formatarDataBr } from "@/lib/format";
import { RiskCallout } from "@/components/shared/RiskCallout";

const INPUT_CLASS =
  "w-full rounded border border-hairline bg-background px-2 py-1 text-[12px] font-light text-foreground dark:border-brand-neutral/30";

interface Verificacao {
  titulo: string;
  nivel: "sucesso" | "atencao" | "erro";
  mensagem: string;
}

interface RespostaValidador {
  periodoAquisitivo: { inicio: string; fim: string };
  periodoConcessivo: { inicio: string; fim: string };
  retorno: string;
  prazoAviso: string;
  prazoPagamento: string;
  verificacoes: Verificacao[];
  valores: {
    valorDiario: number;
    feriasDiasCorridos: number;
    valorGozado: number;
    tercoConstitucional: number;
    diasAbono: number;
    abono: number;
    tercoAbono: number;
    bruto: number;
    inss: number;
    irrf: number;
    liquido: number;
    fgts: number;
    inssPatronal: number;
    custoTotalEmpresa: number;
    encargosEmpresa: number;
  };
}

const ICONE_NIVEL: Record<Verificacao["nivel"], string> = { sucesso: "✓", atencao: "!", erro: "✕" };
const COR_NIVEL: Record<Verificacao["nivel"], string> = {
  sucesso: "border-status-success-bg bg-status-success-bg text-status-success",
  atencao: "border-status-warning-border bg-status-warning-bg text-status-warning",
  erro: "border-status-danger-border bg-status-danger-bg text-status-danger",
};

export function ValidadorCltPanel() {
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [salarioBase, setSalarioBase] = useState("3500");
  const [dependentes, setDependentes] = useState("0");
  const [inicioFerias, setInicioFerias] = useState("");
  const [saldoPeriodo, setSaldoPeriodo] = useState("30");
  const [parte1, setParte1] = useState("14");
  const [parte2, setParte2] = useState("0");
  const [parte3, setParte3] = useState("0");
  const [abono, setAbono] = useState(false);
  const [abonoJaSolicitado, setAbonoJaSolicitado] = useState(false);

  const [resposta, setResposta] = useState<RespostaValidador | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function simular() {
    if (!dataAdmissao || !inicioFerias) {
      setErro("Informe a data de admissão e o início das férias.");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/calc/validador-clt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataAdmissao,
          salarioBase: Number(salarioBase),
          dependentes: Number(dependentes),
          inicioFerias,
          saldoPeriodo: Number(saldoPeriodo),
          fracionamento: [Number(parte1) || 0, Number(parte2) || 0, Number(parte3) || 0],
          abono,
          abonoJaSolicitado,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao validar a programação.");
        return;
      }
      setResposta(data);
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Admissão
          <input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Salário base
          <input type="number" min={0} step="0.01" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Início das férias
          <input type="date" value={inicioFerias} onChange={(e) => setInicioFerias(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Saldo do período
          <input type="number" min={1} max={30} value={saldoPeriodo} onChange={(e) => setSaldoPeriodo(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Dependentes (IRRF)
          <input type="number" min={0} value={dependentes} onChange={(e) => setDependentes(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex items-end gap-1.5 text-[11px] font-normal text-foreground-muted">
          <input type="checkbox" checked={abono} onChange={(e) => setAbono(e.target.checked)} className="accent-brand-primary" />
          Vender abono (1/3 do saldo)
        </label>
        <label className="flex items-end gap-1.5 text-[11px] font-normal text-foreground-muted">
          <input
            type="checkbox"
            checked={abonoJaSolicitado}
            onChange={(e) => setAbonoJaSolicitado(e.target.checked)}
            className="accent-brand-primary"
          />
          Abono já solicitado antes
        </label>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">
          Fracionamento — até 3 partes, uma com no mínimo 14 dias corridos, as demais com 5+
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
            1º período
            <input type="number" min={0} max={30} value={parte1} onChange={(e) => setParte1(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
            2º período
            <input type="number" min={0} max={30} value={parte2} onChange={(e) => setParte2(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
            3º período
            <input type="number" min={0} max={30} value={parte3} onChange={(e) => setParte3(e.target.value)} className={INPUT_CLASS} />
          </label>
        </div>
      </div>

      {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

      <button
        type="button"
        onClick={simular}
        disabled={carregando}
        className="rounded bg-brand-primary px-3 py-1.5 text-[12.5px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
      >
        {carregando ? "Validando..." : "Validar programação"}
      </button>

      {resposta && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded border border-hairline bg-surface-page px-2.5 py-2">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Período aquisitivo</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">
                {formatarDataBr(resposta.periodoAquisitivo.inicio)} – {formatarDataBr(resposta.periodoAquisitivo.fim)}
              </p>
            </div>
            <div className="rounded border border-hairline bg-surface-page px-2.5 py-2">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Período concessivo</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">
                {formatarDataBr(resposta.periodoConcessivo.inicio)} – {formatarDataBr(resposta.periodoConcessivo.fim)}
              </p>
            </div>
            <div className="rounded border border-hairline bg-surface-page px-2.5 py-2">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Retorno ao trabalho</p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">{formatarDataBr(resposta.retorno)}</p>
            </div>
            <div className="rounded border border-hairline bg-surface-page px-2.5 py-2">
              <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">Prazos</p>
              <p className="mt-0.5 text-[10.5px] font-medium text-foreground">
                Aviso até {formatarDataBr(resposta.prazoAviso)}
                <br />
                Pagamento até {formatarDataBr(resposta.prazoPagamento)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {resposta.verificacoes.map((v, i) => (
              <div key={i} className={`rounded border px-2.5 py-1.5 text-[11px] ${COR_NIVEL[v.nivel]}`}>
                <span className="font-semibold">
                  {ICONE_NIVEL[v.nivel]} {v.titulo}
                </span>
                <p className="mt-0.5 font-normal opacity-90">{v.mensagem}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-hairline p-3">
              <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                Valor estimado das férias
              </p>
              <dl className="space-y-1 text-[11px]">
                <LinhaValor label="Base diária" valor={resposta.valores.valorDiario} />
                <LinhaValor label={`Férias · ${resposta.valores.feriasDiasCorridos} dias corridos`} valor={resposta.valores.valorGozado} />
                <LinhaValor label="1/3 constitucional" valor={resposta.valores.tercoConstitucional} />
                {resposta.valores.diasAbono > 0 && (
                  <LinhaValor
                    label={`Abono pecuniário · ${resposta.valores.diasAbono} dias + 1/3`}
                    valor={resposta.valores.abono + resposta.valores.tercoAbono}
                  />
                )}
                <LinhaValor label="Bruto" valor={resposta.valores.bruto} destaque />
                <LinhaValor label="(–) INSS" valor={-resposta.valores.inss} />
                <LinhaValor label="(–) IRRF" valor={-resposta.valores.irrf} />
                <LinhaValor label="Líquido a receber" valor={resposta.valores.liquido} destaque />
              </dl>
            </div>

            <div className="flex flex-col gap-2">
              <div className="rounded border border-brand-dark-900 bg-brand-dark-900 p-3">
                <p className="text-[10px] font-semibold tracking-wide text-brand-white/70 uppercase">Custo total para a empresa</p>
                <p className="mt-1 text-lg font-bold text-brand-white">{formatarMoeda(resposta.valores.custoTotalEmpresa)}</p>
                <p className="mt-0.5 text-[10px] text-brand-white/60">
                  {resposta.valores.feriasDiasCorridos} dias de gozo{resposta.valores.diasAbono > 0 ? ` + ${resposta.valores.diasAbono} de abono` : ""} · bruto + FGTS + INSS patronal
                </p>
              </div>
              <div className="rounded border border-hairline p-3">
                <p className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">Total a creditar ao colaborador</p>
                <p className="mt-1 text-lg font-bold text-foreground">{formatarMoeda(resposta.valores.liquido)}</p>
                <p className="mt-0.5 text-[10px] text-foreground-muted">
                  líquido após INSS e IRRF · pagar até {formatarDataBr(resposta.prazoPagamento)}
                </p>
                <div className="mt-1.5 flex justify-between text-[10px] text-foreground-muted">
                  <span>Encargos e impostos da empresa</span>
                  <span className="font-semibold text-foreground">{formatarMoeda(resposta.valores.encargosEmpresa)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-foreground-muted">
                  <span>Retido do colaborador (INSS+IRRF)</span>
                  <span className="font-semibold text-foreground">{formatarMoeda(resposta.valores.inss + resposta.valores.irrf)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaValor({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex justify-between ${destaque ? "font-semibold text-foreground" : "text-foreground-muted"}`}>
      <dt>{label}</dt>
      <dd>{formatarMoeda(valor)}</dd>
    </div>
  );
}
