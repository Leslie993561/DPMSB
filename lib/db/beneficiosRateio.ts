import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { obterDiasUteis } from "./beneficiosDiasUteis";
import { obterExtras, listarCompetenciasFechadas } from "./folhaBreakdown";
import { obterVariaveis, type ItemVariavel } from "./beneficiosVariaveis";
import { calcularTransporteDoMes, arredondar } from "@/lib/calc";
import { obterTotaisInformados } from "./beneficiosTotais";

export interface LinhaRateio {
  colaboradorId: number;
  nome: string;
  cpf: string | null;
  vinculo: string | null;
  departamento: string | null;
  cidade: string | null;
  tipoTransporte: string;
  valeTransporte: number;
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
}

function competenciaParaAnoMes(competencia: string): { ano: number; mes: number } {
  const [ano, mes] = competencia.split("-").map(Number);
  return { ano, mes };
}

interface LinhaExtrasRateio {
  colaborador_id: number;
  vale_transporte: number | null;
  vale_alimentacao: number | null;
}

async function obterExtrasRateio(competencia: string): Promise<Map<number, ExtrasRateio>> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT colaborador_id, vale_transporte, vale_alimentacao FROM beneficios_rateio_extras WHERE competencia = ?",
    args: [competencia],
  });
  const linhas = resultado.rows as unknown as LinhaExtrasRateio[];
  return new Map(linhas.map((l) => [l.colaborador_id, { valeTransporte: l.vale_transporte, valeAlimentacao: l.vale_alimentacao }]));
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
  const extrasFolha = await obterExtras(competencia);
  const variaveis = await obterVariaveis(competencia);

  const linhas: LinhaRateio[] = (await listarColaboradores()).map((c) => {
    const calculado = calcularTransporteDoMes(c, diasUteis);
    const override = extras.get(c.id);
    const extraFolha = extrasFolha.get(c.id);
    const variavelColaborador = variaveis.get(c.id);

    return {
      colaboradorId: c.id,
      nome: c.nome,
      cpf: c.cpf,
      vinculo: c.vinculo,
      departamento: c.departamento,
      cidade: c.cidade,
      tipoTransporte: c.tipoTransporte,
      valeTransporte: override?.valeTransporte ?? calculado,
      valeAlimentacao: override?.valeAlimentacao ?? (c.alimentacaoValor ?? 0),
      odontologico: extraFolha?.odontologico ?? null,
      solides: extraFolha?.solides ?? null,
      flash: extraFolha?.flash ?? null,
      bonificacao: extraFolha?.bonificacao ?? null,
      outrosCustos: extraFolha?.outrosCustos ?? null,
      variaveis: variavelColaborador?.total ?? 0,
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
   * VT/VM/VR vieram do total que o DP informou para o mês, não da soma do
   * cadastro. O dashboard marca a diferença: um número conferido com a
   * operadora não é a mesma coisa que uma projeção.
   */
  informado: boolean;
  /** Mês fechado no Breakdown — não aceita mais edição em lugar nenhum do portal. */
  fechado: boolean;
}

/**
 * Custo de benefícios por mês do ano.
 *
 * VT/VM/VR saem do cadastro, colaborador a colaborador — é o que permite
 * ratear por setor. Mas quando o DP informa o total que a empresa pagou no mês
 * (`beneficios_totais_mes`), é ESSE número que vale aqui: ele veio da operadora
 * e já embute recarga proporcional, catraca não usada e ajuste de crédito, que
 * a soma teórica não tem como saber. O rateio por pessoa segue calculado — o
 * que muda é só o total do mês.
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

      // Verba a verba: o informado substitui o calculado só onde existe.
      const t = informados.get(mes);
      vt = t?.vt ?? vt;
      vm = t?.vm ?? vm;
      vr = t?.vr ?? vr;

      return {
        mes,
        vt: arredondar(vt),
        vm: arredondar(vm),
        vr: arredondar(vr),
        odontoPlataformas: arredondar(odontoPlataformas),
        brindes: arredondar(brindes),
        variaveis: arredondar(variaveis),
        total: arredondar(vt + vm + vr + odontoPlataformas + brindes + variaveis),
        informado: t !== undefined && (t.vt !== null || t.vm !== null || t.vr !== null),
        fechado: fechadas.has(competencia),
      };
    }),
  );
}

export async function upsertExtrasRateio(colaboradorId: number, competencia: string, extras: ExtrasRateio): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO beneficios_rateio_extras (colaborador_id, competencia, vale_transporte, vale_alimentacao)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(colaborador_id, competencia) DO UPDATE SET
         vale_transporte = excluded.vale_transporte, vale_alimentacao = excluded.vale_alimentacao`,
    args: [colaboradorId, competencia, extras.valeTransporte, extras.valeAlimentacao],
  });
}

export interface LinhaImportacaoRateio {
  codigo: string | null;
  nomeColaborador: string;
  valeTransporte: number | null;
  valeAlimentacao: number | null;
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
    });
    aplicadas++;
  }

  return { aplicadas, descartados };
}
