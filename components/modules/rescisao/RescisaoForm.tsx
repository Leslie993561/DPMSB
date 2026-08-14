"use client";

import { useState } from "react";
import type { CalculoResult, DetalheRescisao, TipoRescisao } from "@/lib/calc";
import { MemoriaCalculoTable } from "@/components/shared/MemoriaCalculoTable";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { LegalBasisList } from "@/components/shared/LegalBasisList";

const TIPOS: { value: TipoRescisao; label: string }[] = [
  { value: "sem_justa_causa", label: "Dispensa sem justa causa" },
  { value: "pedido_demissao", label: "Pedido de demissão" },
  { value: "justa_causa", label: "Dispensa por justa causa" },
  { value: "acordo_484a", label: "Acordo (Art. 484-A CLT)" },
  { value: "termino_contrato_determinado", label: "Término de contrato determinado" },
];

const INPUT_CLASS =
  "w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground dark:border-brand-neutral/30";

export function RescisaoForm() {
  const [tipo, setTipo] = useState<TipoRescisao>("sem_justa_causa");
  const [salarioBase, setSalarioBase] = useState("3000");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [dataDesligamento, setDataDesligamento] = useState("");
  const [diasTrabalhadosNoMes, setDiasTrabalhadosNoMes] = useState("30");
  const [avisoPrevioIndenizado, setAvisoPrevioIndenizado] = useState(true);
  const [feriasVencidasDias, setFeriasVencidasDias] = useState("0");
  const [mesesTrabalhadosNoAno, setMesesTrabalhadosNoAno] = useState("6");
  const [decimoTerceiroAdiantado, setDecimoTerceiroAdiantado] = useState("0");
  const [dependentes, setDependentes] = useState("0");
  const [saldoFgtsDepositado, setSaldoFgtsDepositado] = useState("");

  const [resposta, setResposta] = useState<{ resultado: CalculoResult<DetalheRescisao> } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResposta(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/calc/rescisao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          salarioBase: Number(salarioBase),
          dataAdmissao,
          dataDesligamento,
          diasTrabalhadosNoMes: Number(diasTrabalhadosNoMes),
          avisoPrevioIndenizado,
          feriasVencidasDias: Number(feriasVencidasDias),
          mesesTrabalhadosNoAnoParaDecimoTerceiro: Number(mesesTrabalhadosNoAno),
          decimoTerceiroAdiantado: Number(decimoTerceiroAdiantado),
          dependentes: Number(dependentes),
          saldoFgtsDepositado: saldoFgtsDepositado === "" ? undefined : Number(saldoFgtsDepositado),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao calcular rescisão.");
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
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-brand-surface bg-background p-5 sm:grid-cols-2 dark:border-brand-neutral/30"
      >
        <label className="flex flex-col gap-1 text-sm text-foreground-muted sm:col-span-2">
          Tipo de rescisão
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoRescisao)}
            className={INPUT_CLASS}
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <Campo label="Salário base (R$)">
          <input type="number" min={0} step="0.01" required value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Dependentes (IRRF)">
          <input type="number" min={0} value={dependentes} onChange={(e) => setDependentes(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Data de admissão">
          <input type="date" required value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Data de desligamento">
          <input type="date" required value={dataDesligamento} onChange={(e) => setDataDesligamento(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Dias trabalhados no mês (saldo de salário)">
          <input type="number" min={0} max={31} required value={diasTrabalhadosNoMes} onChange={(e) => setDiasTrabalhadosNoMes(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Meses trabalhados no ano (13º/férias proporcionais)">
          <input type="number" min={0} max={12} required value={mesesTrabalhadosNoAno} onChange={(e) => setMesesTrabalhadosNoAno(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Dias de férias vencidas (0 se não houver)">
          <input type="number" min={0} max={30} value={feriasVencidasDias} onChange={(e) => setFeriasVencidasDias(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="13º já adiantado no ano (R$)">
          <input type="number" min={0} step="0.01" value={decimoTerceiroAdiantado} onChange={(e) => setDecimoTerceiroAdiantado(e.target.value)} className={INPUT_CLASS} />
        </Campo>
        <Campo label="Saldo de FGTS depositado (R$, opcional — deixe em branco para estimar)">
          <input type="number" min={0} step="0.01" value={saldoFgtsDepositado} onChange={(e) => setSaldoFgtsDepositado(e.target.value)} className={INPUT_CLASS} />
        </Campo>

        <label className="flex items-center gap-2 text-sm text-foreground-muted sm:col-span-2">
          <input
            type="checkbox"
            className="accent-brand-primary"
            checked={avisoPrevioIndenizado}
            onChange={(e) => setAvisoPrevioIndenizado(e.target.checked)}
          />
          Aviso prévio indenizado (não cumprido em serviço) — aplicável a dispensa sem justa causa e acordo Art. 484-A
        </label>

        <button
          type="submit"
          disabled={carregando}
          className="sm:col-span-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {carregando ? "Calculando..." : "Calcular rescisão"}
        </button>
      </form>

      {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

      {resposta && (
        <div className="space-y-4">
          {resposta.resultado.detalhe.fgtsEstimado && (
            <RiskCallout nivel="atencao">
              O saldo de FGTS não foi informado — a base da multa foi ESTIMADA e não reflete correção
              monetária nem depósitos reais. Confira o extrato do FGTS Digital antes de pagar.
            </RiskCallout>
          )}

          {resposta.resultado.detalhe.observacoes.map((obs, i) => (
            <RiskCallout key={i} nivel="info">
              {obs}
            </RiskCallout>
          ))}

          <MemoriaCalculoTable
            passos={resposta.resultado.memoriaCalculo}
            titulo="Memória de cálculo — Rescisão"
          />

          <LegalBasisList
            itens={[
              "Art. 477 CLT — prazo e verbas rescisórias.",
              "Lei 12.506/2011 — aviso prévio proporcional ao tempo de serviço.",
              "Art. 484-A CLT — rescisão por acordo (metade do aviso e da multa de FGTS).",
              "Art. 7º, I CF/88 e Art. 18, §1º da Lei 8.036/1990 — multa de 40% do FGTS.",
            ]}
            fonte={resposta.resultado.tabelaLegalVersao}
          />
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-foreground-muted">
      {label}
      {children}
    </label>
  );
}
