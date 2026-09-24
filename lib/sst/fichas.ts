import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { buscarColaborador } from "@/lib/db/colaboradores";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { sstQuery, sstTransacao } from "./db";
import { obterPrecosEpi, obterPrecosFardamento } from "./epi";

/** Validade do link de assinatura. */
const VALIDADE_DIAS = 7;

export interface ItemFicha {
  categoria: "epi" | "fardamento";
  /** Nome do EPI ou do item de fardamento. */
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
  /** PDF anexado pelo RH ao registrar a entrega (ex.: ficha em papel já assinada antes) — opcional. */
  anexoUrl: string | null;
  anexoNome: string | null;
}

export interface FichaResumo {
  id: string;
  numero: number;
  status: "aguardando" | "assinada";
  dataEntrega: string;
  /** O que a ficha levou: "EPI", "Fardamento" ou "EPI e Fardamento". */
  conteudo: string;
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

function conteudoDaFicha(itens: ItemFicha[]): string {
  const temEpi = itens.some((i) => i.categoria === "epi");
  const temFardamento = itens.some((i) => i.categoria === "fardamento");
  return temEpi && temFardamento ? "EPI e Fardamento" : temFardamento ? "Fardamento" : "EPI";
}

export function linkAssinatura(origem: string, token: string): string {
  return `${origem}/assinatura-epi/${token}`;
}

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailFicha(para: string, nome: string, link: string) {
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";
  return {
    para,
    assunto: "Ficha de entrega de EPI para assinatura",
    texto: `Olá, ${primeiroNome}!\n\nO RH registrou a entrega dos seus EPIs. Confira a ficha e assine pelo link abaixo, entrando com o seu e-mail profissional:\n${link}\n\nO link vale por 7 dias.\n\nRH · MSB`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2d3d;max-width:520px">
  <p>Olá, ${escaparHtml(primeiroNome)}!</p>
  <p>O RH registrou a entrega dos seus EPIs. Confira a ficha e assine pelo botão abaixo, entrando com o seu e-mail profissional.</p>
  <p style="margin:24px 0"><a href="${escaparHtml(link)}" style="background:#4a9fb5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Conferir e assinar a ficha</a></p>
  <p style="font-size:12px;color:#6b7c8f">O link vale por 7 dias. Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(link)}</p>
  <p>RH · MSB</p>
</div>`,
  };
}

/**
 * Envia (ou reenvia) o e-mail da ficha — chamado quando o RH clica em
 * "Concluir" na tela de registro, não mais na hora de gerar a ficha, pra dar
 * chance de conferir o link antes de mandar pro colaborador.
 */
export async function enviarEmailDaFicha(
  fichaId: string,
  origem: string,
): Promise<{ emailEnviadoPara: string | null; erroEmail: string | null }> {
  const linhas = await sstQuery<{ colab_id: number; token: string | null }>(
    "SELECT colab_id, token FROM sst_fichas_epi WHERE id = $1",
    [fichaId],
  );
  const ficha = linhas[0];
  if (!ficha || !ficha.token) return { emailEnviadoPara: null, erroEmail: "Ficha não encontrada." };
  const colaborador = await buscarColaborador(ficha.colab_id);
  if (!colaborador) return { emailEnviadoPara: null, erroEmail: "Colaborador não encontrado." };

  if (!colaborador.email) return { emailEnviadoPara: null, erroEmail: "Colaborador sem e-mail profissional no Quadro." };
  if (!emailConfigurado()) return { emailEnviadoPara: null, erroEmail: "Envio automático de e-mail ainda não configurado no portal." };

  const link = linkAssinatura(origem, ficha.token);
  try {
    await enviarEmail(emailFicha(colaborador.email, colaborador.nome, link));
    return { emailEnviadoPara: colaborador.email, erroEmail: null };
  } catch (erro) {
    return { emailEnviadoPara: null, erroEmail: `Não foi possível enviar o e-mail (${erro instanceof Error ? erro.message : "erro desconhecido"}).` };
  }
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
  anexo_url: string | null;
  anexo_nome: string | null;
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
  const [epis, fardamento] = await Promise.all([
    sstQuery<LinhaItem>(
      `SELECT ficha_id, epi, qtd, ca, valor_unit::float8 AS valor_unit, data_entrega, data_troca
         FROM sst_entregas_epi WHERE ficha_id = ANY($1) ORDER BY created_at`,
      [ids],
    ),
    sstQuery<LinhaItem>(
      `SELECT ficha_id, tipo AS epi, qtd, '' AS ca, valor_unit::float8 AS valor_unit, data_entrega, '' AS data_troca
         FROM sst_fardamento_entregas WHERE ficha_id = ANY($1) ORDER BY created_at`,
      [ids],
    ),
  ]);
  const adicionar = (l: LinhaItem, categoria: ItemFicha["categoria"]) => {
    const lista = porFicha.get(l.ficha_id) ?? [];
    lista.push({
      categoria,
      epi: l.epi,
      qtd: l.qtd,
      ca: l.ca,
      valorUnit: l.valor_unit,
      dataEntrega: l.data_entrega,
      dataTroca: l.data_troca,
    });
    porFicha.set(l.ficha_id, lista);
  };
  epis.forEach((l) => adicionar(l, "epi"));
  fardamento.forEach((l) => adicionar(l, "fardamento"));
  return porFicha;
}

export interface NovaFicha {
  colaboradorId: number;
  itens: { epi: string; qtd: number; ca: string; dataEntrega: string; dataTroca: string | null }[];
  fardamento: { tipo: string; qtd: number; dataEntrega: string }[];
  /** PDF opcional que o RH anexa ao registrar a entrega (já salvo no Blob antes de chamar criarFicha). */
  anexoUrl?: string | null;
  anexoNome?: string | null;
}

/**
 * Registra as entregas e gera a ficha com o link de assinatura. As tabelas do
 * SST vivem no mesmo banco do Quadro agora, então `colab_id` referencia a
 * própria `colaboradores` real — sem espelho.
 */
export async function criarFicha(nova: NovaFicha, responsavel: string, origem: string) {
  const colaborador = await buscarColaborador(nova.colaboradorId);
  if (!colaborador) throw new Error("Colaborador não encontrado no Quadro.");
  const [precos, precosFardamento] = await Promise.all([obterPrecosEpi(), obterPrecosFardamento()]);

  const fichaId = randomUUID();
  const token = randomBytes(24).toString("base64url");
  const itens = nova.itens.map((i) => ({ ...i, id: randomUUID() }));

  const numero = await sstTransacao(async (q) => {
    const [{ proximo }] = await q<{ proximo: number }>(
      "SELECT COALESCE(MAX(numero), 0) + 1 AS proximo FROM sst_fichas_epi",
    );
    await q(
      `INSERT INTO sst_fichas_epi (id, numero, colab_id, entrega_ids, gerada_em, gerada_por, token, status, expira_em, anexo_url, anexo_nome)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'aguardando', now() + ($8 || ' days')::interval, $9, $10)`,
      [
        fichaId,
        proximo,
        colaborador.id,
        itens.map((i) => i.id),
        new Date().toISOString(),
        responsavel,
        token,
        String(VALIDADE_DIAS),
        nova.anexoUrl ?? null,
        nova.anexoNome ?? null,
      ],
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
    for (const item of nova.fardamento) {
      await q(
        `INSERT INTO sst_fardamento_entregas (id, colab_id, cpf, tipo, qtd, valor_unit, data_entrega, responsavel, ficha_id, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          randomUUID(),
          colaborador.id,
          colaborador.cpf ?? "",
          item.tipo,
          item.qtd,
          precosFardamento.get(item.tipo) ?? 0,
          isoParaBr(item.dataEntrega),
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

export interface ItensParaEditar {
  itens: { epi: string; qtd: number; ca: string; dataEntrega: string; dataTroca: string | null }[];
  fardamento: { tipo: string; qtd: number; dataEntrega: string }[];
}

/**
 * RH edita os itens de uma ficha AINDA AGUARDANDO assinatura — clicando na
 * data do histórico. Depois de assinada não dá mais (o comprovante já
 * referencia os itens de então). Substitui tudo (mesmo padrão de "editar
 * lista inteira" usado na Matriz de EPI/Exames), mantendo o mesmo ficha_id
 * e o link de assinatura já enviado.
 */
export async function atualizarFicha(fichaId: string, dados: ItensParaEditar): Promise<void> {
  const [ficha] = await sstQuery<{ colab_id: number; status: string }>(
    "SELECT colab_id, status FROM sst_fichas_epi WHERE id = $1",
    [fichaId],
  );
  if (!ficha) throw new Error("Ficha não encontrada.");
  if (ficha.status === "assinada") throw new Error("Esta ficha já foi assinada e não pode mais ser editada.");
  if (dados.itens.length + dados.fardamento.length === 0) throw new Error("Selecione ao menos um EPI ou fardamento.");

  const colaborador = await buscarColaborador(ficha.colab_id);
  if (!colaborador) throw new Error("Colaborador não encontrado no Quadro.");
  const [precos, precosFardamento] = await Promise.all([obterPrecosEpi(), obterPrecosFardamento()]);

  const novosIds: string[] = [];
  await sstTransacao(async (q) => {
    await q("DELETE FROM sst_entregas_epi WHERE ficha_id = $1", [fichaId]);
    await q("DELETE FROM sst_fardamento_entregas WHERE ficha_id = $1", [fichaId]);
    for (const item of dados.itens) {
      const id = randomUUID();
      novosIds.push(id);
      await q(
        `INSERT INTO sst_entregas_epi (id, colab_id, cpf, epi, qtd, ca, valor_unit, data_entrega, data_troca, responsavel, ficha_id, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          colaborador.id,
          colaborador.cpf ?? "",
          item.epi,
          item.qtd,
          item.ca,
          precos.get(item.epi) ?? 0,
          isoParaBr(item.dataEntrega),
          item.dataTroca ? isoParaBr(item.dataTroca) : "",
          "edicao",
          fichaId,
          new Date().toISOString(),
        ],
      );
    }
    for (const item of dados.fardamento) {
      const id = randomUUID();
      novosIds.push(id);
      await q(
        `INSERT INTO sst_fardamento_entregas (id, colab_id, cpf, tipo, qtd, valor_unit, data_entrega, responsavel, ficha_id, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          colaborador.id,
          colaborador.cpf ?? "",
          item.tipo,
          item.qtd,
          precosFardamento.get(item.tipo) ?? 0,
          isoParaBr(item.dataEntrega),
          "edicao",
          fichaId,
          new Date().toISOString(),
        ],
      );
    }
    await q("UPDATE sst_fichas_epi SET entrega_ids = $2 WHERE id = $1", [fichaId, novosIds]);
  });
}

/** Histórico do colaborador (uma linha por ficha) + quais EPIs já têm entrega registrada. */
export async function listarFichasDoColaborador(colaboradorId: number, origem: string) {
  const fichas = await sstQuery<LinhaFicha>(
    `SELECT id, numero, colab_id, status, token, gerada_em, expira_em, NULL AS assinatura
       FROM sst_fichas_epi WHERE colab_id = $1 AND token IS NOT NULL ORDER BY numero DESC`,
    [colaboradorId],
  );
  const itens = await itensDasFichas(fichas.map((f) => f.id));
  // Entrega mais recente de cada EPI — só conta CONFIRMADA (ficha assinada, PDF
  // do modelo antigo, ou sem ficha/registro legado): enquanto a ficha só está
  // aguardando assinatura, o colaborador ainda não confirmou o recebimento.
  const [entregues, dispensadasTroca, divergenciasDispensadas] = await Promise.all([
    sstQuery<{ epi: string; data_troca: string }>(
      `SELECT DISTINCT ON (e.epi) e.epi, e.data_troca
         FROM sst_entregas_epi e
         LEFT JOIN sst_fichas_epi f ON f.id = e.ficha_id
         WHERE e.colab_id = $1 AND (e.ficha_id IS NULL OR f.status = 'assinada' OR f.assinatura_storage_path IS NOT NULL)
         ORDER BY e.epi, to_date(NULLIF(e.data_entrega, ''), 'DD/MM/YYYY') DESC NULLS LAST, e.created_at DESC`,
      [colaboradorId],
    ),
    sstQuery<{ epi: string; data_troca: string }>(
      "SELECT epi, data_troca FROM sst_epi_trocas_dispensadas WHERE colab_id = $1",
      [colaboradorId],
    ),
    sstQuery<{ epi: string }>("SELECT epi FROM sst_epi_divergencias_dispensadas WHERE colab_id = $1", [colaboradorId]),
  ]);
  const chaveDispensada = new Set(dispensadasTroca.map((d) => `${d.epi}::${d.data_troca}`));

  const resumo: FichaResumo[] = fichas.map((f) => ({
    id: f.id,
    numero: f.numero,
    status: f.status,
    dataEntrega: primeiraData((itens.get(f.id) ?? []).map((i) => i.dataEntrega)),
    conteudo: conteudoDaFicha(itens.get(f.id) ?? []),
    expirada: expirou(f),
    link: f.status === "aguardando" ? linkAssinatura(origem, f.token) : null,
  }));
  return {
    fichas: resumo,
    // Divergência dispensada entra aqui pra sumir da lista de "sem entrega" no
    // drawer, junto com o que de fato foi entregue.
    episEntregues: [...entregues.map((e) => e.epi), ...divergenciasDispensadas.map((d) => d.epi)],
    trocas: entregues
      .filter((e) => !chaveDispensada.has(`${e.epi}::${e.data_troca}`))
      .map((e) => ({ epi: e.epi, dataTroca: e.data_troca })),
  };
}

/** RH dispensa a divergência de um EPI obrigatório sem entrega (ex.: não se aplica de fato a este colaborador). */
export async function dispensarDivergenciaEpi(colaboradorId: number, epi: string): Promise<void> {
  await sstQuery(
    `INSERT INTO sst_epi_divergencias_dispensadas (colab_id, epi) VALUES ($1, $2)
       ON CONFLICT (colab_id, epi) DO NOTHING`,
    [colaboradorId, epi],
  );
}

/** RH dispensa o aviso de "troca vencida" de um EPI — presa à data exata, uma entrega nova reabre o aviso. */
export async function dispensarTrocaVencida(colaboradorId: number, epi: string, dataTroca: string): Promise<void> {
  await sstQuery(
    `INSERT INTO sst_epi_trocas_dispensadas (colab_id, epi, data_troca) VALUES ($1, $2, $3)
       ON CONFLICT (colab_id, epi, data_troca) DO NOTHING`,
    [colaboradorId, epi, dataTroca],
  );
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
    anexoUrl: f.anexo_url,
    anexoNome: f.anexo_nome,
  };
}

const COLUNAS_FICHA = "id, numero, colab_id, status, token, gerada_em, expira_em, assinatura, anexo_url, anexo_nome";

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

/** Exclui a ficha e as entregas dela, de EPI e de fardamento (Custo e Valores deixa de contá-las). */
export async function excluirFicha(fichaId: string): Promise<boolean> {
  return sstTransacao(async (q) => {
    await q("DELETE FROM sst_entregas_epi WHERE ficha_id = $1", [fichaId]);
    await q("DELETE FROM sst_fardamento_entregas WHERE ficha_id = $1", [fichaId]);
    const apagadas = await q<{ id: string }>("DELETE FROM sst_fichas_epi WHERE id = $1 RETURNING id", [fichaId]);
    return apagadas.length > 0;
  });
}
