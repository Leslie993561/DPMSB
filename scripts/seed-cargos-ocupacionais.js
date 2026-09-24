// Popula sst_cargos_ocupacionais com a Matriz Ocupacional real por CARGO/setor
// (riscos + EPIs + exames), repassada pela Leslie (planilha do Portal SST
// antigo). Roda uma vez, direto contra o banco. Uso:
//   node scripts/seed-cargos-ocupacionais.js
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const envPath = path.join(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

// ---------- exames (nomes — periodicidade mora no catálogo, domain.ts) ----------
const AVAL = "AVALIAÇÃO CLINICA OCUPACIONAL";
const SANGUE = "GRUPO SANGUÍNEO / FATOR RH";
const ECG = "ECG";
const RX = "RAIO X - COLUNA LOMBAR";
const HEMO = "HEMOGRAMA COMPLETO";
const ACUIDADE = "ACUIDADE VISUAL";
const ESPIRO = "ESPIROMETRIA";
const RETIC = "RETICULOCITOS";
const AUDIO = "AUDIOMETRIA TONAL";
const GLIC = "GLICEMIA";
const PSICO = "AVALIAÇÃO PSICOSSOCIAL";
const EEG = "EEG";

const EXAMES_ESCRITORIO = [AVAL, SANGUE, ECG];
const EXAMES_LOGISTICA = [AVAL, SANGUE, RX, ECG];
const EXAMES_PRODUCAO_9 = [SANGUE, HEMO, AVAL, ACUIDADE, RX, ESPIRO, AUDIO, RETIC, ECG];
const EXAMES_MANUTENCAO_12 = [GLIC, SANGUE, HEMO, AVAL, PSICO, ACUIDADE, RX, RETIC, ESPIRO, AUDIO, ECG, EEG];
const EXAMES_SERVICOS_GERAIS = [AVAL, SANGUE, HEMO, ESPIRO, RX, ACUIDADE, RETIC, ECG];

// ---------- riscos (blocos reaproveitados entre cargos parecidos) ----------
const RISCO_ESCRITORIO_EVENTUAL = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Diferença de nível menor ou igual a dois metros", frequencia: "Eventual/Ocasional" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
];
const RISCO_ESCRITORIO_HABITUAL = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Diferença de nível menor ou igual a dois metros", frequencia: "Habitual" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
];
const RISCO_APRENDIZ_PRODUCAO = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Diferença de nível menor ou igual a dois metros", frequencia: "Habitual" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
  { tipo: "FÍSICOS", descricao: "Ruído", frequencia: "Habitual" },
];
const RISCO_ESTAGIARIO_PRODUCAO = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Batida contra", frequencia: "Intermitente" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
  { tipo: "FÍSICOS", descricao: "Ruído continuo ou intermitente", frequencia: "Eventual/Ocasional" },
  { tipo: "QUÍMICOS", descricao: "Produtos químicos", frequencia: "Intermitente" },
];
const RISCO_PRODUCAO_HABITUAL = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Batida contra", frequencia: "Intermitente" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
  { tipo: "FÍSICOS", descricao: "Ruído continuo ou intermitente", frequencia: "Habitual" },
  { tipo: "QUÍMICOS", descricao: "Produtos químicos", frequencia: "Intermitente" },
];
const RISCO_MANUTENCAO = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Batida contra", frequencia: "Intermitente" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
  { tipo: "FÍSICOS", descricao: "Ruído continuo ou intermitente", frequencia: "Intermitente" },
  { tipo: "QUÍMICOS", descricao: "Produtos químicos", frequencia: "Intermitente" },
];
const RISCO_LOGISTICA = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Diferença de nível menor ou igual a dois metros", frequencia: "Habitual" },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
];
const RISCO_SERVICOS_GERAIS = [
  { tipo: "ACIDENTES / MECÂNICOS", descricao: "Diferença de nível menor ou igual a dois metros", frequencia: "Intermitente" },
  {
    tipo: "BIOLÓGICOS",
    descricao: "Agentes biológicos infecciosos e infectocontagiosos (bactérias, vírus, protozoários, fungos, príons, parasitas e outros)",
    frequencia: "Habitual",
  },
  { tipo: "ERGONÔMICOS", descricao: "Trabalho em posturas incômodas ou pouco confortáveis por longos períodos", frequencia: "Habitual" },
  { tipo: "FÍSICOS", descricao: "Umidade", frequencia: "Habitual" },
  { tipo: "QUÍMICOS", descricao: "Produtos químicos", frequencia: "Habitual" },
];
const SEM_RISCO = [];

// ---------- EPIs (conjuntos reaproveitados) ----------
const EPI_PRODUCAO_LEVE = ["LUVA TÉRMICA", "PROTETOR AUDITIVO", "LUVAS DE PROTEÇÃO", "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL"];
const EPI_PRODUCAO_COMPLETO = [
  "CALÇADO ANTIDERRAPANTE",
  "LUVA TÉRMICA",
  "PROTETOR AUDITIVO",
  "LUVAS DE PROTEÇÃO",
  "ÓCULOS DE PROTEÇÃO",
  "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL",
  "OCULOS DE PROTEÇÃO UV",
];
const EPI_MANUTENCAO_ELETRICA = [
  "BOTAS COM BIQUEIRA DE PVC",
  "CAPACETE DE SEGURANÇA COM JUGULAR",
  "LUVAS DE PROTEÇÃO",
  "CINTO DE SEGURANÇA COM 2 TALABARTE",
  "ÓCULOS DE PROTEÇÃO",
  "PROTETOR AUDITIVO",
  "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL",
];
const EPI_MANUTENCAO_GERAL = [
  "BOTAS COM BIQUEIRA DE PVC",
  "CAPACETE DE SEGURANÇA COM JUGULAR",
  "LUVAS DE PROTEÇÃO",
  "CINTO DE SEGURANÇA COM 2 TALABARTE",
  "ÓCULOS DE PROTEÇÃO",
  "PROTETOR AUDITIVO",
  "UNIFORME COMPLETO",
  "MÁSCARA PFF2",
  "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL",
];
const EPI_SERVICOS_GERAIS = [
  "SAPATO ANTIDERRAPANTE",
  "CALÇADO ANTIDERRAPANTE",
  "LUVAS DE LÁTEX - MSB MEDICAL SYSTEM DO BRASIL",
  "MÁSCARA PFF2",
  "LUVAS DE LÁTEX",
];
const EPI_PD = ["PROTETOR AUDITIVO", "LUVAS DE PROTEÇÃO", "ÓCULOS DE PROTEÇÃO", "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL"];
const SEM_EPI = [];

function cargo(nome, cbo, setor, riscos, epis, exames) {
  return { cargo: nome, cbo, setor, riscos, epis, exames };
}

const CARGOS = [
  // ---------- Administrativo (17) ----------
  cargo("Analista Contábil", "252210", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Analista De Qualidade Júnior", "391210", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Aprendiz De Serviços De Produção", "411005", "Administrativo", RISCO_APRENDIZ_PRODUCAO, ["CALÇADO ANTIDERRAPANTE", "PROTETOR AUDITIVO"], EXAMES_ESCRITORIO),
  cargo("Assistente Administrativo", "411010", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente Contábil", "354125", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente De Pcp", "391125", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente De Tecnologia Da Informação", "313205", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente De Vendas Internas", "354125", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente Financeiro", "411010", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Conferente De Mercadorias", "414120", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Diretor Industrial Pró-Labore", "122205", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Estagiário Administrativo", "411010", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo(
    "Estagiário De Produção",
    "784205",
    "Administrativo",
    RISCO_ESTAGIARIO_PRODUCAO,
    ["CALÇADO ANTIDERRAPANTE", "LUVA TÉRMICA", "PROTETOR AUDITIVO", "LUVAS DE PROTEÇÃO", "ÓCULOS DE PROTEÇÃO", "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL", "OCULOS DE PROTEÇÃO UV"],
    EXAMES_PRODUCAO_9,
  ),
  cargo("Gerente Administrativo/Financeiro", "142105", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Jovem Aprendiz Administrativo", "411005", "Administrativo", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Menor Aprendiz", "411010", "Administrativo", SEM_RISCO, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Sócio", "121010", "Administrativo", SEM_RISCO, SEM_EPI, EXAMES_ESCRITORIO),

  // ---------- Comercial (4) ----------
  cargo("Assistente De Vendas", "354125", "Comercial", RISCO_ESCRITORIO_HABITUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Coordenador De Vendas Internas", "520110", "Comercial", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Especialista De Produtos", "520110", "Comercial", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Supervisor De Operações De Vendas", "520110", "Comercial", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),

  // ---------- Controle Da Qualidade (3) ----------
  cargo("Assistente De Controle Da Qualidade", "391205", "Controle Da Qualidade", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Estagiário De Controle De Qualidade", "391210", "Controle Da Qualidade", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Supervisora De Controle Da Qualidade", "391205", "Controle Da Qualidade", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),

  // ---------- Garantia Da Qualidade (1) ----------
  cargo("Analista De Qualidade", "391210", "Garantia Da Qualidade", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),

  // ---------- Garantia Da Qualidade E Assuntos Regulatórios (3) ----------
  cargo("Assistente Da Qualidade", "391215", "Garantia Da Qualidade E Assuntos Regulatórios", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Coordenador De Garantia Da Qualidade E Assuntos Regulatórios", "223405", "Garantia Da Qualidade E Assuntos Regulatórios", RISCO_ESCRITORIO_HABITUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo(
    "Supervisor Da Garantia Da Qualidade E Assuntos Regulatórios",
    "223405",
    "Garantia Da Qualidade E Assuntos Regulatórios",
    RISCO_ESCRITORIO_HABITUAL,
    SEM_EPI,
    EXAMES_PRODUCAO_9,
  ),

  // ---------- Logística (2) ----------
  cargo("Auxiliar De Estoque", "414105", "Logística", RISCO_LOGISTICA, ["CALÇADO ANTIDERRAPANTE"], EXAMES_LOGISTICA),
  cargo("Auxiliar De Logística", "414140", "Logística", RISCO_LOGISTICA, ["CALÇADO ANTIDERRAPANTE"], EXAMES_LOGISTICA),

  // ---------- P&D / Manutenção (5) ----------
  cargo("Analista De Pesquisa E Desenvolvimento Sr", "142605", "P&D / Manutenção", RISCO_PRODUCAO_HABITUAL, EPI_PD, EXAMES_ESCRITORIO),
  cargo("Auxiliar De P & D", "395105", "P&D / Manutenção", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Estagiário P&d", "395105", "P&D / Manutenção", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Técnico Em Manutenção Elétrica", "313120", "P&D / Manutenção", RISCO_MANUTENCAO, EPI_MANUTENCAO_ELETRICA, EXAMES_MANUTENCAO_12),
  cargo("Técnico Em Manutenção Geral", "514310", "P&D / Manutenção", RISCO_MANUTENCAO, EPI_MANUTENCAO_GERAL, EXAMES_MANUTENCAO_12),

  // ---------- Produção (11) ----------
  cargo("Analista De Estoque", "252725", "Produção", RISCO_LOGISTICA, ["CALÇADO ANTIDERRAPANTE"], EXAMES_LOGISTICA),
  cargo("Analista De Estoque Júnior", "252725", "Produção", RISCO_LOGISTICA, ["CALÇADO ANTIDERRAPANTE"], EXAMES_LOGISTICA),
  cargo(
    "Analista De Produção",
    "784205",
    "Produção",
    RISCO_PRODUCAO_HABITUAL,
    ["CALÇADO ANTIDERRAPANTE", "PROTETOR AUDITIVO", "LUVAS DE PROTEÇÃO", "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL", "LUVA PARA PROTEÇÃO CONTRA AGENTES MECÂNICOS"],
    EXAMES_PRODUCAO_9,
  ),
  cargo(
    "Analista De Produção Júnior",
    "784205",
    "Produção",
    RISCO_PRODUCAO_HABITUAL,
    ["CALÇADO ANTIDERRAPANTE", "PROTETOR AUDITIVO", "LUVAS DE PROTEÇÃO", "LUVA PARA PROTEÇÃO CONTRA AGENTES MECÂNICOS", "RESPIRADOR PURIFICADOR DE AR TIPO PEÇA UM QUARTO FACIAL"],
    EXAMES_PRODUCAO_9,
  ),
  cargo("Auxiliar De Produção", "784205", "Produção", RISCO_ESTAGIARIO_PRODUCAO, EPI_PRODUCAO_LEVE, EXAMES_PRODUCAO_9),
  cargo("Auxiliar De Produção I", "784205", "Produção", RISCO_ESTAGIARIO_PRODUCAO, EPI_PRODUCAO_COMPLETO, EXAMES_PRODUCAO_9),
  cargo("Auxiliar De Produção Ii", "784205", "Produção", RISCO_ESTAGIARIO_PRODUCAO, EPI_PRODUCAO_COMPLETO, EXAMES_PRODUCAO_9),
  cargo("Auxiliar De Produção Iii", "784205", "Produção", RISCO_ESTAGIARIO_PRODUCAO, EPI_PRODUCAO_COMPLETO, EXAMES_PRODUCAO_9),
  cargo("Auxiliar De Serviços Gerais", "514320", "Produção", RISCO_SERVICOS_GERAIS, EPI_SERVICOS_GERAIS, EXAMES_SERVICOS_GERAIS),
  cargo("Inspetora Da Qualidade", "391205", "Produção", RISCO_ESTAGIARIO_PRODUCAO, EPI_PRODUCAO_COMPLETO, EXAMES_PRODUCAO_9),
  cargo("Líder De Produção", "810305", "Produção", RISCO_ESTAGIARIO_PRODUCAO, EPI_PRODUCAO_COMPLETO, EXAMES_PRODUCAO_9),

  // ---------- Projetos (7) ----------
  cargo("Analista De Projetos", "142605", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente De Melhoria Contínua", "317110", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente De Projeto De Produto", "317110", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Assistente De Projetos", "317110", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Auxiliar De Projetos", "395105", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Estagiário De Projetos", "214420", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Supervisor De Projetos", "317110", "Projetos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),

  // ---------- Recursos Humanos (3) ----------
  cargo("Analista De Gente E Gestão", "252405", "Recursos Humanos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Analista De Rh", "252405", "Recursos Humanos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
  cargo("Analista De Rh Júnior", "252405", "Recursos Humanos", RISCO_ESCRITORIO_EVENTUAL, SEM_EPI, EXAMES_ESCRITORIO),
];

async function main() {
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const c of CARGOS) {
      await pool.query(
        `INSERT INTO sst_cargos_ocupacionais (cargo, cbo, setor, riscos, epis, exames, atualizado_em)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
         ON CONFLICT (cargo) DO UPDATE SET
           cbo = EXCLUDED.cbo, setor = EXCLUDED.setor, riscos = EXCLUDED.riscos,
           epis = EXCLUDED.epis, exames = EXCLUDED.exames, atualizado_em = now()`,
        [c.cargo, c.cbo, c.setor, JSON.stringify(c.riscos), c.epis, c.exames],
      );
      console.log(`✓ [${c.setor}] ${c.cargo}`);
    }
    console.log(`\n${CARGOS.length} cargo(s) gravado(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
