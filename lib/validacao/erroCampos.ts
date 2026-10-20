/**
 * Traduz o erro de validação das rotas (caminho técnico + mensagem em inglês do
 * zod) no rótulo que a pessoa vê na tela e em como corrigir o valor. Sem isto o
 * formulário mostrava só "Dados inválidos" e não havia como saber qual dos
 * setenta campos recusou o valor.
 */
export const ROTULO_CAMPO: Record<string, string> = {
  nome: "Nome",
  cpf: "CPF",
  pis: "PIS",
  dataNascimento: "Nascimento",
  dataAdmissao: "Admissão",
  dataDesligamento: "Desligamento",
  salarioBase: "Salário base",
  email: "E-mail",
  emailPessoal: "E-mail pessoal",
  telefone: "Telefone",
  cargo: "Cargo",
  departamento: "Setor",
  vinculo: "Vínculo",
  cbo: "CBO",
  horario: "Horário",
  banco: "Banco",
  agencia: "Agência",
  conta: "Conta",
  cep: "CEP",
  estado: "Estado",
  cidade: "Cidade",
  bairro: "Bairro",
  rua: "Rua",
  numero: "Número",
  sexo: "Sexo",
  cidadeNascimento: "Cidade de nascimento",
  ufNascimento: "UF de nascimento",
  nomePai: "Nome do pai",
  nomeMae: "Nome da mãe",
  alimentacaoValor: "Alimentação",
  odontologicoValor: "Odontológico",
  auxilioEducacaoValor: "Auxílio educação",
  tipoTransporte: "Transporte",
  valorTransporteDia: "Valor do VT (por dia útil)",
  valorTransporteFixo: "Valor do VM (fixo mensal)",
  periculosidadePercentual: "Periculosidade",
  insalubridadePercentual: "Insalubridade",
  adicionalFixo: "Adicional fixo",
  adicionalFixoDescricao: "Descrição do adicional fixo",
  conjugeNome: "Nome do cônjuge",
  conjugeCpf: "CPF do cônjuge",
  conjugeNascimento: "Nascimento do cônjuge",
  conjugeSexo: "Sexo do cônjuge",
  rg: "RG",
  rgEmissao: "Emissão do RG",
  cpfEmissao: "Emissão do CPF",
  pisEmissao: "Emissão do PIS",
  tituloEleitor: "Título de eleitor",
  tituloEleitorZona: "Zona do título",
  tituloEleitorSecao: "Seção do título",
  tituloEleitorEmissao: "Emissão do título",
  ctpsSerie: "Série da CTPS",
  ctpsUf: "UF da CTPS",
  ctpsEmissao: "Emissão da CTPS",
  cnhCategoria: "Categoria da CNH",
  cnhNumero: "Número da CNH",
  cnhValidade: "Validade da CNH",
  cnhEmissao: "Emissão da CNH",
  reservistaSerie: "Série do reservista",
  reservistaEmissao: "Emissão do reservista",
  deficiente: "Deficiente",
  deficienciaTipo: "Tipo de deficiência",
  nacionalidadePai: "Nacionalidade do pai",
  nacionalidadeMae: "Nacionalidade da mãe",
  escolaridade: "Escolaridade",
  tamanhoCamisa: "Tamanho de camisa",
  tamanhoCalca: "Tamanho de calça",
  tamanhoSapato: "Tamanho de sapato",
  valorRescisao: "Valor da rescisão",
  valorFgts: "Valor do FGTS",
  rateioD365: "Rateio D365",
  motivoDesligamento: "Motivo do desligamento",
  dependentes: "Dependentes",
  dependentesLista: "Dependente",
};

export interface DetalheValidacao {
  path?: PropertyKey[];
  code?: string;
  format?: string;
  message?: string;
}

/** Diz, em português, o que está errado e como preencher. */
function orientacao(d: DetalheValidacao, sub: string | undefined, raiz: string | undefined): string {
  if (raiz === "dependentesLista" && sub === "nome") return "informe o nome do dependente ou remova esse dependente";
  if (d.code === "invalid_format" && d.format === "date") {
    return "data inválida; escolha uma data real no calendário (dia/mês/ano, ex.: 15/03/1990)";
  }
  if (d.code === "invalid_value") return "escolha uma das opções oferecidas na lista";
  if (d.code === "too_small") return "campo obrigatório; preencha-o";
  if (d.code === "invalid_type") return "valor em formato incorreto; apague e digite novamente";
  return "valor inválido; confira o que foi digitado";
}

/** Monta a mensagem de erro nomeando os campos que a validação recusou e como corrigi-los. */
export function descreverErro(
  data: { erro?: string; detalhes?: DetalheValidacao[] },
  padrao = "Não foi possível salvar.",
): string {
  const detalhes = data.detalhes ?? [];
  if (detalhes.length === 0) return data.erro ?? padrao;

  const campos = detalhes.map((d) => {
    const caminho = (d.path ?? []).filter((p): p is string => typeof p === "string");
    const raiz = caminho[0];
    const rotulo = raiz ? (ROTULO_CAMPO[raiz] ?? raiz) : "campo desconhecido";
    // Caminho de dependente vem como ["dependentesLista", 1, "dataNascimento"] —
    // vira "Dependente 2 · Nascimento", que é o que se vê na tela.
    const indice = (d.path ?? []).find((p) => typeof p === "number");
    const sub = caminho[1];
    const prefixo = typeof indice === "number" ? `${rotulo} ${indice + 1}` : rotulo;
    const alvo = sub ? `${prefixo} · ${ROTULO_CAMPO[sub] ?? sub}` : prefixo;
    return `${alvo} (${orientacao(d, sub, raiz)})`;
  });

  const unicos = Array.from(new Set(campos));
  return `Confira ${unicos.length === 1 ? "o campo" : "os campos"}: ${unicos.join("; ")}.`;
}
