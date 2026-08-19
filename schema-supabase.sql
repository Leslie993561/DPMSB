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
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  gestor_id INTEGER REFERENCES colaboradores(id),
  cidade TEXT,
  vinculo TEXT,
  alimentacao_valor REAL,
  data_nascimento TEXT,
  cbo TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_transporte TEXT NOT NULL DEFAULT 'vt_diario',
  valor_transporte_fixo REAL,
  lider_direto_nome TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  data_desligamento TEXT,
  motivo_desligamento TEXT,
  valor_rescisao REAL
);

CREATE TABLE IF NOT EXISTS periodos_aquisitivos (
  id SERIAL PRIMARY KEY,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  dias_direito INTEGER NOT NULL DEFAULT 30,
  abono_utilizado INTEGER NOT NULL DEFAULT 0,
  dias_abono INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
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
  criado_em TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
  status TEXT NOT NULL DEFAULT 'concluida',
  data_inicio_prevista TEXT,
  data_retorno TEXT,
  data_baixa TEXT,
  observacao_baixa TEXT,
  anexo_nome TEXT
);

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
