/**
 * Turnover mensal a partir das datas reais de admissão/desligamento do cadastro.
 *
 *   efetivo médio = (efetivo no início do mês + efetivo no fim do mês) ÷ 2
 *   turnover (%)  = [(admissões + desligamentos) ÷ 2] ÷ efetivo médio × 100
 *
 * Efetivo numa data D = quem tinha admissão ≤ D e não tinha desligamento ≤ D.
 * Sem data de admissão, quem está ativo conta como já presente antes do período
 * (não se inventa uma data); desligado sem data de desligamento não dá pra
 * posicionar no tempo e fica fora da série.
 * Função pura (sem banco) — é o que torna o cálculo auditável e testável.
 */

export interface ColaboradorTurnover {
  id: number;
  nome: string;
  status: string;
  dataAdmissao: string | null;
  dataDesligamento: string | null;
}

export interface PessoaMovimento {
  colaboradorId: number;
  nome: string;
  data: string;
}

export interface MesTurnover {
  /** 1–12. */
  mes: number;
  /** Mês ainda não alcançado: sem resultado. */
  futuro: boolean;
  /** Mês em andamento: dados até hoje, sem projeção. */
  parcial: boolean;
  /** Último dia considerado (fim do mês, ou hoje no mês atual). */
  dataFim: string;
  efetivoInicial: number;
  admissoes: number;
  desligamentos: number;
  efetivoFinal: number;
  efetivoMedio: number;
  /** Em %, null quando o mês é futuro ou o efetivo médio é zero. */
  turnoverPct: number | null;
  admitidos: PessoaMovimento[];
  desligados: PessoaMovimento[];
}

const dia = (d: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}/.test(d ?? "") ? (d as string).slice(0, 10) : null);
const pad = (n: number) => String(n).padStart(2, "0");

function ultimoDia(ano: number, mes: number): string {
  return `${ano}-${pad(mes)}-${pad(new Date(Date.UTC(ano, mes, 0)).getUTCDate())}`;
}

function presenteEm(c: ColaboradorTurnover, data: string): boolean {
  const adm = dia(c.dataAdmissao);
  const desl = dia(c.dataDesligamento);
  if (adm && adm > data) return false;
  if (desl) return desl > data;
  return c.status === "ativo";
}

export function calcularTurnoverAno(colaboradores: ColaboradorTurnover[], ano: number, hoje: string): MesTurnover[] {
  const efetivoEm = (data: string) => colaboradores.filter((c) => presenteEm(c, data)).length;

  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const inicioMes = `${ano}-${pad(mes)}-01`;
    const fimMes = ultimoDia(ano, mes);
    const futuro = inicioMes > hoje;
    const parcial = !futuro && fimMes > hoje;
    const dataFim = parcial ? hoje : fimMes;
    const vazio: MesTurnover = {
      mes, futuro, parcial, dataFim,
      efetivoInicial: 0, admissoes: 0, desligamentos: 0, efetivoFinal: 0, efetivoMedio: 0,
      turnoverPct: null, admitidos: [], desligados: [],
    };
    if (futuro) return vazio;

    const antes = ultimoDia(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1);
    const noMes = (d: string | null) => d !== null && d >= inicioMes && d <= dataFim;
    const admitidos: PessoaMovimento[] = [];
    const desligados: PessoaMovimento[] = [];
    for (const c of colaboradores) {
      const adm = dia(c.dataAdmissao);
      const desl = dia(c.dataDesligamento);
      if (adm && noMes(adm)) admitidos.push({ colaboradorId: c.id, nome: c.nome, data: adm });
      if (desl && noMes(desl)) desligados.push({ colaboradorId: c.id, nome: c.nome, data: desl });
    }
    const porData = (a: PessoaMovimento, b: PessoaMovimento) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, "pt-BR");
    admitidos.sort(porData);
    desligados.sort(porData);

    const efetivoInicial = efetivoEm(antes);
    const efetivoFinal = efetivoEm(dataFim);
    const efetivoMedio = (efetivoInicial + efetivoFinal) / 2;
    const turnoverPct = efetivoMedio > 0 ? ((admitidos.length + desligados.length) / 2 / efetivoMedio) * 100 : null;
    return { ...vazio, efetivoInicial, admissoes: admitidos.length, desligamentos: desligados.length, efetivoFinal, efetivoMedio, turnoverPct, admitidos, desligados };
  });
}
