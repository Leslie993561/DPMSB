"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/shared/Card";
import { formatarDataBr } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { EventoCalendario } from "@/lib/db/dho";

const MESES_COMPLETOS = [
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

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Semanas (domingo a sábado) do mês, em datas AAAA-MM-DD — null nas células fora do mês. */
function gradeDoMes(ano: number, mes: number): (string | null)[][] {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const offset = new Date(ano, mes - 1, 1).getDay();
  const celulas: (string | null)[] = Array(offset).fill(null);
  for (let dia = 1; dia <= ultimoDia; dia++) {
    celulas.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  while (celulas.length % 7 !== 0) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

export function EndomarketingDashboardClient({
  anoInicial,
  eventosIniciais,
}: {
  anoInicial: number;
  eventosIniciais: EventoCalendario[];
}) {
  const [ano, setAno] = useState(anoInicial);
  const [eventos, setEventos] = useState(eventosIniciais);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const e of eventos) {
      const lista = mapa.get(e.data) ?? [];
      lista.push(e);
      mapa.set(e.data, lista);
    }
    return mapa;
  }, [eventos]);

  const proximosEventos = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return [...eventos].filter((e) => e.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  }, [eventos]);

  async function mudarAno(novoAno: number) {
    setAno(novoAno);
    setDiaSelecionado(null);
    const res = await fetch(`/api/dho/eventos?ano=${novoAno}`);
    const dados = await res.json();
    setEventos(dados.eventos ?? []);
  }

  async function adicionarEvento() {
    if (!diaSelecionado || !novoTitulo.trim()) return;
    setSalvando(true);
    try {
      const res = await fetch("/api/dho/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: diaSelecionado, titulo: novoTitulo.trim() }),
      });
      const dados = await res.json();
      if (res.ok) {
        setEventos((atual) => [...atual, dados.evento]);
        setNovoTitulo("");
      }
    } finally {
      setSalvando(false);
    }
  }

  async function excluirEvento(id: number) {
    setEventos((atual) => atual.filter((e) => e.id !== id));
    await fetch(`/api/dho/eventos/${id}`, { method: "DELETE" });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => mudarAno(ano - 1)}
            className="rounded border border-hairline px-2 py-1 text-[12px] text-foreground-muted hover:bg-surface-page"
          >
            ‹
          </button>
          <p className="text-[13.5px] font-semibold text-foreground">{ano}</p>
          <button
            type="button"
            onClick={() => mudarAno(ano + 1)}
            className="rounded border border-hairline px-2 py-1 text-[12px] text-foreground-muted hover:bg-surface-page"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {MESES_COMPLETOS.map((nomeMes, i) => (
            <MesCalendario
              key={i}
              ano={ano}
              mes={i + 1}
              nomeMes={nomeMes}
              eventosPorDia={eventosPorDia}
              diaSelecionado={diaSelecionado}
              onSelecionarDia={(dia) => {
                setDiaSelecionado(dia === diaSelecionado ? null : dia);
                setNovoTitulo("");
              }}
            />
          ))}
        </div>

        {diaSelecionado && (
          <div className="mt-3 rounded-md border border-hairline bg-surface-page p-3">
            <p className="text-[11px] font-semibold text-foreground">{formatarDataBr(diaSelecionado)}</p>
            <div className="mt-2 space-y-1.5">
              {(eventosPorDia.get(diaSelecionado) ?? []).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded border border-hairline bg-background px-2 py-1">
                  <span className="text-[11.5px] text-foreground">{e.titulo}</span>
                  <button type="button" onClick={() => excluirEvento(e.id)} className="text-[11px] text-status-danger hover:opacity-70">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Ex.: Dia das Mães, campanha de vacinação..."
                className="flex-1 rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12.5px] text-foreground"
              />
              <button
                type="button"
                disabled={salvando || !novoTitulo.trim()}
                onClick={adicionarEvento}
                className="rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-[11px] font-bold tracking-wide text-foreground-muted uppercase">Próximos eventos</p>
        <div className="mt-2 space-y-2">
          {proximosEventos.length === 0 ? (
            <p className="text-[12px] text-foreground-muted">Nenhum evento cadastrado a partir de hoje.</p>
          ) : (
            proximosEventos.map((e) => (
              <div key={e.id} className="rounded border border-hairline px-2.5 py-1.5">
                <p className="text-[10.5px] font-semibold text-brand-primary-800">{formatarDataBr(e.data)}</p>
                <p className="text-[12px] text-foreground">{e.titulo}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

/** Um mês do ano-calendário inteiro — clicável por dia (com ponto nos dias com evento). */
function MesCalendario({
  ano,
  mes,
  nomeMes,
  eventosPorDia,
  diaSelecionado,
  onSelecionarDia,
}: {
  ano: number;
  mes: number;
  nomeMes: string;
  eventosPorDia: Map<string, EventoCalendario[]>;
  diaSelecionado: string | null;
  onSelecionarDia: (dia: string) => void;
}) {
  const semanas = gradeDoMes(ano, mes);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-md border border-hairline p-2">
      <p className="mb-1.5 text-[11.5px] font-semibold text-foreground">{nomeMes}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[8.5px] font-semibold text-foreground-muted">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="mt-0.5 space-y-0.5">
        {semanas.map((semana, i) => (
          <div key={i} className="grid grid-cols-7 gap-0.5">
            {semana.map((dia, j) => {
              const doDia = dia ? (eventosPorDia.get(dia) ?? []) : [];
              const selecionado = dia === diaSelecionado;
              return (
                <button
                  key={j}
                  type="button"
                  disabled={!dia}
                  onClick={() => dia && onSelecionarDia(dia)}
                  className={cn(
                    "flex h-6 flex-col items-center justify-center rounded text-[9.5px]",
                    !dia && "cursor-default",
                    dia && dia === hoje && "font-bold text-brand-primary",
                    dia && !selecionado && "text-foreground-muted hover:bg-surface-page",
                    selecionado && "bg-brand-primary-100 text-brand-primary-800",
                  )}
                >
                  {dia ? Number(dia.slice(8, 10)) : ""}
                  {doDia.length > 0 && <span className="-mt-0.5 h-1 w-1 rounded-full bg-brand-accent" title={doDia.map((e) => e.titulo).join(", ")} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
