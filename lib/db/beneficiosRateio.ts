import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { estaNaFolha } from "@/lib/folha/vigencia";
import { diasUteisDeFeriasNoMes, proporcionalAosDiasTrabalhados, type JanelaDeFerias } from "@/lib/folha/feriasNoMes";
import { listarProgramacaoFerias } from "./programacaoFerias";
import { obterDiasUteis } from "./beneficiosDiasUteis";
import { obterExtras, listarCompetenciasFechadas } from "./folhaBreakdown";
import { obterVariaveis, type ItemVariavel } from "./beneficiosVariaveis";
import { detalharTransporteDoMes, arredondar, VT_DIARIO_IMPLAUSIVEL, type OrigemTransporte } from "@/lib/calc";
import { obterTotaisInformados } from "./beneficiosTotais";

export interface LinhaRateio {
  colaboradorId: number;
  nome: string;
  cpf: string | null;
  vinculo: string | null;
  departamento: string | null;
  /** Centro de rateio informado no D365; `null` = o agrupamento deduz pelo departamento. */
  rateioD365: string | null;
  cidade: string | null;
  tipoTransporte: string;
  valeTransporte: number;
  /** "cadastro" = veio do valor por dia do colaborador; o resto é suprimento, e a tela avisa. */
  origemVt: OrigemTransporte;
  /** Parte descontada do empregado (Lei 7.418/85) — o custo líquido da empresa é valeTransporte menos isto. */
  descontoVtEmpregado: number;
  /** Valor por dia útil alto demais para ser passagem — provável valor mensal na coluna errada. */
  vtDiarioImplausivel: boolean;
  /** Dias úteis de férias na competência — abatidos do transporte e da mobilidade. */
  diasUteisDeFerias: number;
  /** Datas do gozo que causou o abatimento, para a tela poder explicar. */
  feriasNoMes: JanelaDeFerias[];
  valeAlimentacao: number;
  /** Odontológico/Sólides/Flash/Bonificação/Outros — vêm da mesma planilha de extras do Breakdown de Folha (Relatório detalhado); `null` = nada importado nesse mês. */
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  outrosCustos: number | null;
  /** Soma de todas as planilhas de "Variável" importadas nessa competência para o colaborador — acumula, nunca sobrescreve. */
  variaveis: number;
  variaveisItens: ItemVariavel[];
}

interface ExtrasRateio {
  valeTransporte: number | null;
  valeAlimentacao: number | null;
  /** Variáveis informadas na planilha; substituem o calculado do mês. */
  variaveis: number | null;
}

function competenciaParaAnoMes(competencia: string): { ano: number; mes: number } {
  const [ano, mes] = competencia.split("-").map(Number);
  return { ano, mes };
}

interface LinhaExtrasRateio {
  colaborador_id: number;
  vale_transporte: number | null;
  vale_alimentacao: number | null;
  variaveis: number | null;
}

async function obterExtrasRateio(competencia: string): Promise<Map<number, ExtrasRateio>> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT colaborador_id, vale_transporte, vale_alimentacao, variaveis FROM beneficios_rateio_extras WHERE competencia = ?",
    args: [competencia],
  });
  const linhas = resultado.rows as unknown as LinhaExtrasRateio[];
  return new Map(
    linhas.map((l) => [
      l.colaborador_id,
      { valeTransporte: l.vale_transporte, valeAlimentacao: l.vale_alimentacao, variaveis: l.variaveis },
    ]),
  );
}

/**
 * Rateio de benefícios do mês — VT/VA calculados a partir do cadastro (fonte
 * única de verdade), com override opcional por planilha importada (Importar
 * rateio) para casos em que o valor real do mês diverge do calculado.
 */
export async function gerarRateio(competencia: string): Promise<{ linhas: LinhaRateio[]; diasUteis: number }> {
  const { ano, mes } = competenciaParaAnoMes(competencia);
  const diasUteis = await obterDiasUteis(ano, mes);
  const extras = await obterExtrasRateio(competencia);

  // Janelas de gozo vindas da Programação/Controle de Férias — a mesma fonte
  // que as duas telas usam. Cancelada não conta: as férias não vão acontecer.
  const feriasPorColaborador = new Map<number, JanelaDeFerias[]>();
  for (const item of await listarProgramacaoFerias()) {
    if (item.status === "cancelada") continue;
    const inicio = item.dataInicio;
    if (!inicio) continue;
    // Sem data de retorno registrada, o fim sai dos dias do lançamento — as
    // férias contam dias corridos a partir do início (Art. 130 CLT).
    const fim =
      item.dataRetorno ??
      new Date(new Date(`${inicio}T00:00:00Z`).getTime() + (item.dias - 1) * 86400000).toISOString().slice(0, 10);
    const atual = feriasPorColaborador.get(item.colaboradorId) ?? [];
    atual.push({ inicio, fim });
    feriasPorColaborador.set(item.colaboradorId, atual);
  }
  const extrasFolha = await obterExtras(competencia);
  const variaveis = await obterVariaveis(competencia);

  // Benefício é da folha CLT do mês: quem já saiu não recebe mais, quem ainda
  // não entrou não recebe ainda, e PJ não tem benefício nenhum — emite nota.
  // Sem este filtro o rateio listava desligados e PJs com valor cheio, e o
  // alerta de "sem valor de VT cadastrado" cobrava cadastro de gente que não
  // deveria estar na conta.
  const doMes = (await listarColaboradores()).filter((c) => c.vinculo !== "PJ" && estaNaFolha(c, competencia));

  const linhas: LinhaRateio[] = doMes.map((c) => {
    const transporte = detalharTransporteDoMes(c, diasUteis);

    // Transporte e mobilidade pagam deslocamento: em dia de férias não há
    // deslocamento. Alimentação fica fora — o DP paga o mês cheio.
    const janelas = feriasPorColaborador.get(c.id) ?? [];
    const diasDeFerias = diasUteisDeFeriasNoMes(competencia, janelas);
    const transporteComFerias =
      diasDeFerias > 0
        ? arredondar(proporcionalAosDiasTrabalhados(transporte.bruto, diasUteis, diasDeFerias))
        : transporte.bruto;
    const override = extras.get(c.id);
    const extraFolha = extrasFolha.get(c.id);
    const variavelColaborador = variaveis.get(c.id);

    return {
      colaboradorId: c.id,
      nome: c.nome,
      cpf: c.cpf,
      vinculo: c.vinculo,
      departamento: c.departamento,
      rateioD365: c.rateioD365,
      cidade: c.cidade,
      tipoTransporte: c.tipoTransporte,
      // Bruto, não líquido: no rateio o que interessa é o valor do vale, que é
      // o que a operadora fatura. O desconto do empregado vai à parte.
      valeTransporte: override?.valeTransporte ?? transporteComFerias,
      descontoVtEmpregado: override?.valeTransporte !== null && override?.valeTransporte !== undefined ? 0 : transporte.descontoEmpregado,
      origemVt: override?.valeTransporte !== null && override?.valeTransporte !== undefined ? "cadastro" : transporte.origem,
      vtDiarioImplausivel:
        c.tipoTransporte !== "vm_fixo" && (c.valorTransporteDia ?? 0) > VT_DIARIO_IMPLAUSIVEL,
      // O override da planilha manda: se o DP informou o valor, ele já vem com
      // o desconto que quiser, e o portal não abate de novo por cima.
      diasUteisDeFerias:
        override?.valeTransporte !== null && override?.valeTransporte !== undefined ? 0 : diasDeFerias,
      feriasNoMes: janelas.filter((j) => diasUteisDeFeriasNoMes(competencia, [j]) > 0),
      valeAlimentacao: override?.valeAlimentacao ?? (c.alimentacaoValor ?? 0),
      odontologico: extraFolha?.odontologico ?? null,
      solides: extraFolha?.solides ?? null,
      flash: extraFolha?.flash ?? null,
      bonificacao: extraFolha?.bonificacao ?? null,
      outrosCustos: extraFolha?.outrosCustos ?? null,
      // Informado na planilha de rateio manda; senão, o calculado do mês (hoje,
      // o presente de aniversário lido do Quadro de Colaboradores).
      variaveis: override?.variaveis ?? variavelColaborador?.total ?? 0,
      variaveisItens: variavelColaborador?.itens ?? [],
    };
  });

  return { linhas, diasUteis };
}

export interface ResumoMensalBeneficios {
  mes: number;
  /** Vale transporte — por dia útil. */
  vt: number;
  /** Vale mobilidade — valor fixo do mês. */
  vm: number;
  /** Vale refeição. */
  vr: number;
  odontoPlataformas: number;
  brindes: number;
  variaveis: number;
  total: number;
  /**
   * Total que o DP informou para o mês, quando existe — para conferência com a
   * fatura da operadora. NÃO substitui o rateio: o dashboard mostra o rateio e
   * usa isto para apontar a diferença.
   */
  informadoVt: number | null;
  informadoVm: number | null;
  informadoVr: number | null;
  /** Há algum total informado neste mês. */
  informado: boolean;
  /** Mês fechado no Breakdown — não aceita mais edição em lugar nenhum do portal. */
  fechado: boolean;
}

/**
 * Custo de benefícios por mês do ano.
 *
 * O número que vale é o do RATEIO: a soma colaborador a colaborador que a aba
 * ao lado mostra. Antes o total informado pelo DP substituía essa soma, e o
 * topo do dashboard discordava da tabela logo abaixo sem que houvesse como
 * saber por quê — ao corrigir o VT de alguém no Quadro, o cartão não se mexia.
 *
 * O informado continua guardado e volta como `informadoVt/Vm/Vr`, para o
 * dashboard mostrar a diferença contra a fatura da operadora. Divergir é
 * esperado (recarga proporcional, catraca não usada, ajuste de crédito) — o
 * que não pode é a divergência ficar invisível.
 */
export async function obterResumoAnualBeneficios(ano: number): Promise<ResumoMensalBeneficios[]> {
  const informados = await obterTotaisInformados(ano);
  const fechadas = new Set(await listarCompetenciasFechadas());

  return Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const mes = i + 1;
      const competencia = `${ano}-${String(mes).padStart(2, "0")}`;
      const { linhas } = await gerarRateio(competencia);

      let vt = 0;
      let vm = 0;
      let vr = 0;
      let odontoPlataformas = 0;
      let brindes = 0;
      let variaveis = 0;
      for (const l of linhas) {
        if (l.tipoTransporte === "vm_fixo") vm += l.valeTransporte;
        else vt += l.valeTransporte;
        vr += l.valeAlimentacao;
        odontoPlataformas += (l.odontologico ?? 0) + (l.solides ?? 0) + (l.flash ?? 0);
        brindes += (l.bonificacao ?? 0) + (l.outrosCustos ?? 0);
        variaveis += l.variaveis;
      }

      const t = informados.get(mes);

      return {
        mes,
        vt: arredondar(vt),
        vm: arredondar(vm),
        vr: arredondar(vr),
        odontoPlataformas: arredondar(odontoPlataformas),
        brindes: arredondar(brindes),
        variaveis: arredondar(variaveis),
        total: arredondar(vt + vm + vr + odontoPlataformas + brindes + variaveis),
        informadoVt: t?.vt ?? null,
        informadoVm: t?.vm ?? null,
        informadoVr: t?.vr ?? null,
        informado: t !== undefined && (t.vt !== null || t.vm !== null || t.vr !== null),
        fechado: fechadas.has(competencia),
      };
    }),
  );
}

export async function upsertExtrasRateio(colaboradorId: number, competencia: string, extras: ExtrasRateio): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO beneficios_rateio_extras (colaborador_id, competencia, vale_transporte, vale_alimentacao, variaveis)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(colaborador_id, competencia) DO UPDATE SET
         vale_transporte = excluded.vale_transporte,
         vale_alimentacao = excluded.vale_alimentacao,
         variaveis = excluded.variaveis`,
    args: [colaboradorId, competencia, extras.valeTransporte, extras.valeAlimentacao, extras.variaveis],
  });
}

export interface LinhaImportacaoRateio {
  codigo: string | null;
  nomeColaborador: string;
  valeTransporte: number | null;
  valeAlimentacao: number | null;
  variaveis: number | null;
}

export interface ResultadoImportacaoRateio {
  aplicadas: number;
  descartados: { linha: number; motivo: string }[];
}

/** Aplica VT/VA importados de planilha à competência — casamento por código (se houver) e, senão, por nome. */
export async function importarRateio(itens: LinhaImportacaoRateio[], competencia: string): Promise<ResultadoImportacaoRateio> {
  const colaboradores = await listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));
  const porNome = new Map(colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));

  let aplicadas = 0;
  const descartados: ResultadoImportacaoRateio["descartados"] = [];

  for (const [indice, item] of itens.entries()) {
    const linha = indice + 2;
    const colaborador =
      (item.codigo ? porCodigo.get(item.codigo.trim()) : undefined) ??
      porNome.get(item.nomeColaborador.trim().toLowerCase());

    if (!colaborador) {
      descartados.push({ linha, motivo: `Colaborador "${item.nomeColaborador}" não encontrado no cadastro.` });
      continue;
    }

    await upsertExtrasRateio(colaborador.id, competencia, {
      valeTransporte: item.valeTransporte,
      valeAlimentacao: item.valeAlimentacao,
      variaveis: item.variaveis,
    });
    aplicadas++;
  }

  return { aplicadas, descartados };
}
