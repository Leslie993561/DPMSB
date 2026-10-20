"use client";

import { useEffect, useRef, useState } from "react";
import { abreviarNome, formatarDataBr } from "@/lib/format";
import { Card } from "@/components/shared/Card";
import { tiposDoMovimento } from "@/lib/folha/movimentacoesTipos";
import type { HistoricoMovimentacoes, MovimentoColaborador } from "@/lib/db/movimentacoes";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const INPUT_CLASS =
  "h-6 w-full rounded border border-hairline/70 bg-background px-1.5 text-[11px] font-light text-foreground placeholder:text-foreground-muted/50 disabled:border-transparent disabled:bg-transparent disabled:px-0";

/** Uma linha da planilha: tipo e justificativa gravam sozinhos (ao escolher / ao sair do campo). */
function LinhaMovimento({ l, podeEditar }: { l: MovimentoColaborador; podeEditar: boolean }) {
  const [tipo, setTipo] = useState(l.tipo ?? "");
  const [justificativa, setJustificativa] = useState(l.justificativa ?? "");
  const [estado, setEstado] = useState<"ocioso" | "salvando" | "salvo" | "erro">("ocioso");
  const [msgErro, setMsgErro] = useState<string | null>(null);
  const salvoRef = useRef({ tipo: l.tipo ?? "", justificativa: l.justificativa ?? "" });

  async function salvar(novoTipo: string, novaJustificativa: string) {
    if (novoTipo === salvoRef.current.tipo && novaJustificativa === salvoRef.current.justificativa) return;
    setEstado("salvando");
    setMsgErro(null);
    try {
      const res = await fetch("/api/folha-breakdown/movimentacoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaboradorId: l.colaboradorId,
          movimento: l.movimento,
          tipo: novoTipo || null,
          justificativa: novaJustificativa || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).erro ?? "Não foi possível salvar.");
      salvoRef.current = { tipo: novoTipo, justificativa: novaJustificativa };
      setEstado("salvo");
    } catch (e) {
      setMsgErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setEstado("erro");
    }
  }

  const opcoes = tiposDoMovimento(l.movimento);
  return (
    <tr className="border-t border-hairline/50 align-middle">
      <td className="w-[78px] px-2.5 py-1 text-[11px] whitespace-nowrap text-foreground-muted">{formatarDataBr(l.data)}</td>
      <td className="px-2.5 py-1">
        <p className="text-[11.5px] leading-tight font-medium text-foreground" title={l.nome}>
          {abreviarNome(l.nome)}
        </p>
        <p className="text-[10px] leading-tight font-light text-foreground-muted">{l.cargo ?? "—"}</p>
      </td>
      <td className="w-[190px] px-2.5 py-1">
        <select
          value={tipo}
          disabled={!podeEditar}
          onChange={(e) => {
            setTipo(e.target.value);
            void salvar(e.target.value, justificativa);
          }}
          className={INPUT_CLASS}
        >
          <option value="">{podeEditar ? "Selecione…" : "—"}</option>
          {opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2.5 py-1">
        <input
          value={justificativa}
          disabled={!podeEditar}
          maxLength={500}
          placeholder={podeEditar ? "Justificativa" : "—"}
          onChange={(e) => setJustificativa(e.target.value)}
          onBlur={() => void salvar(tipo, justificativa.trim())}
          className={INPUT_CLASS}
        />
        {estado === "erro" && <p className="text-[10px] leading-tight text-status-danger">{msgErro}</p>}
      </td>
      <td className="w-5 pr-2 text-center text-[11px] leading-none">
        {estado === "salvando" && <span className="text-foreground-muted">…</span>}
        {estado === "salvo" && (
          <span title="Salvo" className="text-status-success">
            ✓
          </span>
        )}
      </td>
    </tr>
  );
}

function TabelaMovimento({
  linhas,
  vazio,
  rotuloData,
  podeEditar,
}: {
  linhas: MovimentoColaborador[];
  vazio: string;
  rotuloData: string;
  podeEditar: boolean;
}) {
  if (linhas.length === 0) {
    return <p className="px-2.5 py-1.5 text-[11px] font-light text-foreground-muted">{vazio}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-hairline/70 text-left text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">
            <th className="px-2.5 py-1">{rotuloData}</th>
            <th className="px-2.5 py-1">Colaborador</th>
            <th className="px-2.5 py-1">Tipo</th>
            <th className="px-2.5 py-1">Justificativa</th>
            <th className="w-5" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <LinhaMovimento key={`${l.movimento}-${l.colaboradorId}-${l.data}`} l={l} podeEditar={podeEditar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quem entrou (admissão) e quem saiu (desligamento) em cada mês do ano, lado a lado como planilha. */
export function HistoricoMovimentacoesTab() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dados, setDados] = useState<HistoricoMovimentacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/folha-breakdown/movimentacoes?ano=${ano}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Não foi possível carregar o histórico.");
        return d as HistoricoMovimentacoes;
      })
      .then((d) => {
        if (ativo) {
          setDados(d);
          setErro(null);
        }
      })
      .catch((e: Error) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [ano]);

  if (erro) {
    return <p className="rounded-md bg-status-danger/10 px-3 py-2 text-[12px] text-status-danger">{erro}</p>;
  }
  if (!dados || dados.ano !== ano) {
    return <p className="py-10 text-center text-[13px] text-foreground-muted">Carregando…</p>;
  }

  const totalEntradas = dados.meses.reduce((acc, m) => acc + m.entradas.length, 0);
  const totalSaidas = dados.meses.reduce((acc, m) => acc + m.saidas.length, 0);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="px-4 py-2">
          <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">
            Colaboradores atuais
          </p>
          <p className="text-[24px] leading-tight font-bold text-brand-primary-800">{dados.ativosAtuais}</p>
          <p className="text-[10px] font-light text-foreground-muted">
            Em {dados.ano}: {totalEntradas} entrada(s) · {totalSaidas} saída(s)
          </p>
        </Card>
        <label className="flex items-center gap-2 text-[12px] text-foreground-muted">
          Ano
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded border border-hairline bg-background px-2 py-1 text-[13px] text-foreground"
          >
            {dados.anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dados.meses.map((m) => (
        <Card key={m.mes} className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-hairline/70 bg-surface-page px-2.5 py-1">
            <p className="text-[12px] font-semibold text-brand-primary-800">
              {MESES[m.mes - 1]} <span className="font-normal text-foreground-muted">/ {dados.ano}</span>
            </p>
            <p className="text-[10px] text-foreground-muted">
              <span className="text-status-success">{m.entradas.length} entrada(s)</span> ·{" "}
              <span className="text-status-danger">{m.saidas.length} saída(s)</span>
            </p>
          </div>
          <div className="divide-y divide-hairline/60">
            <div>
              <p className="border-b border-hairline/50 px-2.5 py-1 text-[9px] font-semibold tracking-wide text-status-success uppercase">
                Entradas
              </p>
              <TabelaMovimento
                linhas={m.entradas}
                vazio="Nenhuma admissão neste mês."
                rotuloData="Admissão"
                podeEditar={dados.podeEditar}
              />
            </div>
            <div>
              <p className="border-b border-hairline/50 px-2.5 py-1 text-[9px] font-semibold tracking-wide text-status-danger uppercase">
                Saídas
              </p>
              <TabelaMovimento
                linhas={m.saidas}
                vazio="Nenhum desligamento neste mês."
                rotuloData="Desligamento"
                podeEditar={dados.podeEditar}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
