"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/shared/Card";
import { GraficoBarrasMensal } from "@/components/shared/GraficoBarrasMensal";
import { Modal } from "@/components/shared/Modal";
import { formatarDataBr, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CategoriaDataComemorativa, DataComemorativa, EventoCalendario, ItemEvento, LinhaOrcamentoMes } from "@/lib/db/dho";

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
  id: string;
  blocoId: string;
  nome: string;
  quantidade: string;
  valorUnitario: string;
}

/** Bloco temático de itens (ex.: "Brindes", "Brinquedos") — agrupa itens dentro do mesmo formulário de ação. */
interface BlocoForm {
  id: string;
  tema: string;
}

function criarIdLocal(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function novoBloco(): BlocoForm {
  return { id: criarIdLocal(), tema: "" };
}

function novoItem(blocoId: string): ItemForm {
  return { id: criarIdLocal(), blocoId, nome: "", quantidade: "1", valorUnitario: "0" };
}

/** Reconstrói blocos a partir dos itens salvos (que só guardam o nome do tema) — um bloco por tema distinto, na ordem em que aparece. */
function blocosEItensDoFormulario(itens: ItemEvento[]): { blocos: BlocoForm[]; itens: ItemForm[] } {
  if (itens.length === 0) {
    const bloco = novoBloco();
    return { blocos: [bloco], itens: [novoItem(bloco.id)] };
  }
  const blocos: BlocoForm[] = [];
  const blocoIdPorTema = new Map<string, string>();
  const itensForm: ItemForm[] = [];
  for (const item of itens) {
    const tema = item.tema ?? "";
    let blocoId = blocoIdPorTema.get(tema);
    if (!blocoId) {
      const bloco: BlocoForm = { id: criarIdLocal(), tema };
      blocos.push(bloco);
      blocoId = bloco.id;
      blocoIdPorTema.set(tema, blocoId);
    }
    itensForm.push({ id: criarIdLocal(), blocoId, nome: item.nome, quantidade: String(item.quantidade), valorUnitario: String(item.valorUnitario) });
  }
  return { blocos, itens: itensForm };
}

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

  // Edição rápida a partir do clique no dia do Calendário — não navega de aba,
  // abre um modal ali mesmo (ação ou data comemorativa, o que estiver marcado).
  const [modalAcaoAberto, setModalAcaoAberto] = useState(false);
  const [feriadoEditando, setFeriadoEditando] = useState<DataComemorativa | null>(null);
  const [feriadoNomeRascunho, setFeriadoNomeRascunho] = useState("");
  const [feriadoCategoriaRascunho, setFeriadoCategoriaRascunho] = useState<CategoriaDataComemorativa>("nacional");
  const [salvandoFeriadoModal, setSalvandoFeriadoModal] = useState(false);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [formData, setFormData] = useState("");
  const [formDataFim, setFormDataFim] = useState("");
  const [formTitulo, setFormTitulo] = useState("");
  const [formObjetivo, setFormObjetivo] = useState("");
  const [formPublicoAlvo, setFormPublicoAlvo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formBlocos, setFormBlocos] = useState<BlocoForm[]>([novoBloco()]);
  const [formItens, setFormItens] = useState<ItemForm[]>(() => [novoItem(formBlocos[0].id)]);
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
    const bloco = novoBloco();
    setFormBlocos([bloco]);
    setFormItens([novoItem(bloco.id)]);
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
    const { blocos, itens } = blocosEItensDoFormulario(evento.itens);
    setFormBlocos(blocos);
    setFormItens(itens);
    setErro(null);
  }

  /** Clicou num dia do Calendário que já tem ação: abre um modal ali mesmo, já preenchido pra editar — sem trocar de aba. */
  function abrirModalAcao(evento: EventoCalendario) {
    iniciarEdicaoAcao(evento);
    setModalAcaoAberto(true);
  }

  function fecharModalAcao() {
    setModalAcaoAberto(false);
    limparForm();
  }

  async function excluirAcaoNoModal() {
    if (editandoId === null) return;
    await excluirAcao(editandoId);
    fecharModalAcao();
  }

  /** Clicou num dia do Calendário que já tem data comemorativa: mesma ideia, num modal simples (só nome e categoria). */
  function abrirModalFeriado(d: DataComemorativa) {
    setFeriadoEditando(d);
    setFeriadoNomeRascunho(d.nome);
    setFeriadoCategoriaRascunho(d.categoria);
  }

  function fecharModalFeriado() {
    setFeriadoEditando(null);
  }

  async function salvarEdicaoFeriado() {
    if (!feriadoEditando || !feriadoNomeRascunho.trim()) return;
    setSalvandoFeriadoModal(true);
    try {
      const res = await fetch(`/api/dho/datas-comemorativas/${feriadoEditando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: feriadoEditando.data,
          nome: feriadoNomeRascunho.trim(),
          categoria: feriadoCategoriaRascunho,
        }),
      });
      const dados = await res.json();
      if (res.ok) {
        setDatasComemorativas((atual) => atual.map((d) => (d.id === feriadoEditando.id ? dados.item : d)));
        fecharModalFeriado();
      }
    } finally {
      setSalvandoFeriadoModal(false);
    }
  }

  async function excluirFeriadoNoModal() {
    if (!feriadoEditando) return;
    await excluirDataComemorativa(feriadoEditando.id);
    fecharModalFeriado();
  }

  function atualizarItem(id: string, campo: "nome" | "quantidade" | "valorUnitario", valor: string) {
    setFormItens((atual) => atual.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)));
  }

  function removerItem(id: string) {
    setFormItens((atual) => atual.filter((it) => it.id !== id));
  }

  /** "+ Adicionar bloco" — um novo tema (ex.: Brindes, Brinquedos) já com um item em branco pra começar a preencher. */
  function adicionarBloco() {
    const bloco = novoBloco();
    setFormBlocos((atual) => [...atual, bloco]);
    setFormItens((atual) => [...atual, novoItem(bloco.id)]);
  }

  function renomearBloco(blocoId: string, tema: string) {
    setFormBlocos((atual) => atual.map((b) => (b.id === blocoId ? { ...b, tema } : b)));
  }

  function removerBloco(blocoId: string) {
    setFormBlocos((atual) => atual.filter((b) => b.id !== blocoId));
    setFormItens((atual) => atual.filter((it) => it.blocoId !== blocoId));
  }

  function adicionarItemNoBloco(blocoId: string) {
    setFormItens((atual) => [...atual, novoItem(blocoId)]);
  }

  async function salvarAcao(): Promise<boolean> {
    if (!formData || !formTitulo.trim()) {
      setErro("Preencha ao menos a data de início e o título.");
      return false;
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
        tema: formBlocos.find((b) => b.id === i.blocoId)?.tema.trim() || null,
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
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
      return false;
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

  // Campos do formulário de ação — usados tanto no card fixo da aba
  // Lançamentos mensais quanto no modal de edição rápida do Calendário, pra
  // não duplicar (e não desalinhar) o mesmo formulário em dois lugares.
  const camposFormularioAcao = (
    <>
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

      <div className="mt-3 space-y-2.5">
        {formBlocos.map((bloco) => {
          const itensDoBloco = formItens.filter((it) => it.blocoId === bloco.id);
          const totalBloco = itensDoBloco.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
          return (
            <div key={bloco.id} className="rounded-md border border-hairline p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                <input
                  value={bloco.tema}
                  onChange={(e) => renomearBloco(bloco.id, e.target.value)}
                  placeholder="Nome do bloco (ex.: Brindes)"
                  className="min-w-0 flex-1 rounded border border-hairline bg-background px-2 py-1 text-[11.5px] font-semibold text-foreground"
                />
                {formBlocos.length > 1 && (
                  <button
                    type="button"
                    title="Remover bloco"
                    onClick={() => removerBloco(bloco.id)}
                    className="shrink-0 text-[11px] text-status-danger hover:opacity-70"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="mb-1 grid grid-cols-[1fr_50px_70px_70px] gap-1.5 text-[10px] font-semibold text-foreground-muted uppercase">
                <span>Item</span>
                <span>Qtd</span>
                <span>Val. unid.</span>
                <span>Total</span>
              </div>
              <div className="space-y-1.5">
                {itensDoBloco.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_50px_70px_70px_18px] items-center gap-1.5">
                    <input
                      value={item.nome}
                      onChange={(e) => atualizarItem(item.id, "nome", e.target.value)}
                      placeholder="Nome"
                      className="rounded border border-hairline bg-background px-1.5 py-1 text-[11.5px] text-foreground"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(item.id, "quantidade", e.target.value)}
                      className="rounded border border-hairline bg-background px-1.5 py-1 text-[11.5px] text-foreground"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.valorUnitario}
                      onChange={(e) => atualizarItem(item.id, "valorUnitario", e.target.value)}
                      className="rounded border border-hairline bg-background px-1.5 py-1 text-[11.5px] text-foreground"
                    />
                    <span className="truncate text-[11px] text-foreground-muted">
                      {formatarMoeda((Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerItem(item.id)}
                      className="text-[11px] text-status-danger hover:opacity-70"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => adicionarItemNoBloco(bloco.id)}
                className="mt-1.5 text-[11px] font-medium text-brand-primary hover:text-brand-primary-hover"
              >
                + Adicionar item
              </button>
              <p className="mt-1.5 text-right text-[11px] font-medium text-foreground-muted">Subtotal: {formatarMoeda(totalBloco)}</p>
            </div>
          );
        })}

        <button type="button" onClick={adicionarBloco} className="text-[11.5px] font-semibold text-brand-primary hover:text-brand-primary-hover">
          + Adicionar bloco
        </button>

        <p className="text-right text-[11.5px] font-semibold text-foreground">Total: {formatarMoeda(totalItensForm)}</p>
      </div>
    </>
  );

  const totalAprovado = orcamento.reduce((s, l) => s + l.aprovado, 0);
  const totalUtilizado = orcamento.reduce((s, l) => s + l.utilizado, 0);
  const totalGap = totalAprovado - totalUtilizado;

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
                  onEditarAcao={abrirModalAcao}
                  onEditarFeriado={abrirModalFeriado}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        aberto={modalAcaoAberto}
        onFechar={fecharModalAcao}
        titulo="Editar ação"
        eyebrow="Calendário"
        rodape={
          <>
            <button
              type="button"
              onClick={fecharModalAcao}
              className="rounded-md border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={excluirAcaoNoModal}
              className="text-[12px] font-medium text-status-danger hover:opacity-70"
            >
              Excluir ação
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={async () => {
                if (await salvarAcao()) setModalAcaoAberto(false);
              }}
              className="ml-auto rounded-md bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        }
      >
        {camposFormularioAcao}
      </Modal>

      <Modal
        aberto={feriadoEditando !== null}
        onFechar={fecharModalFeriado}
        titulo="Editar data comemorativa"
        eyebrow="Calendário"
        rodape={
          <>
            <button
              type="button"
              onClick={fecharModalFeriado}
              className="rounded-md border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-page"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={excluirFeriadoNoModal}
              className="text-[12px] font-medium text-status-danger hover:opacity-70"
            >
              Excluir
            </button>
            <button
              type="button"
              disabled={salvandoFeriadoModal || !feriadoNomeRascunho.trim()}
              onClick={salvarEdicaoFeriado}
              className="ml-auto rounded-md bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {salvandoFeriadoModal ? "Salvando..." : "Salvar alterações"}
            </button>
          </>
        }
      >
        {feriadoEditando && (
          <div className="space-y-2.5">
            <p className="text-[11.5px] text-foreground-muted">{formatarDataBr(feriadoEditando.data)}</p>
            <label className="block">
              <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Nome do evento</span>
              <input
                value={feriadoNomeRascunho}
                onChange={(e) => setFeriadoNomeRascunho(e.target.value)}
                className="w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] text-foreground"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10.5px] font-medium text-foreground-muted">Categoria</span>
              <select
                value={feriadoCategoriaRascunho}
                onChange={(e) => setFeriadoCategoriaRascunho(e.target.value as CategoriaDataComemorativa)}
                className="w-full rounded-md border border-hairline bg-background px-2 py-1.5 text-[12px] text-foreground"
              >
                {CATEGORIAS_DATA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </Modal>

      {aba === "orcamento" && (
        <div className="space-y-3">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold tracking-wide text-foreground-muted uppercase">Custo total do portal · {ano}</p>
              {seletorAno}
            </div>
            <GraficoBarrasMensal
              series={[
                { label: "Gap", cor: "bg-status-danger" },
                { label: "Saving", cor: "bg-status-success" },
              ]}
              dados={orcamento.map((l) => ({
                mesLabel: MESES_ABREV[l.mes - 1],
                // Mesma exclusão mútua da tabela abaixo: gap (estourou) e saving (sobrou)
                // nunca coexistem no mesmo mês, é o mesmo número com sinal trocado.
                valores: [l.gap < 0 ? Math.abs(l.gap) : 0, l.gap > 0 ? l.saving : 0],
              }))}
            />
          </Card>

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
                    {/* Gap (estourou o aprovado) e Saving (sobrou) nunca coexistem no mesmo
                        mês — é o mesmo número com sinal trocado, então só uma das duas
                        colunas mostra valor por vez; a outra fica em traço. */}
                    <td className="px-3 py-2 font-medium text-status-danger">{l.gap < 0 ? formatarMoeda(l.gap) : "—"}</td>
                    <td className="px-3 py-2 text-status-success">{l.gap > 0 ? formatarMoeda(l.saving) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-hairline bg-surface-page font-semibold">
                  <td className="px-3 py-2 text-foreground">Total</td>
                  <td className="px-3 py-2 text-foreground">{formatarMoeda(totalAprovado)}</td>
                  <td className="px-3 py-2 text-foreground">{formatarMoeda(totalUtilizado)}</td>
                  <td className="px-3 py-2 text-status-danger">{totalGap < 0 ? formatarMoeda(totalGap) : "—"}</td>
                  <td className="px-3 py-2 text-status-success">{totalGap > 0 ? formatarMoeda(totalGap) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </div>
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

            {camposFormularioAcao}

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
  onEditarAcao,
  onEditarFeriado,
}: {
  ano: number;
  mes: number;
  nomeMes: string;
  eventosPorDia: Map<string, EventoCalendario[]>;
  acaoRangePorDia: Map<string, { titulo: string; inicio: boolean; fim: boolean }>;
  datasComemorativasPorDia: Map<string, DataComemorativa[]>;
  diaSelecionado: string | null;
  onSelecionarDia: (dia: string) => void;
  /** Dia já tem ação(ões): clicar abre para EDITAR (formulário preenchido) em vez de abrir um lançamento novo em branco. */
  onEditarAcao: (evento: EventoCalendario) => void;
  /** Dia já tem data comemorativa e nenhuma ação: clicar abre pra ver/editar/excluir ela. */
  onEditarFeriado: (data: DataComemorativa) => void;
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
                  onClick={() =>
                    acoesDoDia.length > 0
                      ? onEditarAcao(acoesDoDia[0])
                      : datasDoDia.length > 0
                        ? onEditarFeriado(datasDoDia[0])
                        : onSelecionarDia(dia)
                  }
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
