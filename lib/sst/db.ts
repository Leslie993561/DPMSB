import "server-only";
import { Pool } from "pg";

/**
 * Pool dedicado ao Postgres (Supabase) do Portal SST — banco SEPARADO do
 * `DATABASE_URL` principal do Portal Recursos Humanos (ver lib/db/client.ts).
 * Nunca reaproveitar o pool de lá aqui: são bancos diferentes, com schemas
 * diferentes (o do SST já existe e é gerenciado pelo próprio repositório
 * portal-sst — este arquivo só LÊ, nunca roda CREATE TABLE/ALTER aqui).
 */
function resolverConnectionString(): string {
  const url = process.env.SST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Defina SST_DATABASE_URL (connection string do Postgres/Supabase do Portal SST) no .env.local — veja .env.example.",
    );
  }
  return url;
}

/**
 * Mesmo motivo do singleton em lib/db/client.ts: em dev o hot-reload
 * reavalia este módulo a cada save, e um singleton de módulo comum criaria
 * um Pool novo por reavaliação sem fechar o anterior, vazando conexões até
 * estourar o limite do pooler do Supabase.
 */
interface CacheSstDb {
  pool: Pool | null;
}

const globalSst = globalThis as typeof globalThis & { __portalDpSstDb?: CacheSstDb };
const cache: CacheSstDb = (globalSst.__portalDpSstDb ??= { pool: null });

function getSstPool(): Pool {
  if (!cache.pool) {
    cache.pool = new Pool({
      connectionString: resolverConnectionString(),
      ssl: { rejectUnauthorized: false },
      // Teto baixo por processo — mesmo raciocínio do pool principal: o
      // pooler do Supabase tem um limite total de conexões e este é mais um
      // processo disputando esse número, além do pool do DATABASE_URL.
      max: 3,
      idleTimeoutMillis: 30_000,
    });
  }
  return cache.pool;
}

/**
 * Colunas que o Portal RH acrescenta às tabelas do SST. A sst_fichas_epi foi
 * feita para anexar um PDF assinado à mão; a assinatura eletrônica precisa de
 * token do link, situação, validade e o registro de quem assinou. Aditivo e
 * idempotente — roda uma vez por processo.
 */
const ESQUEMA_EXTRA = `
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS token text UNIQUE;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando';
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS expira_em timestamptz;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS assinada_em timestamptz;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS assinatura jsonb;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS anexo_url text;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS anexo_nome text;
  ALTER TABLE sst_fardamento_entregas ADD COLUMN IF NOT EXISTS ficha_id text;
  CREATE TABLE IF NOT EXISTS sst_matriz_epi_extra (
    funcao text PRIMARY KEY,
    epis text[] NOT NULL DEFAULT '{}',
    atualizado_em timestamptz NOT NULL DEFAULT now()
  );
`;

let esquemaPronto: Promise<void> | null = null;

async function garantirEsquema(pool: Pool): Promise<void> {
  esquemaPronto ??= pool
    .query(ESQUEMA_EXTRA)
    .then(() => undefined)
    .catch((erro) => {
      esquemaPronto = null;
      throw erro;
    });
  return esquemaPronto;
}

/** Executa uma consulta contra o Postgres do Portal SST e devolve as linhas já tipadas. */
export async function sstQuery<T extends object = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getSstPool();
  await garantirEsquema(pool);
  const resultado = await pool.query(sql, params);
  return resultado.rows as T[];
}

/** Várias escritas que só fazem sentido juntas (ficha + entregas): tudo ou nada. */
export async function sstTransacao<T>(fn: (query: typeof sstQuery) => Promise<T>): Promise<T> {
  const pool = getSstPool();
  await garantirEsquema(pool);
  const conexao = await pool.connect();
  try {
    await conexao.query("BEGIN");
    const query = (async (sql: string, params: unknown[] = []) =>
      (await conexao.query(sql, params)).rows) as typeof sstQuery;
    const resultado = await fn(query);
    await conexao.query("COMMIT");
    return resultado;
  } catch (erro) {
    await conexao.query("ROLLBACK").catch(() => {});
    throw erro;
  } finally {
    conexao.release();
  }
}
