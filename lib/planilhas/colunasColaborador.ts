/**
 * Definição única das colunas da planilha de colaboradores, na mesma ordem e
 * agrupamento dos blocos da ficha (Dados pessoais → Dados profissionais →
 * Dados bancários → Benefícios → Endereço → Cônjuge → Dependentes).
 *
 * Compartilhada pela exportação e pelo modelo de importação de propósito: se
 * as duas listas fossem separadas, uma coluna nova entraria em uma e não na
 * outra, e a planilha exportada deixaria de servir para reimportar.
 */
export const COLUNAS_COLABORADOR = [
  // Dados pessoais
  { header: "Nome completo", key: "nome", width: 30 },
  { header: "CPF", key: "cpf", width: 16 },
  { header: "PIS", key: "pis", width: 16 },
  { header: "Nascimento", key: "dataNascimento", width: 14 },
  { header: "Cidade de nascimento", key: "cidadeNascimento", width: 20 },
  { header: "UF de nascimento", key: "ufNascimento", width: 10 },
  { header: "Nome do pai", key: "nomePai", width: 28 },
  { header: "Nome da mãe", key: "nomeMae", width: 28 },
  { header: "Telefone", key: "telefone", width: 16 },
  { header: "Sexo", key: "sexo", width: 12 },
  { header: "E-mail pessoal", key: "emailPessoal", width: 28 },
  // Dados profissionais
  { header: "E-mail profissional", key: "email", width: 28 },
  { header: "Cargo", key: "cargo", width: 20 },
  { header: "Departamento", key: "departamento", width: 22 },
  { header: "Vínculo", key: "vinculo", width: 12 },
  { header: "CBO", key: "cbo", width: 12 },
  { header: "Líder direto", key: "liderDireto", width: 22 },
  { header: "Salário", key: "salarioBase", width: 12 },
  { header: "Horário", key: "horario", width: 26 },
  { header: "Data de admissão", key: "dataAdmissao", width: 16 },
  { header: "Data de desligamento", key: "dataDesligamento", width: 18 },
  // Dados bancários
  { header: "Banco", key: "banco", width: 16 },
  { header: "Agência", key: "agencia", width: 12 },
  { header: "Conta", key: "conta", width: 14 },
  // Benefícios
  { header: "Alimentação", key: "alimentacaoValor", width: 14 },
  { header: "Tipo de transporte", key: "tipoTransporte", width: 18 },
  { header: "Valor do transporte", key: "valorTransporteFixo", width: 18 },
  // Endereço
  { header: "CEP", key: "cep", width: 12 },
  { header: "Estado", key: "estado", width: 10 },
  { header: "Cidade", key: "cidade", width: 18 },
  { header: "Bairro", key: "bairro", width: 20 },
  { header: "Rua", key: "rua", width: 30 },
  { header: "Número", key: "numero", width: 10 },
  // Cônjuge
  { header: "Cônjuge — Nome", key: "conjugeNome", width: 28 },
  { header: "Cônjuge — CPF", key: "conjugeCpf", width: 16 },
  { header: "Cônjuge — Nascimento", key: "conjugeNascimento", width: 20 },
];

/**
 * Um trio de colunas por dependente. A quantidade é sempre calculada de fora
 * (pelo colaborador que tem mais dependentes, na exportação; 1 no modelo) —
 * nunca fixa. A importação reconhece essas colunas pelo padrão do nome,
 * então acrescentar "Dependente 3 — ..." na planilha à mão funciona.
 */
export function colunasDependentes(quantidade: number) {
  const total = Math.max(quantidade, 1);
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    return [
      { header: `Dependente ${n} — Nome`, key: `dep${n}Nome`, width: 28 },
      { header: `Dependente ${n} — Nascimento`, key: `dep${n}Nascimento`, width: 20 },
      { header: `Dependente ${n} — CPF`, key: `dep${n}Cpf`, width: 16 },
    ];
  }).flat();
}
