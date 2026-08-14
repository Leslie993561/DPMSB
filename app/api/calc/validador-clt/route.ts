import { z } from "zod";
import { calcularFerias, calcularFGTS, calcularInssPatronal, arredondar } from "@/lib/calc";
import { validarFracionamentoTotal } from "@/lib/ferias-gestao/validacoes";
import { ehFeriadoNacionalFixo } from "@/lib/ferias-gestao/feriadosNacionais";

export const runtime = "nodejs";

const schema = z.object({
  dataAdmissao: z.iso.date(),
  salarioBase: z.coerce.number().positive(),
  dependentes: z.coerce.number().min(0).default(0),
  inicioFerias: z.iso.date(),
  saldoPeriodo: z.coerce.number().min(1).max(30),
  fracionamento: z.array(z.coerce.number().min(0)).min(1).max(3),
  abono: z.coerce.boolean().default(false),
  abonoJaSolicitado: z.coerce.boolean().default(false),
});

interface Verificacao {
  titulo: string;
  nivel: "sucesso" | "atencao" | "erro";
  mensagem: string;
}

function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + dias);
  return paraIso(d);
}

function subtrairDias(iso: string, dias: number): string {
  return somarDias(iso, -dias);
}

/** Encontra o ciclo de 12 meses (a partir da admissão) que contém `referencia`, mesma regra de sincronizarPeriodos. */
function periodoDaReferencia(dataAdmissao: string, referencia: string): { inicio: string; fim: string } {
  let inicio = new Date(dataAdmissao);
  let fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 12);
  const ref = new Date(referencia);
  while (fim <= ref) {
    inicio = fim;
    fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + 12);
  }
  return { inicio: paraIso(inicio), fim: paraIso(fim) };
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { dataAdmissao, salarioBase, dependentes, inicioFerias, saldoPeriodo, fracionamento, abono, abonoJaSolicitado } =
    parsed.data;

  const hoje = new Date();
  const { inicio: aquisitivoInicio, fim: aquisitivoFimExclusivo } = periodoDaReferencia(dataAdmissao, inicioFerias);
  const aquisitivoFim = subtrairDias(aquisitivoFimExclusivo, 1);
  const concessivoInicio = aquisitivoFimExclusivo;
  const concessivoFimExclusivo = somarDias(aquisitivoFimExclusivo, 365);
  const concessivoFim = subtrairDias(concessivoFimExclusivo, 1);

  const diasGozo = fracionamento.filter((d) => d > 0).reduce((s, d) => s + d, 0);
  const tetoAbono = Math.floor(saldoPeriodo / 3);
  const diasAbono = abono ? tetoAbono : 0;
  const retorno = somarDias(inicioFerias, diasGozo);
  const prazoAviso = subtrairDias(inicioFerias, 30);
  const prazoPagamento = subtrairDias(inicioFerias, 2);

  const verificacoes: Verificacao[] = [];

  if (new Date(aquisitivoFimExclusivo) > hoje) {
    verificacoes.push({
      titulo: "Período aquisitivo em formação",
      nivel: "atencao",
      mensagem: `O período ${aquisitivoInicio.split("-").reverse().join("/")} – ${aquisitivoFim
        .split("-")
        .reverse()
        .join("/")} ainda está em curso: o direito integral às férias nasce em ${aquisitivoFimExclusivo
        .split("-")
        .reverse()
        .join("/")}, quando se inicia automaticamente o novo período aquisitivo.`,
    });
  }

  const fracionamentoResultado = validarFracionamentoTotal(fracionamento, saldoPeriodo, diasAbono);
  verificacoes.push({
    titulo: "Fracionamento válido",
    nivel: fracionamentoResultado.ok ? "sucesso" : "erro",
    mensagem: fracionamentoResultado.ok
      ? `${fracionamento.filter((d) => d > 0).join(" + ")} = ${diasGozo} dias corridos, com uma parte de no mínimo 14 dias e as demais com 5 ou mais. Necessária a concordância do empregado.`
      : fracionamentoResultado.erro,
  });

  if (abono) {
    if (abonoJaSolicitado) {
      verificacoes.push({
        titulo: "Abono válido",
        nivel: "erro",
        mensagem: "Abono pecuniário já foi solicitado neste período aquisitivo — só pode ser pedido uma vez.",
      });
    } else {
      verificacoes.push({
        titulo: "Abono válido",
        nivel: "sucesso",
        mensagem: `${tetoAbono} de ${saldoPeriodo} dias vendidos (limite de 1/3 = ${tetoAbono}). Restam ${
          saldoPeriodo - tetoAbono
        } dias de gozo. O pedido deve ser feito até 15 dias antes do término do período aquisitivo.`,
      });
    }
  }

  const diaAntes1 = subtrairDias(inicioFerias, 1);
  const diaAntes2 = subtrairDias(inicioFerias, 2);
  const feriado1 = ehFeriadoNacionalFixo(diaAntes1);
  const feriado2 = ehFeriadoNacionalFixo(diaAntes2);
  const diaSemana = new Date(inicioFerias).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  if (feriado1.feriado || feriado2.feriado) {
    const nomeFeriado = feriado1.feriado ? feriado1.nome : feriado2.feriado ? feriado2.nome : "";
    verificacoes.push({
      titulo: "Data de início válida",
      nivel: "erro",
      mensagem: `Início vedado nos 2 dias que antecedem feriado nacional (${nomeFeriado}) — Art. 134, §3º CLT.`,
    });
  } else {
    verificacoes.push({
      titulo: "Data de início válida",
      nivel: "sucesso",
      mensagem: `${inicioFerias.split("-").reverse().join("/")} (${diaSemana}) não cai nos 2 dias que antecedem um feriado nacional fixo conhecido. Repouso semanal e feriados móveis/municipais não são verificados nesta versão — confirme a escala do colaborador.`,
    });
  }

  verificacoes.push({
    titulo: "Prazos de aviso e pagamento",
    nivel: "sucesso",
    mensagem: `Aviso até ${prazoAviso.split("-").reverse().join("/")} (30 dias antes) e pagamento das férias + 1/3 até ${prazoPagamento
      .split("-")
      .reverse()
      .join("/")} (2 dias antes do início). Contagem sempre em dias corridos, incluindo sábados, domingos e feriados.`,
  });

  const resultado = calcularFerias({
    salarioBase,
    diasDireito: saldoPeriodo,
    diasGozados: diasGozo,
    abonoPecuniario: abono,
    dependentes,
    competencia: new Date(inicioFerias),
  });
  const bruto = arredondar(
    resultado.detalhe.valorGozado + resultado.detalhe.tercoConstitucional + resultado.detalhe.abono + resultado.detalhe.tercoAbono,
  );
  const fgts = calcularFGTS(bruto, new Date(inicioFerias));
  const inssPatronal = calcularInssPatronal(bruto, new Date(inicioFerias));
  const custoTotalEmpresa = arredondar(bruto + fgts.valor + inssPatronal.valor);
  const encargosEmpresa = arredondar(fgts.valor + inssPatronal.valor);

  return Response.json({
    periodoAquisitivo: { inicio: aquisitivoInicio, fim: aquisitivoFim },
    periodoConcessivo: { inicio: concessivoInicio, fim: concessivoFim },
    retorno,
    prazoAviso,
    prazoPagamento,
    verificacoes,
    valores: {
      valorDiario: arredondar(salarioBase / 30),
      feriasDiasCorridos: diasGozo,
      valorGozado: resultado.detalhe.valorGozado,
      tercoConstitucional: resultado.detalhe.tercoConstitucional,
      diasAbono,
      abono: resultado.detalhe.abono,
      tercoAbono: resultado.detalhe.tercoAbono,
      bruto,
      inss: resultado.detalhe.inss,
      irrf: resultado.detalhe.irrf,
      liquido: resultado.detalhe.valorLiquido,
      fgts: fgts.valor,
      inssPatronal: inssPatronal.valor,
      custoTotalEmpresa,
      encargosEmpresa,
    },
  });
}
