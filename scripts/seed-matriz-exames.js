// Popula sst_matriz_exames_funcao com a Matriz Ocupacional real (função → exames)
// que a Leslie repassou. Roda uma vez, direto contra o banco — não faz parte
// do build nem do runtime do app. Uso: node scripts/seed-matriz-exames.js
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

const AVAL = "AVALIAÇÃO CLINICA OCUPACIONAL";
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
const ROMBERG = "TESTE DE ROMBERG";

const BASE_ESCRITORIO = [AVAL, ECG];
const BASE_PRODUCAO_8 = [AUDIO, AVAL, ACUIDADE, ECG, HEMO, ESPIRO, RETIC, RX];
const BASE_MANUTENCAO_12 = [AUDIO, AVAL, ACUIDADE, PSICO, ECG, EEG, GLIC, HEMO, ESPIRO, RETIC, RX, ROMBERG];

const MATRIZ = {
  "Analista Administrativo": BASE_ESCRITORIO,
  "Analista De Engenharia": BASE_ESCRITORIO,
  "Analista De Engenharia De Processo": BASE_ESCRITORIO,
  "Analista De Engenharia De Produtos": BASE_ESCRITORIO,
  "Analista De Engenharia De Projetos": BASE_ESCRITORIO,
  "Analista De Gente E Gestão": BASE_ESCRITORIO,
  "Analista De Melhoria Contínua": BASE_ESCRITORIO,
  "Analista De Pcp": BASE_ESCRITORIO,
  "Analista De Qualidade": BASE_ESCRITORIO,
  "Analista Financeiro": BASE_ESCRITORIO,
  "Assistente De Controle Da Qualidade": BASE_ESCRITORIO,
  "Assistente De Operações De Vendas": BASE_ESCRITORIO,
  "Assistente De Pcp": BASE_ESCRITORIO,
  "Assistente De Rh": BASE_ESCRITORIO,
  "Assistente De Tecnologia Da Informação": BASE_ESCRITORIO,
  "Assistente De Vendas": BASE_ESCRITORIO,
  "Assistente Logístico": [AVAL, ECG, RX],
  "Auxiliar De Produção": BASE_PRODUCAO_8,
  "Auxiliar De Produção I": BASE_PRODUCAO_8,
  "Auxiliar De Produção II": BASE_PRODUCAO_8,
  "Auxiliar De Produção III": BASE_PRODUCAO_8,
  "Auxiliar De Serviços Gerais": [AVAL, ACUIDADE, ECG, HEMO, ESPIRO, RETIC, RX],
  "Coordenador (a) De Garantia Da Qualidade E Assuntos Regulatórios": BASE_ESCRITORIO,
  "Estagiário De Projetos": BASE_ESCRITORIO,
  "Inspetora Da Qualidade": BASE_PRODUCAO_8,
  "Jovem Aprendiz Administrativo": [AVAL],
  "Jovem Aprendiz De Logística": [AVAL, RX],
  "Líder De Manutenção": BASE_MANUTENCAO_12,
  "Supervisor (a) De Produção": BASE_PRODUCAO_8,
  "Supervisor De Vendas": BASE_ESCRITORIO,
  "Técnico Em Manutenção Geral": BASE_MANUTENCAO_12,
};

async function main() {
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const [funcao, exames] of Object.entries(MATRIZ)) {
      await pool.query(
        `INSERT INTO sst_matriz_exames_funcao (funcao, exames, atualizado_em) VALUES ($1, $2, now())
           ON CONFLICT (funcao) DO UPDATE SET exames = EXCLUDED.exames, atualizado_em = now()`,
        [funcao, exames],
      );
      console.log(`✓ ${funcao} — ${exames.length} exame(s)`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
