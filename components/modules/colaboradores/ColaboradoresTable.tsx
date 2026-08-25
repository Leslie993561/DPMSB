"use client";

import React, { useMemo, useState } from "react";
import type { Colaborador, Vinculo } from "@/lib/db/colaboradores";
import { Badge, type CorBadge } from "@/components/shared/Badge";
import { formatarDataBr } from "@/lib/format";
import { cn } from "@/lib/cn";

const COR_VINCULO: Record<Vinculo, CorBadge> = {
  CLT: "azul",
  "CLT-bio": "azul",
  PJ: "verde",
  EST: "amarelo",
  JÁ: "neutro",
};

/** Tempo de casa em anos (fracionário), para exibir e para comparar em filtros de faixa. */
function tempoDeCasaAnos(dataAdmissao: string): number {
  return Math.max(0, (Date.now() - new Date(dataAdmissao).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function formatarAnos(anos: number): string {
  return `${anos.toFixed(1).replace(".", ",")} anos`;
}

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

/**
 * Chave de ordenação por aniversário: MÊS e depois dia, ignorando o ano.
 * O ano diz a idade, não quando comemorar — ordenar por ele espalharia os
 * aniversários de janeiro ao longo de toda a lista. Sem data de nascimento a
 * pessoa vai para o fim, em vez de fingir um mês qualquer.
 */
function chaveAniversario(dataNascimento: string | null): number {
  if (!dataNascimento || dataNascimento.length < 10) return 9999;
  const mes = Number(dataNascimento.slice(5, 7));
  const dia = Number(dataNascimento.slice(8, 10));
  if (!mes || !dia) return 9999;
  return mes * 100 + dia;
}

function mesDoAniversario(dataNascimento: string | null): string | null {
  const chave = chaveAniversario(dataNascimento);
  return chave === 9999 ? null : MESES[Math.floor(chave / 100) - 1];
}

/** "10/08" — o dia e o mês, que é o que interessa em um calendário de aniversários. */
function diaEMes(dataNascimento: string | null): string {
  if (!dataNascimento || dataNascimento.length < 10) return "—";
  return `${dataNascimento.slice(8, 10)}/${dataNascimento.slice(5, 7)}`;
}

interface FiltrosColuna {
  vinculo: string;
  texto: string;
  lider: string;
  admissaoMin: string;
  admissaoMax: string;
  tempoMin: string;
  tempoMax: string;
}

const FILTROS_VAZIOS: FiltrosColuna = {
  vinculo: "",
  texto: "",
  lider: "",
  admissaoMin: "",
  admissaoMax: "",
  tempoMin: "",
  tempoMax: "",
};

/** Sem borda/sombra própria — nasce dentro do card composto (cabeçalho + filtros + tabela) da página. */
export function ColaboradoresTable({
  colaboradores,
  onEditar,
}: {
  colaboradores: Colaborador[];
  onEditar: (colaborador: Colaborador) => void;
}) {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const [filtros, setFiltros] = useState<FiltrosColuna>(FILTROS_VAZIOS);
  const [colunaAberta, setColunaAberta] = useState<"vinculo" | "texto" | "lider" | "admissao" | "tempo" | null>(null);
  /** Ordenação por aniversário: desligada por padrão, para a lista continuar na ordem do cadastro. */
  const [porAniversario, setPorAniversario] = useState(false);

  function definir<K extends keyof FiltrosColuna>(campo: K, valor: FiltrosColuna[K]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  const vinculosDisponiveis = useMemo(
    () => Array.from(new Set(colaboradores.map((c) => c.vinculo).filter((v): v is Vinculo => Boolean(v)))).sort(),
    [colaboradores],
  );

  const linhas = useMemo(() => {
    const textoNorm = filtros.texto.trim().toLowerCase();
    const liderNorm = filtros.lider.trim().toLowerCase();
    const min = filtros.tempoMin ? Number(filtros.tempoMin) : null;
    const max = filtros.tempoMax ? Number(filtros.tempoMax) : null;

    return colaboradores.filter((c) => {
      if (filtros.vinculo && c.vinculo !== filtros.vinculo) return false;
      if (textoNorm) {
        const alvo = `${c.nome} ${c.cargo ?? ""} ${c.departamento ?? ""}`.toLowerCase();
        if (!alvo.includes(textoNorm)) return false;
      }
      if (liderNorm) {
        const nomeLider = (c.gestorId ? porId.get(c.gestorId)?.nome : c.liderDiretoNome) ?? "";
        if (!nomeLider.toLowerCase().includes(liderNorm)) return false;
      }
      if (filtros.admissaoMin && c.dataAdmissao < filtros.admissaoMin) return false;
      if (filtros.admissaoMax && c.dataAdmissao > filtros.admissaoMax) return false;
      const anos = tempoDeCasaAnos(c.dataAdmissao);
      if (min !== null && Number.isFinite(min) && anos < min) return false;
      if (max !== null && Number.isFinite(max) && anos > max) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradores, filtros]);

  const ordenadas = useMemo(() => {
    if (!porAniversario) return linhas;
    return [...linhas].sort((a, z) => {
      const diff = chaveAniversario(a.dataNascimento) - chaveAniversario(z.dataNascimento);
      return diff !== 0 ? diff : a.nome.localeCompare(z.nome, "pt-BR");
    });
  }, [linhas, porAniversario]);

  const algumFiltroAtivo = Object.values(filtros).some(Boolean);

  if (colaboradores.length === 0) {
    return <p className="p-5 text-[12.5px] text-foreground-muted">Nenhum colaborador encontrado.</p>;
  }

  return (
    <div className="max-h-[calc(100vh-220px)] overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[860px] text-[11.5px]">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
            <CabecalhoFiltravel
              label="Vínculo"
              aberta={colunaAberta === "vinculo"}
              ativo={Boolean(filtros.vinculo)}
              onToggle={() => setColunaAberta(colunaAberta === "vinculo" ? null : "vinculo")}
              onFechar={() => setColunaAberta(null)}
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    definir("vinculo", "");
                    setColunaAberta(null);
                  }}
                  className={!filtros.vinculo ? "font-semibold text-brand-primary-800" : "text-foreground-muted"}
                >
                  Todos
                </button>
                {vinculosDisponiveis.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      definir("vinculo", v);
                      setColunaAberta(null);
                    }}
                    className={filtros.vinculo === v ? "font-semibold text-brand-primary-800" : "text-foreground-muted"}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </CabecalhoFiltravel>

            <CabecalhoFiltravel
              label="Colaborador / Cargo · Setor"
              aberta={colunaAberta === "texto"}
              ativo={Boolean(filtros.texto)}
              onToggle={() => setColunaAberta(colunaAberta === "texto" ? null : "texto")}
              onFechar={() => setColunaAberta(null)}
            >
              <CampoTexto
                valor={filtros.texto}
                onChange={(v) => definir("texto", v)}
                placeholder="Buscar nome, cargo ou setor"
              />
            </CabecalhoFiltravel>

            <CabecalhoFiltravel
              label="Líder direto"
              aberta={colunaAberta === "lider"}
              ativo={Boolean(filtros.lider)}
              onToggle={() => setColunaAberta(colunaAberta === "lider" ? null : "lider")}
              onFechar={() => setColunaAberta(null)}
            >
              <CampoTexto valor={filtros.lider} onChange={(v) => definir("lider", v)} placeholder="Buscar líder" />
            </CabecalhoFiltravel>

            <CabecalhoFiltravel
              label="Admissão"
              aberta={colunaAberta === "admissao"}
              ativo={Boolean(filtros.admissaoMin || filtros.admissaoMax)}
              onToggle={() => setColunaAberta(colunaAberta === "admissao" ? null : "admissao")}
              onFechar={() => setColunaAberta(null)}
            >
              <div className="flex flex-col gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] font-normal text-foreground-muted normal-case">
                  De
                  <input
                    type="date"
                    value={filtros.admissaoMin}
                    onChange={(e) => definir("admissaoMin", e.target.value)}
                    className="w-36 rounded border border-hairline bg-background px-2 py-1 text-[11px] text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-normal text-foreground-muted normal-case">
                  Até
                  <input
                    type="date"
                    value={filtros.admissaoMax}
                    onChange={(e) => definir("admissaoMax", e.target.value)}
                    className="w-36 rounded border border-hairline bg-background px-2 py-1 text-[11px] text-foreground"
                  />
                </label>
              </div>
            </CabecalhoFiltravel>

            <CabecalhoFiltravel
              label="Tempo"
              aberta={colunaAberta === "tempo"}
              ativo={Boolean(filtros.tempoMin || filtros.tempoMax)}
              onToggle={() => setColunaAberta(colunaAberta === "tempo" ? null : "tempo")}
              onFechar={() => setColunaAberta(null)}
            >
              <div className="flex flex-col gap-1.5">
                <label className="flex flex-col gap-0.5 text-[10px] font-normal text-foreground-muted normal-case">
                  De (anos)
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={filtros.tempoMin}
                    onChange={(e) => definir("tempoMin", e.target.value)}
                    className="w-24 rounded border border-hairline bg-background px-2 py-1 text-[11px] text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-normal text-foreground-muted normal-case">
                  Até (anos)
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={filtros.tempoMax}
                    onChange={(e) => definir("tempoMax", e.target.value)}
                    className="w-24 rounded border border-hairline bg-background px-2 py-1 text-[11px] text-foreground"
                  />
                </label>
              </div>
            </CabecalhoFiltravel>

            {/* ANI = aniversário. Clicar agrupa a lista por mês, com separador
                de mês e a data de cada um; clicar de novo volta ao normal. */}
            <th className="px-3 py-1">
              <button
                type="button"
                onClick={() => setPorAniversario((v) => !v)}
                title={
                  porAniversario
                    ? "Voltar à ordem normal"
                    : "Ordenar todos por mês de aniversário e mostrar as datas"
                }
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
                  porAniversario
                    ? "bg-brand-primary text-brand-white"
                    : "text-foreground-muted hover:bg-brand-primary-050 hover:text-foreground",
                )}
              >
                <span aria-hidden>🎂</span> ANI
              </button>
            </th>

            <th className="w-9 px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {algumFiltroAtivo && (
            <tr>
              <td colSpan={7} className="border-b border-hairline bg-brand-primary-050 px-3 py-1 text-[10.5px] text-brand-primary-800">
                {linhas.length} de {colaboradores.length} colaborador(es) ·{" "}
                <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className="font-semibold underline">
                  limpar filtros
                </button>
              </td>
            </tr>
          )}
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-foreground-muted">
                Nenhum colaborador corresponde aos filtros.
              </td>
            </tr>
          ) : (
            ordenadas.map((c, i) => {
              const mes = mesDoAniversario(c.dataNascimento);
              // Separador só na ordenação por aniversário, e só quando o mês vira.
              const abreMes = porAniversario && mes !== mesDoAniversario(ordenadas[i - 1]?.dataNascimento ?? null);
              return (
                <React.Fragment key={c.id}>
                  {abreMes && (
                    <tr className="bg-brand-primary-050">
                      <td
                        colSpan={7}
                        className="px-3 py-1 text-[10px] font-bold tracking-wide text-brand-primary-800 uppercase"
                      >
                        {mes ?? "Sem data de nascimento"}
                      </td>
                    </tr>
                  )}
              <tr className="border-b border-hairline/70 last:border-0 hover:bg-surface-page/60">
                <td className="px-3 py-1">{c.vinculo ? <Badge cor={COR_VINCULO[c.vinculo]}>{c.vinculo}</Badge> : "—"}</td>
                <td className="px-3 py-1">
                  <div className="font-medium text-foreground uppercase">{c.nome}</div>
                  <div className="text-[10px] text-foreground-muted">
                    {c.cargo ?? "—"} · {c.departamento ?? "—"}
                  </div>
                </td>
                <td className="px-3 py-1 font-normal text-brand-primary-800 uppercase">
                  {c.gestorId ? (porId.get(c.gestorId)?.nome ?? "—") : (c.liderDiretoNome ?? "—")}
                </td>
                <td className="px-3 py-1 text-foreground-muted">{formatarDataBr(c.dataAdmissao)}</td>
                <td className="px-3 py-1 text-foreground-muted">{formatarAnos(tempoDeCasaAnos(c.dataAdmissao))}</td>
                <td className="px-3 py-1">
                  {c.dataNascimento ? (
                    <>
                      <span className="font-medium text-foreground">{diaEMes(c.dataNascimento)}</span>
                      <span className="ml-1 text-[10px] text-foreground-muted">{c.dataNascimento.slice(0, 4)}</span>
                    </>
                  ) : (
                    <span className="text-foreground-muted/50">—</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => onEditar(c)}
                    aria-label={`Editar ${c.nome}`}
                    title="Editar"
                    className="rounded px-1.5 py-0.5 text-foreground-muted hover:bg-brand-surface hover:text-foreground"
                  >
                    ⋮
                  </button>
                </td>
              </tr>
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function CabecalhoFiltravel({
  label,
  aberta,
  ativo,
  onToggle,
  onFechar,
  children,
}: {
  label: string;
  aberta: boolean;
  ativo: boolean;
  onToggle: () => void;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <th className="relative px-3 py-1">
      <button type="button" onClick={onToggle} className="flex items-center gap-1 hover:text-foreground">
        <span className="truncate">{label}</span>
        <span className={ativo ? "text-brand-primary" : "text-foreground-muted/70"}>▾</span>
      </button>
      {aberta && (
        <>
          <div className="fixed inset-0 z-20" onClick={onFechar} />
          <div
            className="absolute top-full left-0 z-30 mt-1 w-52 rounded-md border border-hairline bg-background p-2.5 text-[11px] font-normal tracking-normal text-foreground normal-case shadow-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </>
      )}
    </th>
  );
}

function CampoTexto({
  valor,
  onChange,
  placeholder,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      autoFocus
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-44 rounded border border-hairline bg-background px-2 py-1 text-[11px] text-foreground"
    />
  );
}
