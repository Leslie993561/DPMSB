import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { buscarColaborador } from "@/lib/db/colaboradores";
import { sstQuery, sstTransacao } from "./db";
import { obterPrecosEpi } from "./epi";

/** Validade do link de assinatura. */
const VALIDADE_DIAS = 7;

export interface ItemFicha {
  epi: string;
  qtd: number;
  /** Certificado de Aprovação do EPI. */
  ca: string;
  valorUnit: number;
  /** DD/MM/AAAA — mesmo formato que o Portal SST já gravava. */
  dataEntrega: string;
  /** Troca prevista (vencimento), DD/MM/AAAA ou vazio. */
  dataTroca: string;
}

export interface AssinaturaFicha {
  assinadaEm: string;
  /** Link pelo qual a ficha foi acessada e assinada. */
  link: string;
  nome: string;
  cpf: string;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  /** Guardado como evidência, não aparece no documento. */
  ip: string;
}

export interface DocumentoFicha {
  id: string;
  numero: number;
  status: "aguardando" | "assinada";
  geradaEm: string;
  expirada: boolean;
  colaborador: { nome: string; cargo: string | null; departamento: string | null };
  itens: ItemFicha[];
  /** Só depois de assinada — traz os dados pessoais do comprovante. */
  assinatura: AssinaturaFicha | null;
}

export interface FichaResumo {
  id: string;
  numero: number;
  status: "aguardando" | "assinada";
  dataEntrega: string;
  expirada: boolean;
  /** Link para reenviar enquanto aguarda assinatura. */
  link: string | null;
}

function isoParaBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Menor data "DD/MM/AAAA" da lista — a data de entrega que aparece no histórico. */
function primeiraData(datas: string[]): string {
  const validas = datas.filter((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d));
  if (validas.length === 0) return "";
  return validas.sort((a, b) => a.split("/").reverse().join("").localeCompare(b.split("/").reverse().join("")))[0];
}

export function linkAssinatura(origem: string, token: string): string {
  return `${origem}/assinatura-epi/${token}`;
}

interface LinhaFicha {
  id: string;
  numero: number;
  colab_id: string;
  status: "aguardando" | "assinada";
  token: string;
  gerada_em: string;
  expira_em: Date | null;
  assinatura: AssinaturaFicha | null;
}

interface LinhaItem {
  ficha_id: string;
  epi: string;
  qtd: number;
  ca: string;
  valor_unit: number;
  data_entrega: string;
  data_troca: string;
}

const expirou = (f: LinhaFicha) => f.status === "aguardando" && f.expira_em !== null && f.expira_em < new Date();

async function itensDasFichas(ids: string[]): Promise<Map<string, ItemFicha[]>> {
  const porFicha = new Map<string, ItemFicha[]>();
  if (ids.length === 0) return porFicha;
  const linhas = await sstQuery<LinhaItem>(
    `SELECT ficha_id, epi, qtd, ca, valor_unit::float8 AS valor_unit, data_entrega, data_troca
       FROM sst_entregas_epi WHERE ficha_id = ANY($1) ORDER BY created_at`,
    [ids],
  );
  for (const l of linhas) {
    const lista = porFicha.get(l.ficha_id) ?? [];
    lista.push({ epi: l.epi, qtd: l.qtd, ca: l.ca, valorUnit: l.valor_unit, dataEntrega: l.data_entrega, dataTroca: l.data_troca });
    porFicha.set(l.ficha_id, lista);
  }
  return porFicha;
}

export interface NovaFicha {
  colaboradorId: number;
  itens: { epi: string; qtd: number; ca: string; dataEntrega: string; dataTroca: string | null }[];
}

/**
 * Registra as entregas e gera a ficha com o link de assinatura. A tabela de
 * entregas do SST tem chave estrangeira para a tabela de colaboradores DELE,
 * que não é o Quadro — o colaborador do Quadro é espelhado lá (mesmo id)
 * antes, na mesma transação.
 */
export async function criarFicha(nova: NovaFicha, responsavel: string, origem: string) {
  const colaborador = await buscarColaborador(nova.colaboradorId);
  if (!colaborador) throw new Error("Colaborador não encontrado no Quadro.");
  const precos = await obterPrecosEpi();

  const fichaId = randomUUID();
  const token = randomBytes(24).toString("base64url");
  const itens = nova.itens.map((i) => ({ ...i, id: randomUUID() }));

  const numero = await sstTransacao(async (q) => {
    await q(
      `INSERT INTO colaboradores (id, cpf, nome, cargo, departamento, origem)
       VALUES ($1, $2, $3, $4, $5, 'portal-rh')
       ON CONFLICT (id) DO UPDATE SET cpf = excluded.cpf, nome = excluded.nome, cargo = excluded.cargo,
         departamento = excluded.departamento, updated_at = now()`,
      [colaborador.id, colaborador.cpf ?? "", colaborador.nome, colaborador.cargo ?? "", colaborador.departamento ?? ""],
    );
    const [{ proximo }] = await q<{ proximo: number }>(
      "SELECT COALESCE(MAX(numero), 0) + 1 AS proximo FROM sst_fichas_epi",
    );
    await q(
      `INSERT INTO sst_fichas_epi (id, numero, colab_id, entrega_ids, gerada_em, gerada_por, token, status, expira_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'aguardando', now() + ($8 || ' days')::interval)`,
      [fichaId, proximo, colaborador.id, itens.map((i) => i.id), new Date().toISOString(), responsavel, token, String(VALIDADE_DIAS)],
    );
    for (const item of itens) {
      await q(
        `INSERT INTO sst_entregas_epi (id, colab_id, cpf, epi, qtd, ca, valor_unit, data_entrega, data_troca, responsavel, ficha_id, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          item.id,
          colaborador.id,
          colaborador.cpf ?? "",
          item.epi,
          item.qtd,
          item.ca,
          precos.get(item.epi) ?? 0,
          isoParaBr(item.dataEntrega),
          item.dataTroca ? isoParaBr(item.dataTroca) : "",
          responsavel,
          fichaId,
          new Date().toISOString(),
        ],
      );
    }
    return proximo;
  });

  return {
    fichaId,
    numero,
    link: linkAssinatura(origem, token),
    colaborador: { nome: colaborador.nome, email: colaborador.email },
  };
}

/** Histórico do colaborador (uma linha por ficha) + quais EPIs já têm entrega registrada. */
export async function listarFichasDoColaborador(colaboradorId: number, origem: string) {
  const fichas = await sstQuery<LinhaFicha>(
    `SELECT id, numero, colab_id, status, token, gerada_em, expira_em, NULL AS assinatura
       FROM sst_fichas_epi WHERE colab_id = $1 AND token IS NOT NULL ORDER BY numero DESC`,
    [colaboradorId],
  );
  const itens = await itensDasFichas(fichas.map((f) => f.id));
  const entregues = await sstQuery<{ epi: string }>(
    "SELECT DISTINCT epi FROM sst_entregas_epi WHERE colab_id = $1",
    [colaboradorId],
  );

  const resumo: FichaResumo[] = fichas.map((f) => ({
    id: f.id,
    numero: f.numero,
    status: f.status,
    dataEntrega: primeiraData((itens.get(f.id) ?? []).map((i) => i.dataEntrega)),
    expirada: expirou(f),
    link: f.status === "aguardando" ? linkAssinatura(origem, f.token) : null,
  }));
  return { fichas: resumo, episEntregues: entregues.map((e) => e.epi) };
}

async function montarDocumento(f: LinhaFicha): Promise<DocumentoFicha> {
  const [itens, colaborador] = await Promise.all([
    itensDasFichas([f.id]),
    sstQuery<{ nome: string; cargo: string; departamento: string }>(
      "SELECT nome, cargo, departamento FROM colaboradores WHERE id = $1",
      [f.colab_id],
    ),
  ]);
  const c = colaborador[0];
  return {
    id: f.id,
    numero: f.numero,
    status: f.status,
    geradaEm: f.gerada_em,
    expirada: expirou(f),
    colaborador: {
      nome: f.assinatura?.nome ?? c?.nome ?? "",
      cargo: f.assinatura?.cargo ?? c?.cargo ?? null,
      departamento: f.assinatura?.departamento ?? c?.departamento ?? null,
    },
    itens: itens.get(f.id) ?? [],
    assinatura: f.assinatura,
  };
}

const COLUNAS_FICHA = "id, numero, colab_id, status, token, gerada_em, expira_em, assinatura";

/** Documento completo para o RH (inclui o comprovante de assinatura). */
export async function obterDocumentoFicha(fichaId: string): Promise<DocumentoFicha | null> {
  const [f] = await sstQuery<LinhaFicha>(`SELECT ${COLUNAS_FICHA} FROM sst_fichas_epi WHERE id = $1`, [fichaId]);
  return f ? montarDocumento(f) : null;
}

/**
 * O que o link público mostra antes de assinar: a ficha, sem dados pessoais.
 * Depois de assinada, o comprovante (CPF, RG…) só volta na resposta da própria
 * assinatura — quem tiver o link não consegue reabrir esses dados.
 */
export async function obterFichaPublica(token: string): Promise<DocumentoFicha | null> {
  const [f] = await sstQuery<LinhaFicha>(`SELECT ${COLUNAS_FICHA} FROM sst_fichas_epi WHERE token = $1`, [token]);
  if (!f) return null;
  const doc = await montarDocumento(f);
  return { ...doc, assinatura: null };
}

/**
 * A identidade vem do próprio link: ele é enviado ao e-mail profissional do
 * colaborador no Quadro, e só assina uma vez.
 */
export async function assinarFicha(token: string, evidencia: { ip: string; link: string }): Promise<DocumentoFicha> {
  const [f] = await sstQuery<LinhaFicha>(`SELECT ${COLUNAS_FICHA} FROM sst_fichas_epi WHERE token = $1`, [token]);
  if (!f) throw new Error("Link inválido.");
  if (f.status === "assinada") throw new Error("Esta ficha já foi assinada.");
  if (expirou(f)) throw new Error("Este link expirou. Peça ao RH um novo link.");

  const colaborador = await buscarColaborador(Number(f.colab_id));
  if (!colaborador) throw new Error("Colaborador não encontrado.");

  const assinatura: AssinaturaFicha = {
    assinadaEm: new Date().toISOString(),
    link: evidencia.link,
    nome: colaborador.nome,
    cpf: colaborador.cpf ?? "",
    email: colaborador.email,
    cargo: colaborador.cargo,
    departamento: colaborador.departamento,
    ip: evidencia.ip,
  };

  // Condição no WHERE: dois cliques simultâneos não geram duas assinaturas.
  const atualizadas = await sstQuery<{ id: string }>(
    `UPDATE sst_fichas_epi SET status = 'assinada', assinada_em = now(), assinatura = $2
      WHERE id = $1 AND status = 'aguardando' RETURNING id`,
    [f.id, JSON.stringify(assinatura)],
  );
  if (atualizadas.length === 0) throw new Error("Esta ficha já foi assinada.");
  await sstQuery("UPDATE sst_entregas_epi SET assinatura = 'eletronica' WHERE ficha_id = $1", [f.id]);

  return montarDocumento({ ...f, status: "assinada", assinatura });
}

/** Quantas fichas foram enviadas e quantas já têm assinatura (eletrônica ou PDF anexado do modelo antigo). */
export async function obterResumoFichas(): Promise<{ enviadas: number; assinadas: number }> {
  const [r] = await sstQuery<{ enviadas: number; assinadas: number }>(
    `SELECT count(*)::int AS enviadas,
            count(*) FILTER (WHERE status = 'assinada' OR assinatura_storage_path IS NOT NULL)::int AS assinadas
       FROM sst_fichas_epi`,
  );
  return r ?? { enviadas: 0, assinadas: 0 };
}

/** Exclui a ficha e as entregas dela (Custo e Valores deixa de contá-las). */
export async function excluirFicha(fichaId: string): Promise<boolean> {
  return sstTransacao(async (q) => {
    await q("DELETE FROM sst_entregas_epi WHERE ficha_id = $1", [fichaId]);
    const apagadas = await q<{ id: string }>("DELETE FROM sst_fichas_epi WHERE id = $1 RETURNING id", [fichaId]);
    return apagadas.length > 0;
  });
}
