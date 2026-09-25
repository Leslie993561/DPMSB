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
  const [mes, setMes] = useState(new Date().getMonth() + 1);
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

  async function carregarAno(novoAno: number) {
    setAno(novoAno);
    const res = await fetch(`/api/dho/eventos?ano=${novoAno}`);
    const dados = await res.json();
    setEventos(dados.eventos ?? []);
  }

  function mudarMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno--;
      void carregarAno(novoAno);
    } else if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
      void carregarAno(novoAno);
    }
    setMes(novoMes);
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

  const semanas = gradeDoMes(ano, mes);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="rounded border border-hairline px-2 py-1 text-[12px] text-foreground-muted hover:bg-surface-page"
          >
            ‹
          </button>
          <p className="text-[13.5px] font-semibold text-foreground">
            {MESES_COMPLETOS[mes - 1]} de {ano}
          </p>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="rounded border border-hairline px-2 py-1 text-[12px] text-foreground-muted hover:bg-surface-page"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-semibold text-foreground-muted">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="mt-1 space-y-1">
          {semanas.map((semana, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {semana.map((dia, j) => {
                const doDia = dia ? (eventosPorDia.get(dia) ?? []) : [];
                const selecionado = dia === diaSelecionado;
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={!dia}
                    onClick={() => {
                      setDiaSelecionado(dia === diaSelecionado ? null : dia);
                      setNovoTitulo("");
                    }}
                    className={cn(
                      "flex h-14 flex-col items-center justify-start rounded-md border p-1 text-[11px]",
                      !dia && "border-transparent",
                      dia && !selecionado && "border-hairline hover:border-brand-primary",
                      selecionado && "border-brand-primary bg-brand-primary-050",
                    )}
                  >
                    {dia && <span className="text-foreground-muted">{Number(dia.slice(8, 10))}</span>}
                    {doDia.length > 0 && (
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-accent" title={doDia.map((e) => e.titulo).join(", ")} />
                    )}
                  </button>
                );
              })}
            </div>
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
