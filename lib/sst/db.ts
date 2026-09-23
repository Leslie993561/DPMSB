import "server-only";
import { Pool } from "pg";

/**
 * Pool dedicado às tabelas do SST — mas agora no MESMO banco (Supabase) do
 * Portal Recursos Humanos (`DATABASE_URL`, ver lib/db/client.ts). Até aqui o
 * SST vivia num projeto Supabase à parte (`SST_DATABASE_URL`), gerenciado
 * pelo repositório separado portal-sst; esse projeto ficou fora do ar
 * (pausado) e a decisão foi consolidar tudo num banco só, sem migrar o
 * histórico antigo (módulo recomeça vazio).
 *
 * Continua um Pool separado (não o `getDb()` de lib/db/client.ts) por dois
 * motivos: 1) as queries daqui usam SQL cru com `$1, $2...` e `ON CONFLICT`
 * como o driver `pg` espera, enquanto `getDb()` fala a API estilo libSQL
 * (`?`) usada pelo resto do app — misturar os dois exigiria reescrever todas
 * as queries; 2) mantém o teto de conexões deste módulo isolado do resto.
 */
function resolverConnectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Defina DATABASE_URL (connection string do Postgres/Supabase, a mesma do Portal DP) no .env.local — veja .env.example.",
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
 * Schema das tabelas do SST — antes vivia no repositório separado
 * portal-sst; agora mora aqui, já que passaram a ocupar o banco do Portal DP.
 * `colab_id` referencia DIRETO a tabela `colaboradores` real (o Quadro) — sem
 * espelho: como é o mesmo banco, não faz sentido duplicar. `CREATE TABLE IF
 * NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` deixam isso idempotente, roda em
 * toda inicialização sem falhar num banco que já foi migrado.
 */
const ESQUEMA_EXTRA = `
  CREATE TABLE IF NOT EXISTS sst_fichas_epi (
    id text PRIMARY KEY,
    numero integer NOT NULL,
    colab_id integer NOT NULL REFERENCES colaboradores(id),
    entrega_ids text[] NOT NULL DEFAULT '{}',
    gerada_em timestamptz NOT NULL DEFAULT now(),
    gerada_por text NOT NULL,
    token text UNIQUE,
    status text NOT NULL DEFAULT 'aguardando',
    expira_em timestamptz,
    assinada_em timestamptz,
    assinatura jsonb,
    anexo_url text,
    anexo_nome text,
    -- Modelo antigo do Portal SST (PDF assinado à mão, anexado por upload) — a
    -- assinatura eletrônica usa token/status/assinatura acima; esta coluna só
    -- fica pra não perder compatibilidade com o que já existir.
    assinatura_storage_path text
  );
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS token text UNIQUE;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando';
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS expira_em timestamptz;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS assinada_em timestamptz;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS assinatura jsonb;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS anexo_url text;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS anexo_nome text;
  ALTER TABLE sst_fichas_epi ADD COLUMN IF NOT EXISTS assinatura_storage_path text;

  CREATE TABLE IF NOT EXISTS sst_entregas_epi (
    id text PRIMARY KEY,
    colab_id integer NOT NULL REFERENCES colaboradores(id),
    cpf text NOT NULL DEFAULT '',
    epi text NOT NULL,
    qtd integer NOT NULL DEFAULT 1,
    ca text NOT NULL DEFAULT '',
    valor_unit numeric NOT NULL DEFAULT 0,
    data_entrega text NOT NULL DEFAULT '',
    data_troca text NOT NULL DEFAULT '',
    responsavel text NOT NULL,
    ficha_id text REFERENCES sst_fichas_epi(id) ON DELETE CASCADE,
    ts text NOT NULL DEFAULT '',
    assinatura text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sst_fardamento_entregas (
    id text PRIMARY KEY,
    colab_id integer NOT NULL REFERENCES colaboradores(id),
    cpf text NOT NULL DEFAULT '',
    tipo text NOT NULL,
    qtd integer NOT NULL DEFAULT 1,
    valor_unit numeric NOT NULL DEFAULT 0,
    data_entrega text NOT NULL DEFAULT '',
    responsavel text NOT NULL,
    ficha_id text REFERENCES sst_fichas_epi(id) ON DELETE CASCADE,
    ts text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE sst_fardamento_entregas ADD COLUMN IF NOT EXISTS ficha_id text REFERENCES sst_fichas_epi(id) ON DELETE CASCADE;

  CREATE TABLE IF NOT EXISTS sst_epi_precos (
    equip text PRIMARY KEY,
    valor numeric NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sst_fardamento_precos (
    tipo text PRIMARY KEY,
    valor numeric NOT NULL
  );

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

/** Executa uma consulta contra as tabelas do SST e devolve as linhas já tipadas. */
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
