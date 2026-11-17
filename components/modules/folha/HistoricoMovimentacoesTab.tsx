"use client";

import { useEffect, useRef, useState } from "react";
import { abreviarNome, formatarDataBr } from "@/lib/format";
import { Card } from "@/components/shared/Card";
import { Modal } from "@/components/shared/Modal";
import type { MesTurnover } from "@/lib/folha/turnover";
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

const ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(2).replace(".", ",")}%`);

/** Doze quadrinhos (JAN–DEZ): mês, efetivo no fim do mês, entradas e saídas; o turnover do mês fica ao lado. */
function QuadradosTurnover({ meses, onAbrir }: { meses: MesTurnover[]; onAbrir: (mes: number) => void }) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-6">
      {meses.map((m) => (
        <button
          key={m.mes}
          type="button"
          disabled={m.futuro}
          onClick={() => onAbrir(m.mes)}
          title={m.futuro ? "Mês ainda não alcançado" : `Efetivo em ${formatarDataBr(m.dataFim)}${m.parcial ? " (mês em andamento)" : ""} — clique para detalhar`}
          className="group flex items-center gap-1.5 text-left disabled:cursor-default disabled:opacity-50"
        >
          <span className="w-[58px] shrink-0 rounded-md border border-hairline bg-background px-1 py-1 text-center transition-colors group-enabled:group-hover:border-brand-primary group-enabled:group-hover:bg-surface-page">
            <span className="block text-[8.5px] leading-none font-semibold tracking-wide text-foreground-muted">{ABREV[m.mes - 1]}</span>
            <span className="block text-[15px] leading-tight font-bold text-brand-primary-800">{m.futuro ? "—" : m.efetivoFinal}</span>
            <span className="block text-[8.5px] leading-tight font-medium">
              {m.futuro ? (
                <span className="text-foreground-muted">&nbsp;</span>
              ) : (
                <>
                  <span className="text-status-success">+{m.admissoes}</span> <span className="text-status-danger">−{m.desligamentos}</span>
                </>
              )}
            </span>
          </span>
          <span className="text-[10px] font-light text-foreground-muted">{m.futuro ? "" : pct(m.turnoverPct)}</span>
        </button>
      ))}
    </div>
  );
}

function ListaPessoas({ titulo, pessoas, cor }: { titulo: string; pessoas: { colaboradorId: number; nome: string; data: string }[]; cor: string }) {
  return (
    <div>
      <p className={`mb-1 text-[10px] font-semibold tracking-wide uppercase ${cor}`}>
        {titulo} ({pessoas.length})
      </p>
      {pessoas.length === 0 ? (
        <p className="text-[11px] font-light text-foreground-muted">Nenhum no mês.</p>
      ) : (
        <ul className="space-y-0.5">
          {pessoas.map((p) => (
            <li key={`${p.colaboradorId}-${p.data}`} className="flex justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-foreground">{p.nome}</span>
              <span className="shrink-0 text-foreground-muted">{formatarDataBr(p.data)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetalheTurnover({ m, ano, onFechar }: { m: MesTurnover | null; ano: number; onFechar: () => void }) {
  return (
    <Modal
      aberto={m !== null}
      onFechar={onFechar}
      eyebrow="Turnover"
      titulo={m ? `${MESES[m.mes - 1]} / ${ano}` : ""}
      subtitulo={m?.parcial ? `Mês em andamento: dados até ${formatarDataBr(m.dataFim)}` : undefined}
    >
      {m && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Efetivo inicial", String(m.efetivoInicial)],
              ["Admissões", String(m.admissoes)],
              ["Desligamentos", String(m.desligamentos)],
              ["Efetivo final", String(m.efetivoFinal)],
              ["Efetivo médio", m.efetivoMedio.toFixed(1).replace(".", ",")],
              ["Turnover do mês", pct(m.turnoverPct)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-md border border-hairline px-3 py-2">
                <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">{rotulo}</p>
                <p className="text-[18px] font-bold text-brand-primary-800">{valor}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-light text-foreground-muted">
            Turnover = [(admissões + desligamentos) ÷ 2] ÷ efetivo médio × 100, com efetivo médio = (inicial + final) ÷ 2.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ListaPessoas titulo="Admitidos" pessoas={m.admitidos} cor="text-status-success" />
            <ListaPessoas titulo="Desligados" pessoas={m.desligados} cor="text-status-danger" />
          </div>
        </div>
      )}
    </Modal>
  );
}

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
        <p className="text-[10px] leading-tight font-light text-foreground-muted">{l.cargo ?? "—"} · {l.departamento ?? "—"}</p>
      </td>
      <td className="w-[150px] px-2.5 py-1">
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
  const [mesAberto, setMesAberto] = useState<number | null>(null);

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
      <div className="flex flex-wrap items-stretch gap-3">
        <Card className="shrink-0 px-4 py-2">
          <p className="text-[9px] font-semibold tracking-wide text-foreground-muted uppercase">
            Colaboradores atuais
          </p>
          <p className="text-[24px] leading-tight font-bold text-brand-primary-800">{dados.ativosAtuais}</p>
          <p className="text-[10px] font-light text-foreground-muted">
            Em {dados.ano}: {totalEntradas} entrada(s) · {totalSaidas} saída(s)
          </p>
        </Card>
        <QuadradosTurnover meses={dados.turnover} onAbrir={setMesAberto} />
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
          <div className="grid divide-hairline/60 lg:grid-cols-2 lg:divide-x">
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
      <DetalheTurnover m={mesAberto ? (dados.turnover.find((t) => t.mes === mesAberto) ?? null) : null} ano={dados.ano} onFechar={() => setMesAberto(null)} />
    </div>
  );
}
