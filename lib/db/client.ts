import "server-only";
import { Pool, type PoolClient } from "pg";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS colaboradores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  data_admissao TEXT NOT NULL,
  salario_base REAL NOT NULL,
  dependentes INTEGER NOT NULL DEFAULT 0,
  cpf TEXT,
  email TEXT,
  cargo TEXT,
  departamento TEXT,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS periodos_aquisitivos (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  dias_direito INTEGER NOT NULL DEFAULT 30,
  abono_utilizado INTEGER NOT NULL DEFAULT 0,
  dias_abono INTEGER NOT NULL DEFAULT 0,
  UNIQUE(colaborador_id, data_inicio)
);

CREATE TABLE IF NOT EXISTS lancamentos_ferias (
  id SERIAL PRIMARY KEY,
  periodo_aquisitivo_id INTEGER NOT NULL REFERENCES periodos_aquisitivos(id),
  origem TEXT NOT NULL CHECK (origem IN ('calculado','manual')),
  dias INTEGER NOT NULL,
  data_inicio_gozo TEXT,
  data_fim_gozo TEXT,
  abono INTEGER NOT NULL DEFAULT 0,
  dias_abono INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
`;

/**
 * Colunas adicionadas depois da criação inicial das tabelas. `CREATE TABLE IF
 * NOT EXISTS` não altera tabelas já existentes — por isso migramos via
 * `ALTER TABLE ADD COLUMN`, verificando antes (via `information_schema`) se a
 * coluna já existe, para a migração poder rodar em toda inicialização sem
 * falhar num banco que já foi migrado.
 *
 * Os valores permitidos de `status` são validados na camada de aplicação
 * (lib/db/lancamentosFerias.ts, lib/db/periodosAquisitivos.ts), não via CHECK
 * — evita depender de detalhes de versão do banco para ALTER TABLE + CHECK.
 */
const MIGRACOES: { tabela: string; coluna: string; definicao: string }[] = [
  { tabela: "lancamentos_ferias", coluna: "status", definicao: "TEXT NOT NULL DEFAULT 'concluida'" },
  { tabela: "lancamentos_ferias", coluna: "data_inicio_prevista", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "data_retorno", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "data_baixa", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "observacao_baixa", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "anexo_nome", definicao: "TEXT" },
  // Datas do abono pecuniário. O relatório "Relação de Férias Calculadas" traz
  // o abono como um intervalo próprio, separado do intervalo de gozo — sem
  // estas colunas só a quantidade de dias caberia, e o histórico perderia
  // quando o abono foi pago.
  { tabela: "lancamentos_ferias", coluna: "abono_inicio", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "abono_fim", definicao: "TEXT" },
  { tabela: "periodos_aquisitivos", coluna: "status", definicao: "TEXT NOT NULL DEFAULT 'aberto'" },
  { tabela: "colaboradores", coluna: "gestor_id", definicao: "INTEGER REFERENCES colaboradores(id)" },
  { tabela: "colaboradores", coluna: "cidade", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "vinculo", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "alimentacao_valor", definicao: "REAL" },
  { tabela: "colaboradores", coluna: "data_nascimento", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "cbo", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "agencia", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "conta", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "tipo_transporte", definicao: "TEXT NOT NULL DEFAULT 'vt_diario'" },
  { tabela: "colaboradores", coluna: "valor_transporte_fixo", definicao: "REAL" },
  { tabela: "colaboradores", coluna: "lider_direto_nome", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "status", definicao: "TEXT NOT NULL DEFAULT 'ativo'" },
  { tabela: "colaboradores", coluna: "data_desligamento", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "motivo_desligamento", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "valor_rescisao", definicao: "REAL" },
  // Dados pessoais
  { tabela: "colaboradores", coluna: "pis", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "cidade_nascimento", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "uf_nascimento", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "nome_pai", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "nome_mae", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "telefone", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "sexo", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "email_pessoal", definicao: "TEXT" },
  // Dados profissionais
  { tabela: "colaboradores", coluna: "horario", definicao: "TEXT" },
  // Dados bancários
  { tabela: "colaboradores", coluna: "banco", definicao: "TEXT" },
  // Endereço
  { tabela: "colaboradores", coluna: "cep", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "estado", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "bairro", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "rua", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "numero", definicao: "TEXT" },
  // Cônjuge (1:1 — diferente de dependentes, que são vários e vivem em tabela própria)
  { tabela: "colaboradores", coluna: "conjuge_nome", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "conjuge_cpf", definicao: "TEXT" },
  { tabela: "colaboradores", coluna: "conjuge_nascimento", definicao: "TEXT" },
  // Adicionais de salário. Percentuais e não valores: periculosidade incide
  // sobre o salário base (Art. 193 §1º) e insalubridade sobre o salário mínimo
  // (Art. 192) — guardar o valor calculado congelaria um número que muda com
  // dissídio e com o mínimo do ano.
  { tabela: "colaboradores", coluna: "periculosidade_percentual", definicao: "REAL" },
  { tabela: "colaboradores", coluna: "insalubridade_percentual", definicao: "REAL" },
  { tabela: "colaboradores", coluna: "adicional_fixo", definicao: "REAL" },
  { tabela: "colaboradores", coluna: "adicional_fixo_descricao", definicao: "TEXT" },
  // Hora extra e afins do Relatório detalhado. Vão em MIGRACOES e não no
  // CREATE TABLE porque folha_extras já existe em produção — o IF NOT EXISTS
  // não acrescenta coluna a uma tabela criada antes.
  { tabela: "folha_extras", coluna: "hora_extra_50", definicao: "REAL" },
  { tabela: "folha_extras", coluna: "hora_extra_100", definicao: "REAL" },
  { tabela: "folha_extras", coluna: "desconto_horas", definicao: "REAL" },
  { tabela: "folha_extras", coluna: "hora_noturna", definicao: "REAL" },
];

/**
 * Tabelas novas dos módulos Breakdown de Folha e Benefícios. Seguem o mesmo
 * padrão de `SCHEMA` (CREATE TABLE IF NOT EXISTS) — não entram em `MIGRACOES`
 * porque não alteram tabela existente.
 */
const SCHEMA_EXTRA = `
CREATE TABLE IF NOT EXISTS folha_breakdown (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  salario_base REAL NOT NULL,
  inss REAL NOT NULL,
  irrf REAL NOT NULL,
  fgts REAL NOT NULL,
  provisao_decimo_terceiro REAL NOT NULL DEFAULT 0,
  vale_transporte REAL NOT NULL DEFAULT 0,
  vale_alimentacao REAL NOT NULL DEFAULT 0,
  outros_beneficios REAL NOT NULL DEFAULT 0,
  premiacao REAL NOT NULL DEFAULT 0,
  custo_total REAL NOT NULL,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(colaborador_id, competencia)
);

CREATE TABLE IF NOT EXISTS folha_extras (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  vm REAL,
  odontologico REAL,
  solides REAL,
  flash REAL,
  bonificacao REAL,
  premiacao REAL,
  outros_custos REAL,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(colaborador_id, competencia)
);

CREATE TABLE IF NOT EXISTS beneficios_rateio_extras (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  vale_transporte REAL,
  vale_alimentacao REAL,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(colaborador_id, competencia)
);

CREATE TABLE IF NOT EXISTS beneficios_variaveis (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('transporte','mobilidade','alimentacao')),
  valor REAL NOT NULL,
  motivo TEXT,
  arquivo TEXT,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS beneficios_dias_uteis (
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  dias_uteis INTEGER NOT NULL,
  PRIMARY KEY (ano, mes)
);

CREATE TABLE IF NOT EXISTS colaborador_dependentes (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  nome TEXT NOT NULL,
  cpf TEXT,
  sexo TEXT,
  data_nascimento TEXT,
  certidao_livro TEXT,
  certidao_folha TEXT,
  certidao_matricula TEXT,
  certidao_data_emissao TEXT,
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);
`;

/**
 * Camada de compatibilidade com a API usada por todo o resto de `lib/db/*.ts`
 * (`execute`/`executeMultiple`/`batch` no estilo libSQL) — evita reescrever as
 * ~13 outras camadas de acesso ao banco só por causa da troca de driver.
 */
export interface ResultSetLike {
  rows: Record<string, unknown>[];
  rowsAffected: number;
  lastInsertRowid: number | undefined;
}

interface StatementLike {
  sql: string;
  args?: unknown[];
}

export interface ClientLike {
  execute(stmt: StatementLike | string): Promise<ResultSetLike>;
  executeMultiple(sql: string): Promise<void>;
  batch(stmts: (StatementLike | string)[], mode?: string): Promise<ResultSetLike[]>;
}

/** SQLite/libSQL usa `?` posicional; o driver `pg` exige `$1, $2, ...`. */
function paraPlaceholdersPg(sql: string): string {
  let indice = 0;
  return sql.replace(/\?/g, () => `$${++indice}`);
}

function normalizarStmt(stmt: StatementLike | string): { sql: string; args: unknown[] } {
  if (typeof stmt === "string") return { sql: stmt, args: [] };
  return { sql: stmt.sql, args: stmt.args ?? [] };
}

/** Toda tabela desse schema usa `id` como chave primária — INSERTs sem RETURNING não têm como devolver o id gerado. */
function precisaRetornarId(sql: string): boolean {
  return /^\s*insert\s+into/i.test(sql) && !/\breturning\b/i.test(sql);
}

interface Queryable {
  query(sql: string, args?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

async function executarUm(conexao: Queryable, stmt: StatementLike | string): Promise<ResultSetLike> {
  const { sql, args } = normalizarStmt(stmt);
  const comRetorno = precisaRetornarId(sql) ? `${sql} RETURNING id` : sql;
  const resultado = await conexao.query(paraPlaceholdersPg(comRetorno), args);
  return {
    rows: resultado.rows,
    rowsAffected: resultado.rowCount ?? 0,
    lastInsertRowid: comRetorno !== sql ? Number(resultado.rows[0]?.id) : undefined,
  };
}

class ClientPostgres implements ClientLike {
  constructor(private pool: Pool) {}

  async execute(stmt: StatementLike | string): Promise<ResultSetLike> {
    return executarUm(this.pool, stmt);
  }

  /** Statements crus separados por `;` (scripts de schema/migração) — protocolo simples do Postgres já executa todos numa chamada. */
  async executeMultiple(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  /**
   * Sem suporte nativo a batch atômico no `pg` — abre uma transação manual
   * (BEGIN/COMMIT/ROLLBACK). Os statements são disparados sem `await` entre
   * eles (`Promise.all`) para ficarem em pipeline na mesma conexão — em vez
   * de pagar uma ida-e-volta de rede por statement (relevante com dezenas ou
   * centenas deles contra um banco remoto), paga uma só para o lote inteiro.
   */
  async batch(stmts: (StatementLike | string)[]): Promise<ResultSetLike[]> {
    const conexao: PoolClient = await this.pool.connect();
    try {
      await conexao.query("BEGIN");
      const resultados = await Promise.all(stmts.map((stmt) => executarUm(conexao, stmt)));
      await conexao.query("COMMIT");
      return resultados;
    } catch (erro) {
      await conexao.query("ROLLBACK");
      throw erro;
    } finally {
      conexao.release();
    }
  }
}

async function colunaExiste(pool: Pool, tabela: string, coluna: string): Promise<boolean> {
  const resultado = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    [tabela, coluna],
  );
  return (resultado.rowCount ?? 0) > 0;
}

async function migrar(pool: Pool): Promise<void> {
  for (const { tabela, coluna, definicao } of MIGRACOES) {
    if (!(await colunaExiste(pool, tabela, coluna))) {
      await pool.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    }
  }
}

/** Connection string do Postgres (Supabase) — obrigatória em qualquer ambiente, inclusive dev local. */
function resolverConnectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Defina DATABASE_URL (connection string do Postgres/Supabase) no .env.local — veja .env.example.",
    );
  }
  return url;
}

/**
 * O singleton mora no `globalThis`, e não em um módulo. Em desenvolvimento o
 * hot-reload reavalia este arquivo a cada alteração salva, e um singleton de
 * módulo criaria um Pool novo em cada reavaliação sem fechar o anterior — as
 * conexões vazam até estourar o limite do pooler do Supabase (15 clientes),
 * e aí a aplicação inteira passa a responder 500 até reiniciar o servidor.
 */
interface CacheDb {
  client: ClientLike | null;
  inicializando: Promise<ClientLike> | null;
}

const globalDb = globalThis as typeof globalThis & { __portalDpDb?: CacheDb };
const cache: CacheDb = (globalDb.__portalDpDb ??= { client: null, inicializando: null });

/** Cliente Postgres singleton, com a mesma API (`execute`/`executeMultiple`/`batch`) usada por todo o resto de lib/db. */
export async function getDb(): Promise<ClientLike> {
  if (cache.client) return cache.client;
  if (!cache.inicializando) {
    cache.inicializando = (async () => {
      const pool = new Pool({
        connectionString: resolverConnectionString(),
        ssl: { rejectUnauthorized: false },
        // Teto por instância. O pooler do Supabase aceita 15 clientes no total,
        // e a aplicação divide esse número com qualquer outra coisa conectada
        // ao mesmo banco — pedir menos evita derrubar todo mundo em um pico.
        max: 8,
        idleTimeoutMillis: 30_000,
      });
      try {
        await pool.query(SCHEMA);
        await migrar(pool);
        await pool.query(SCHEMA_EXTRA);
      } catch (erro) {
        // Sem isto, uma falha na inicialização deixaria a promessa rejeitada
        // em cache e toda chamada seguinte falharia com o mesmo erro antigo.
        cache.inicializando = null;
        await pool.end().catch(() => {});
        throw erro;
      }
      const novoClient = new ClientPostgres(pool);
      cache.client = novoClient;
      return novoClient;
    })();
  }
  return cache.inicializando;
}
