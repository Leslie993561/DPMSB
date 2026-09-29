"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/shared/Card";
import { formatarDataBr, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CategoriaDataComemorativa, DataComemorativa, EventoCalendario, LinhaOrcamentoMes } from "@/lib/db/dho";

export type AbaEndomarketing = "calendario" | "lancamentos" | "orcamento";

const ABAS: { id: AbaEndomarketing; label: string }[] = [
  { id: "calendario", label: "Calendário" },
  { id: "lancamentos", label: "Lançamentos mensais" },
  { id: "orcamento", label: "Orçamento" },
];

/** Cor de cada categoria de data comemorativa (pílula de fundo + texto) + a cor dos dias com ação (Lançamentos mensais). */
const CATEGORIAS_DATA: { id: CategoriaDataComemorativa; label: string; dot: string; bg: string; texto: string }[] = [
  { id: "nacional", label: "Feriado nacional", dot: "bg-blue-500", bg: "bg-blue-100", texto: "text-blue-800" },
  { id: "regional", label: "Feriado regional/municipal", dot: "bg-gray-400", bg: "bg-gray-200", texto: "text-gray-700" },
  { id: "ponte", label: "Ponte de feriado", dot: "bg-orange-500", bg: "bg-orange-100", texto: "text-orange-800" },
];
const COR_ACAO_DOT = "bg-brand-accent";
const COR_ACAO_BG = "bg-brand-accent";
const COR_ACAO_TEXTO = "text-brand-primary-900";

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
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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

interface ItemForm {
  nome: string;
  quantidade: string;
  valorUnitario: string;
}

const ITEM_VAZIO: ItemForm = { nome: "", quantidade: "1", valorUnitario: "0" };

export function EndomarketingDashboardClient({
  aba,
  anoInicial,
  eventosIniciais,
  orcamentoInicial,
  datasComemorativasIniciais,
}: {
  aba: AbaEndomarketing;
  anoInicial: number;
  eventosIniciais: EventoCalendario[];
  orcamentoInicial: LinhaOrcamentoMes[];
  datasComemorativasIniciais: DataComemorativa[];
}) {
  const router = useRouter();
  const [ano, setAno] = useState(anoInicial);
  const [eventos, setEventos] = useState(eventosIniciais);
  const [orcamento, setOrcamento] = useState(orcamentoInicial);
  const [datasComemorativas, setDatasComemorativas] = useState(datasComemorativasIniciais);
  const [novaDataData, setNovaDataData] = useState("");
  const [novaDataNome, setNovaDataNome] = useState("");
  const [novaDataCategoria, setNovaDataCategoria] = useState<CategoriaDataComemorativa>("nacional");
  const [salvandoData, setSalvandoData] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formData, setFormData] = useState("");
  const [formDataFim, setFormDataFim] = useState("");
  const [formTitulo, setFormTitulo] = useState("");
  const [formObjetivo, setFormObjetivo] = useState("");
  const [formPublicoAlvo, setFormPublicoAlvo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formItens, setFormItens] = useState<ItemForm[]>([{ ...ITEM_VAZIO }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const e of eventos) {
      const lista = mapa.get(e.data) ?? [];
      lista.push(e);
      mapa.set(e.data, lista);
    }
    return mapa;
  }, [eventos]);

  const eventosOrdenados = useMemo(() => [...eventos].sort((a, b) => a.data.localeCompare(b.data)), [eventos]);

  // Uma ação pode durar vários dias (data → dataFim) — pra desenhar como uma
  // barra emendada no Calendário (não um ponto solto por dia), cada dia do
  // intervalo precisa saber se é o início, o fim, ou o meio da barra, pra
  // arredondar só as pontas.
  const acaoRangePorDia = useMemo(() => {
    const mapa = new Map<string, { titulo: string; inicio: boolean; fim: boolean }>();
    for (const e of eventos) {
      const fim = e.dataFim ?? e.data;
      const cursor = new Date(`${e.data}T00:00:00`);
      const dataFim = new Date(`${fim}T00:00:00`);
      while (cursor <= dataFim) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!mapa.has(iso)) mapa.set(iso, { titulo: e.titulo, inicio: iso === e.data, fim: iso === fim });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return mapa;
  }, [eventos]);

  const datasComemorativasPorDia = useMemo(() => {
    const mapa = new Map<string, DataComemorativa[]>();
    for (const d of datasComemorativas) {
      const lista = mapa.get(d.data) ?? [];
      lista.push(d);
      mapa.set(d.data, lista);
    }
    return mapa;
  }, [datasComemorativas]);

  const datasComemorativasOrdenadas = useMemo(
    () => [...datasComemorativas].sort((a, b) => a.data.localeCompare(b.data)),
    [datasComemorativas],
  );

  async function carregarAno(novoAno: number) {
    setAno(novoAno);
    const [resEventos, resOrcamento, resDatas] = await Promise.all([
      fetch(`/api/dho/eventos?ano=${novoAno}`),
      fetch(`/api/dho/orcamento?ano=${novoAno}`),
      fetch(`/api/dho/datas-comemorativas?ano=${novoAno}`),
    ]);
    setEventos((await resEventos.json()).eventos ?? []);
    setOrcamento((await resOrcamento.json()).meses ?? []);
    setDatasComemorativas((await resDatas.json()).datas ?? []);
  }

  async function adicionarDataComemorativa() {
    if (!novaDataData || !novaDataNome.trim()) return;
    setSalvandoData(true);
    try {
      const res = await fetch("/api/dho/datas-comemorativas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: novaDataData, nome: novaDataNome.trim(), categoria: novaDataCategoria }),
      });
      const dados = await res.json();
      if (res.ok) {
        setDatasComemorativas((atual) => [...atual, dados.item]);
        setNovaDataData("");
        setNovaDataNome("");
      }
    } finally {
      setSalvandoData(false);
    }
  }

  async function excluirDataComemorativa(id: number) {
    setDatasComemorativas((atual) => atual.filter((d) => d.id !== id));
    await fetch(`/api/dho/datas-comemorativas/${id}`, { method: "DELETE" });
  }

  function limparForm() {
    setEditandoId(null);
    setFormData("");
    setFormDataFim("");
    setFormTitulo("");
    setFormObjetivo("");
    setFormPublicoAlvo("");
    setFormDescricao("");
    setFormItens([{ ...ITEM_VAZIO }]);
    setErro(null);
  }

  function iniciarNovaAcao(dataPreenchida?: string) {
    limparForm();
    if (dataPreenchida) {
      setFormData(dataPreenchida);
      setFormDataFim(dataPreenchida);
      // Clicou num dia do Calendário: pula pra aba de Lançamentos, que é onde mora o formulário.
      if (aba !== "lancamentos") router.push("/dho/endomarketing?aba=lancamentos");
    }
  }

  function iniciarEdicaoAcao(evento: EventoCalendario) {
    setEditandoId(evento.id);
    setFormData(evento.data);
    setFormDataFim(evento.dataFim ?? evento.data);
    setFormTitulo(evento.titulo);
    setFormObjetivo(evento.objetivo);
    setFormPublicoAlvo(evento.publicoAlvo);
    setFormDescricao(evento.descricao);
    setFormItens(
      evento.itens.length > 0
        ? evento.itens.map((i) => ({ nome: i.nome, quantidade: String(i.quantidade), valorUnitario: String(i.valorUnitario) }))
        : [{ ...ITEM_VAZIO }],
    );
    setErro(null);
  }

  function atualizarItem(idx: number, campo: keyof ItemForm, valor: string) {
    setFormItens((atual) => atual.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  async function salvarAcao() {
    if (!formData || !formTitulo.trim()) {
      setErro("Preencha ao menos a data de início e o título.");
      return;
    }
    const itensValidos = formItens.filter((i) => i.nome.trim());
    const corpo = {
      data: formData,
      dataFim: formDataFim || null,
      titulo: formTitulo.trim(),
      objetivo: formObjetivo.trim(),
      publicoAlvo: formPublicoAlvo.trim(),
      descricao: formDescricao.trim(),
      itens: itensValidos.map((i) => ({
        nome: i.nome.trim(),
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valorUnitario) || 0,
      })),
    };
    setSalvando(true);
    setErro(null);
    try {
      const res = editandoId
        ? await fetch(`/api/dho/eventos/${editandoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          })
        : await fetch("/api/dho/eventos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro ?? "Falha ao salvar.");
      setEventos((atual) => (editandoId ? atual.map((e) => (e.id === editandoId ? dados.evento : e)) : [...atual, dados.evento]));
      const resOrcamento = await fetch(`/api/dho/orcamento?ano=${ano}`);
      setOrcamento((await resOrcamento.json()).meses ?? []);
      limparForm();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirAcao(id: number) {
    setEventos((atual) => atual.filter((e) => e.id !== id));
    if (editandoId === id) limparForm();
    await fetch(`/api/dho/eventos/${id}`, { method: "DELETE" });
    const resOrcamento = await fetch(`/api/dho/orcamento?ano=${ano}`);
    setOrcamento((await resOrcamento.json()).meses ?? []);
  }

  async function salvarAprovado(mes: number, aprovado: number) {
    setOrcamento((atual) => atual.map((l) => (l.mes === mes ? { ...l, aprovado, gap: aprovado - l.utilizado, saving: Math.max(aprovado - l.utilizado, 0) } : l)));
    await fetch("/api/dho/orcamento", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ano, mes, aprovado }),
    });
  }

  const totalItensForm = formItens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);

  const seletorAno = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => carregarAno(ano - 1)}
        className="rounded border border-hairline px-2 py-1 text-[11px] text-foreground-muted hover:bg-surface-page"
      >
        ‹ {ano - 1}
      </button>
      <button
        type="button"
        onClick={() => carregarAno(ano + 1)}
        className="rounded border border-hairline px-2 py-1 text-[11px] text-foreground-muted hover:bg-surface-page"
      >
        {ano + 1} ›
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/dho/endomarketing?aba=${a.id}`}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
              aba === a.id
                ? "border-brand-primary/50 bg-brand-primary-100 text-brand-primary-800"
                : "border-hairline bg-background text-foreground hover:border-brand-primary hover:bg-brand-primary-050 hover:text-brand-primary-800",
            )}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {aba === "calendario" && (
        <div className="space-y-3">
          <Card className="flex items-center justify-between p-3">
            <p className="text-[12px] font-semibold text-foreground">{ano}</p>
            {seletorAno}
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-foreground-muted uppercase">Datas comemorativas</p>
            <div className="flex flex-wrap items-end gap-1.5">
              <label className="block">
                <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Data</span>
                <input
                  type="date"
                  value={novaDataData}
                  onChange={(e) => setNovaDataData(e.target.value)}
                  className="rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground"
                />
              </label>
              <label className="block min-w-0 flex-1">
                <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Nome do evento</span>
                <input
                  value={novaDataNome}
                  onChange={(e) => setNovaDataNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && adicionarDataComemorativa()}
                  placeholder="Ex.: Tiradentes"
                  className="w-full min-w-[10rem] rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Categoria</span>
                <select
                  value={novaDataCategoria}
                  onChange={(e) => setNovaDataCategoria(e.target.value as CategoriaDataComemorativa)}
                  className="rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground"
                >
                  {CATEGORIAS_DATA.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={salvandoData || !novaDataData || !novaDataNome.trim()}
                onClick={adicionarDataComemorativa}
                className="rounded-md bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {salvandoData ? "Salvando..." : "Adicionar"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] text-foreground-muted">
              {CATEGORIAS_DATA.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", c.dot)} /> {c.label}
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", COR_ACAO_DOT)} /> Ação (Lançamentos mensais)
              </span>
            </div>

            {datasComemorativasOrdenadas.length > 0 && (
              <div className="mt-3 flex max-h-40 flex-col divide-y divide-hairline/70 overflow-y-auto rounded-md border border-hairline">
                {datasComemorativasOrdenadas.map((d) => {
                  const cor = CATEGORIAS_DATA.find((c) => c.id === d.categoria);
                  return (
                    <div key={d.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px]">
                      <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cor?.dot)} />
                      <span className="w-20 shrink-0 text-foreground-muted">{formatarDataBr(d.data)}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{d.nome}</span>
                      <button
                        type="button"
                        onClick={() => excluirDataComemorativa(d.id)}
                        aria-label={`Excluir ${d.nome}`}
                        className="shrink-0 rounded px-1 text-foreground-muted hover:bg-status-danger-bg hover:text-status-danger"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-3">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {MESES_COMPLETOS.map((nomeMes, i) => (
                <MesCalendario
                  key={nomeMes}
                  ano={ano}
                  mes={i + 1}
                  nomeMes={nomeMes}
                  eventosPorDia={eventosPorDia}
                  acaoRangePorDia={acaoRangePorDia}
                  datasComemorativasPorDia={datasComemorativasPorDia}
                  diaSelecionado={formData}
                  onSelecionarDia={(dia) => iniciarNovaAcao(dia)}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {aba === "orcamento" && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="text-[12px] font-bold tracking-wide text-foreground-muted uppercase">Orçamento {ano}</p>
            {seletorAno}
          </div>
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-hairline bg-surface-page text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              <tr>
                <th className="px-3 py-2">Mês</th>
                <th className="px-3 py-2">Aprovado</th>
                <th className="px-3 py-2">Utilizado</th>
                <th className="px-3 py-2">Gap</th>
                <th className="px-3 py-2">Saving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {orcamento.map((l) => (
                <tr key={l.mes}>
                  <td className="px-3 py-2 font-medium text-foreground">{MESES_ABREV[l.mes - 1]}</td>
                  <td className="px-3 py-2">
                    <CampoAprovado valor={l.aprovado} onSalvar={(v) => salvarAprovado(l.mes, v)} />
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{formatarMoeda(l.utilizado)}</td>
                  <td className={cn("px-3 py-2 font-medium", l.gap < 0 ? "text-status-danger" : "text-foreground-muted")}>
                    {formatarMoeda(l.gap)}
                  </td>
                  <td className="px-3 py-2 text-status-success">{formatarMoeda(l.saving)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {aba === "lancamentos" && (
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold tracking-wide text-foreground-muted uppercase">
                {editandoId ? "Editar ação" : "Nova ação"}
              </p>
              {editandoId && (
                <button type="button" onClick={() => limparForm()} className="text-[11px] text-brand-primary hover:text-brand-primary-hover">
                  Cancelar edição
                </button>
              )}
            </div>

            {erro && <p className="mb-2 text-[11.5px] text-status-danger">{erro}</p>}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Data início</span>
                <input
                  type="date"
                  value={formData}
                  onChange={(e) => setFormData(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground"
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Data fim</span>
                <input
                  type="date"
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground"
                />
              </label>
            </div>

            <label className="mt-2 block">
              <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Tema / título</span>
              <input
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Ex.: Dia das Mães"
                className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground"
              />
            </label>

            <label className="mt-2 block">
              <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Objetivo</span>
              <input
                value={formObjetivo}
                onChange={(e) => setFormObjetivo(e.target.value)}
                className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground"
              />
            </label>

            <label className="mt-2 block">
              <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Público-alvo</span>
              <input
                value={formPublicoAlvo}
                onChange={(e) => setFormPublicoAlvo(e.target.value)}
                className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground"
              />
            </label>

            <label className="mt-2 block">
              <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Descrição</span>
              <textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground"
              />
            </label>

            <div className="mt-3">
              <div className="mb-1 grid grid-cols-[1fr_50px_70px_70px] gap-1.5 text-[10px] font-semibold text-foreground-muted uppercase">
                <span>Item</span>
                <span>Qtd</span>
                <span>Val. unid.</span>
                <span>Total</span>
              </div>
              <div className="space-y-1.5">
                {formItens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_50px_70px_70px_18px] items-center gap-1.5">
                    <input
                      value={item.nome}
                      onChange={(e) => atualizarItem(idx, "nome", e.target.value)}
                      placeholder="Nome"
                      className="rounded border border-hairline bg-background px-1.5 py-1 text-[11.5px] text-foreground"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(idx, "quantidade", e.target.value)}
                      className="rounded border border-hairline bg-background px-1.5 py-1 text-[11.5px] text-foreground"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.valorUnitario}
                      onChange={(e) => atualizarItem(idx, "valorUnitario", e.target.value)}
                      className="rounded border border-hairline bg-background px-1.5 py-1 text-[11.5px] text-foreground"
                    />
                    <span className="truncate text-[11px] text-foreground-muted">
                      {formatarMoeda((Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormItens((atual) => atual.filter((_, i) => i !== idx))}
                      className="text-[11px] text-status-danger hover:opacity-70"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFormItens((atual) => [...atual, { ...ITEM_VAZIO }])}
                className="mt-1.5 text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover"
              >
                + Adicionar item
              </button>
              <p className="mt-1.5 text-right text-[11.5px] font-semibold text-foreground">Total: {formatarMoeda(totalItensForm)}</p>
            </div>

            <button
              type="button"
              disabled={salvando}
              onClick={salvarAcao}
              className="mt-3 w-full rounded bg-brand-primary px-3 py-2 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Adicionar"}
            </button>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-foreground-muted uppercase">Ações de {ano}</p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {eventosOrdenados.length === 0 ? (
                <p className="text-[12px] text-foreground-muted">Nenhuma ação cadastrada.</p>
              ) : (
                eventosOrdenados.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-2 rounded border border-hairline px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-semibold text-brand-primary-800">
                        {formatarDataBr(e.data)}
                        {e.dataFim && e.dataFim !== e.data ? ` – ${formatarDataBr(e.dataFim)}` : ""}
                      </p>
                      <p className="truncate text-[12px] text-foreground">{e.titulo}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" title="Editar" onClick={() => iniciarEdicaoAcao(e)} className="text-[11px] text-foreground-muted hover:text-brand-primary">
                        ✎
                      </button>
                      <button type="button" title="Excluir" onClick={() => excluirAcao(e.id)} className="text-[11px] text-foreground-muted hover:text-status-danger">
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Um mês do Calendário — clicável por dia, com um ponto por ação (cor fixa) e um por data comemorativa (cor da categoria). */
function MesCalendario({
  ano,
  mes,
  nomeMes,
  eventosPorDia,
  acaoRangePorDia,
  datasComemorativasPorDia,
  diaSelecionado,
  onSelecionarDia,
}: {
  ano: number;
  mes: number;
  nomeMes: string;
  eventosPorDia: Map<string, EventoCalendario[]>;
  acaoRangePorDia: Map<string, { titulo: string; inicio: boolean; fim: boolean }>;
  datasComemorativasPorDia: Map<string, DataComemorativa[]>;
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
              if (!dia) return <span key={j} className="h-6" />;
              const acoesDoDia = eventosPorDia.get(dia) ?? [];
              const datasDoDia = datasComemorativasPorDia.get(dia) ?? [];
              const rangeAcao = acaoRangePorDia.get(dia);
              const selecionado = dia === diaSelecionado;
              const titulo = [...datasDoDia.map((d) => d.nome), ...acoesDoDia.map((e) => e.titulo)].join(", ");

              // Feriado é sempre 1 dia (pílula redonda nas duas pontas); ação
              // pode durar vários dias — arredonda só o início/fim do intervalo,
              // pra virar uma barra emendada em vez de um marcador por dia.
              const feriado = datasDoDia[0];
              const categoriaCor = feriado ? CATEGORIAS_DATA.find((c) => c.id === feriado.categoria) : undefined;

              const radius = selecionado
                ? "rounded"
                : categoriaCor
                  ? "rounded-full"
                  : rangeAcao
                    ? cn(
                        rangeAcao.inicio && rangeAcao.fim && "rounded-full",
                        rangeAcao.inicio && !rangeAcao.fim && "rounded-l-full",
                        rangeAcao.fim && !rangeAcao.inicio && "rounded-r-full",
                        !rangeAcao.inicio && !rangeAcao.fim && "rounded-none",
                      )
                    : "rounded";

              const corFundoTexto = selecionado
                ? "bg-brand-primary-100 text-brand-primary-800"
                : categoriaCor
                  ? cn(categoriaCor.bg, categoriaCor.texto, "font-semibold")
                  : rangeAcao
                    ? cn(COR_ACAO_BG, COR_ACAO_TEXTO, "font-semibold")
                    : "text-foreground-muted hover:bg-surface-page";

              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => onSelecionarDia(dia)}
                  className={cn(
                    "group relative flex h-6 items-center justify-center text-[9.5px] transition-colors",
                    radius,
                    corFundoTexto,
                    dia === hoje && "ring-2 ring-inset ring-brand-primary",
                  )}
                >
                  {Number(dia.slice(8, 10))}
                  {titulo && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden w-max max-w-40 -translate-x-1/2 rounded-md bg-brand-dark-900 px-2 py-1 text-center text-[10px] font-normal whitespace-normal text-brand-white shadow-drawer group-hover:block"
                    >
                      {titulo}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Aprovado" fixo + lápis do lado — clicar abre edição inline (mesmo padrão do resto do DHO/EPI). */
function CampoAprovado({ valor, onSalvar }: { valor: number; onSalvar: (v: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(String(valor));

  if (editando) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step="0.01"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSalvar(Number(rascunho) || 0);
              setEditando(false);
            }
          }}
          autoFocus
          className="w-20 rounded border border-hairline bg-background px-1.5 py-0.5 text-[11.5px] text-foreground outline-none focus:border-brand-primary"
        />
        <button
          type="button"
          onClick={() => {
            onSalvar(Number(rascunho) || 0);
            setEditando(false);
          }}
          className="text-[11px] text-status-success hover:opacity-70"
        >
          ✓
        </button>
        <button type="button" onClick={() => setEditando(false)} className="text-[11px] text-foreground-muted hover:opacity-70">
          ✕
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-foreground">
      {formatarMoeda(valor)}
      <button
        type="button"
        onClick={() => {
          setRascunho(String(valor));
          setEditando(true);
        }}
        aria-label="Editar aprovado"
        className="rounded p-0.5 text-foreground-muted/50 hover:bg-surface-page hover:text-foreground"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5" aria-hidden>
          <path d="M14.85 2.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12l-1.1 1.1-3-3 1.1-1.1Zm-2.16 2.16 3 3L6.94 16.06a1 1 0 0 1-.46.26l-3.1.83.83-3.1a1 1 0 0 1 .26-.46L12.7 4.3Z" />
        </svg>
      </button>
    </span>
  );
}
