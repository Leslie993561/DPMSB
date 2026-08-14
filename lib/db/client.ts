import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const CAMINHO_DB = join(process.cwd(), "data", "portal-dp.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  data_admissao TEXT NOT NULL,
  salario_base REAL NOT NULL,
  dependentes INTEGER NOT NULL DEFAULT 0,
  cpf TEXT,
  email TEXT,
  cargo TEXT,
  departamento TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS periodos_aquisitivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  dias_direito INTEGER NOT NULL DEFAULT 30,
  abono_utilizado INTEGER NOT NULL DEFAULT 0,
  dias_abono INTEGER NOT NULL DEFAULT 0,
  UNIQUE(colaborador_id, data_inicio)
);

CREATE TABLE IF NOT EXISTS lancamentos_ferias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_aquisitivo_id INTEGER NOT NULL REFERENCES periodos_aquisitivos(id),
  origem TEXT NOT NULL CHECK (origem IN ('calculado','manual')),
  dias INTEGER NOT NULL,
  data_inicio_gozo TEXT,
  data_fim_gozo TEXT,
  abono INTEGER NOT NULL DEFAULT 0,
  dias_abono INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * Colunas adicionadas depois da criação inicial das tabelas. `CREATE TABLE IF
 * NOT EXISTS` não altera tabelas já existentes — por isso migramos via
 * `ALTER TABLE ADD COLUMN`, verificando antes (por `PRAGMA table_info`) se a
 * coluna já existe, para a migração poder rodar em toda inicialização sem
 * falhar num banco que já foi migrado.
 *
 * Os valores permitidos de `status` são validados na camada de aplicação
 * (lib/db/lancamentosFerias.ts, lib/db/periodosAquisitivos.ts), não via CHECK
 * — evita depender de detalhes de versão do SQLite para ALTER TABLE + CHECK.
 */
const MIGRACOES: { tabela: string; coluna: string; definicao: string }[] = [
  { tabela: "lancamentos_ferias", coluna: "status", definicao: "TEXT NOT NULL DEFAULT 'concluida'" },
  { tabela: "lancamentos_ferias", coluna: "data_inicio_prevista", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "data_retorno", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "data_baixa", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "observacao_baixa", definicao: "TEXT" },
  { tabela: "lancamentos_ferias", coluna: "anexo_nome", definicao: "TEXT" },
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
];

/**
 * Tabelas novas dos módulos Breakdown de Folha e Benefícios. Seguem o mesmo
 * padrão de `SCHEMA` (CREATE TABLE IF NOT EXISTS) — não entram em `MIGRACOES`
 * porque não alteram tabela existente.
 */
const SCHEMA_EXTRA = `
CREATE TABLE IF NOT EXISTS folha_breakdown (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(colaborador_id, competencia)
);

CREATE TABLE IF NOT EXISTS folha_extras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  vm REAL,
  odontologico REAL,
  solides REAL,
  flash REAL,
  bonificacao REAL,
  premiacao REAL,
  outros_custos REAL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(colaborador_id, competencia)
);

CREATE TABLE IF NOT EXISTS beneficios_rateio_extras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  vale_transporte REAL,
  vale_alimentacao REAL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(colaborador_id, competencia)
);

CREATE TABLE IF NOT EXISTS beneficios_variaveis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  competencia TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('transporte','mobilidade','alimentacao')),
  valor REAL NOT NULL,
  motivo TEXT,
  arquivo TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS beneficios_dias_uteis (
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  dias_uteis INTEGER NOT NULL,
  PRIMARY KEY (ano, mes)
);

CREATE TABLE IF NOT EXISTS colaborador_dependentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  nome TEXT NOT NULL,
  cpf TEXT,
  sexo TEXT,
  data_nascimento TEXT,
  certidao_livro TEXT,
  certidao_folha TEXT,
  certidao_matricula TEXT,
  certidao_data_emissao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function migrar(database: DatabaseSync): void {
  for (const { tabela, coluna, definicao } of MIGRACOES) {
    const colunas = database.prepare(`PRAGMA table_info(${tabela})`).all() as unknown as {
      name: string;
    }[];
    const jaExiste = colunas.some((c) => c.name === coluna);
    if (!jaExiste) {
      database.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
    }
  }
}

let db: DatabaseSync | null = null;

/**
 * Conexão SQLite singleton via `node:sqlite` (nativo do Node 22.5+, sem
 * dependência externa nem passo de build). O arquivo fica em `data/`,
 * ignorado pelo git — é estado local, não código.
 */
export function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  db = new DatabaseSync(CAMINHO_DB);
  db.exec(SCHEMA);
  migrar(db);
  db.exec(SCHEMA_EXTRA);
  return db;
}
