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
    valor numeric
  );
  -- CA (Certificado de Aprovação) que o RH informa ao cadastrar um EPI extra
  -- na matriz, pra quando o equip não está no catálogo estático (que já tem
  -- CA fixo). Nullable e independente de valor: um EPI pode ganhar CA sem
  -- ter preço definido ainda, e vice-versa.
  ALTER TABLE sst_epi_precos ALTER COLUMN valor DROP NOT NULL;
  ALTER TABLE sst_epi_precos ADD COLUMN IF NOT EXISTS ca text;

  CREATE TABLE IF NOT EXISTS sst_fardamento_precos (
    tipo text PRIMARY KEY,
    valor numeric NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sst_matriz_epi_extra (
    funcao text PRIMARY KEY,
    epis text[] NOT NULL DEFAULT '{}',
    atualizado_em timestamptz NOT NULL DEFAULT now()
  );

  -- Exames Ocupacionais: matriz função → exames obrigatórios (mesmo espírito
  -- da sst_matriz_epi_extra, mas sem "fixos" — aqui nada vem pré-cadastrado,
  -- o RH monta do zero pelo lápis da tela).
  CREATE TABLE IF NOT EXISTS sst_matriz_exames_funcao (
    funcao text PRIMARY KEY,
    exames text[] NOT NULL DEFAULT '{}',
    atualizado_em timestamptz NOT NULL DEFAULT now()
  );

  -- Cargos/funções fixas (FUNCOES_MATRIZ_EXAMES, no código) que a RH removeu
  -- pela tela — não apaga a constante, só marca pra sumir da listagem.
  CREATE TABLE IF NOT EXISTS sst_matriz_exames_removidas (
    funcao text PRIMARY KEY,
    removido_em timestamptz NOT NULL DEFAULT now()
  );

  -- Matriz Ocupacional antiga, por função — substituída pela Matriz
  -- Ocupacional por CARGO/setor (sst_cargos_ocupacionais) assim que a Leslie
  -- repassou a planilha real; fica só a tabela (vazia, sem uso) pra não
  -- perder histórico de uma versão que já rodou em produção.
  CREATE TABLE IF NOT EXISTS sst_matriz_riscos_funcao (
    funcao text PRIMARY KEY,
    riscos jsonb NOT NULL DEFAULT '[]',
    atualizado_em timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sst_exame_precos (
    codigo text PRIMARY KEY,
    valor numeric NOT NULL
  );

  -- Matriz Ocupacional por CARGO (não por função): setor → cargos → riscos
  -- (agente + frequência), EPIs aplicáveis e exames obrigatórios. Dado real
  -- da empresa, repassado pela Leslie (planilha do Portal SST antigo) — ver
  -- scripts/seed-cargos-ocupacionais.js.
  CREATE TABLE IF NOT EXISTS sst_cargos_ocupacionais (
    cargo text PRIMARY KEY,
    cbo text NOT NULL DEFAULT '',
    setor text NOT NULL,
    riscos jsonb NOT NULL DEFAULT '[]',
    epis text[] NOT NULL DEFAULT '{}',
    exames text[] NOT NULL DEFAULT '{}',
    atualizado_em timestamptz NOT NULL DEFAULT now()
  );

  -- Ficha de exame ocupacional (ASO): RH anexa o comprovante e marca quais
  -- exames vencidos foram feitos naquele atendimento — mesmo espírito da
  -- ficha de EPI, sem link de assinatura (é um registro do RH, não algo que
  -- o colaborador assina).
  CREATE TABLE IF NOT EXISTS sst_fichas_exame (
    id text PRIMARY KEY,
    colab_id integer NOT NULL REFERENCES colaboradores(id),
    tipo_aso text NOT NULL,
    anexo_url text,
    anexo_nome text,
    responsavel text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- Um exame feito, dentro de uma ficha. data_prevista já vem calculada
  -- (data_realizacao + periodicidade do catálogo, domain.ts) — não é campo
  -- que o RH preenche na tela.
  CREATE TABLE IF NOT EXISTS sst_exames_realizados (
    id text PRIMARY KEY,
    ficha_id text NOT NULL REFERENCES sst_fichas_exame(id) ON DELETE CASCADE,
    colab_id integer NOT NULL REFERENCES colaboradores(id),
    exame text NOT NULL,
    data_realizacao text NOT NULL DEFAULT '',
    data_prevista text,
    created_at timestamptz NOT NULL DEFAULT now()
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
