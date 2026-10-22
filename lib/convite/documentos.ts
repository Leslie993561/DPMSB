/**
 * Documentos pessoais que o colaborador/candidato anexa pelo link de
 * auto-cadastro. Sem "server-only" de propósito: o mesmo catálogo serve a
 * tela pública (lista + clipe) e a validação nas rotas.
 *
 * Nenhum item é obrigatório — o que faltar só aparece em vermelho.
 */
export type FormatoAceito = "pdf" | "foto";

export interface DocumentoConvite {
  chave: string;
  nome: string;
  /** Regra/observação mostrada embaixo do nome (a "pegadinha" de cada item). */
  dica?: string;
  /** "foto" = JPG/PNG (foto 3x4); padrão = só PDF. */
  formato?: FormatoAceito;
}

export const DOCUMENTOS_PESSOAIS: DocumentoConvite[] = [
  { chave: "curriculo", nome: "Currículo Profissional Atualizado" },
  { chave: "foto_3x4", nome: "1 foto modelo 3x4 — digital", dica: "Foto digital em JPG ou PNG, de frente e com fundo claro.", formato: "foto" },
  { chave: "declaracao_escola", nome: "Declaração da escola dos filhos de 7 a 14 anos", dica: "Precisa estar com a data atual (do ano vigente)." },
  { chave: "conta_bancaria", nome: "Conta Bancária (Bradesco)", dica: "Comprovante da conta no Bradesco (cartão ou extrato com agência e conta)." },
  { chave: "carta_recomendacao", nome: "Carta de recomendação do último emprego" },
  { chave: "ctps", nome: "Cópia da CTPS — 1ª folha frente e verso", dica: "Anexe frente e verso em um único PDF." },
  { chave: "identidade", nome: "Identidade", dica: "Frente e verso em um único PDF." },
  { chave: "cpf", nome: "CPF" },
  { chave: "habilitacao", nome: "Habilitação", dica: "Confira se está dentro da validade." },
  { chave: "titulo_eleitor", nome: "Título de eleitor" },
  { chave: "reservista", nome: "Reservista (para homens)" },
  { chave: "pis", nome: "Cartão do PIS ou nº" },
  {
    chave: "comprovante_residencia",
    nome: "Comprovante de residência",
    dica: "Se não estiver no nome do candidato, dos pais ou do cônjuge, anexe também a declaração de residência.",
  },
  { chave: "escolaridade", nome: "Comprovante de escolaridade" },
  { chave: "certidao_casamento", nome: "Certidão de casamento ou doc. união estável" },
  { chave: "cpf_conjuge", nome: "CPF do cônjuge ou companheiro(a)" },
  { chave: "certidao_filhos", nome: "Certidão de nascimento dos filhos", dica: "Um arquivo por filho (ou todos juntos em um PDF)." },
  { chave: "cpf_filhos", nome: "CPF dos filhos" },
  { chave: "vacina_filhos", nome: "Cartão de vacina — filhos menores de 7 anos" },
  { chave: "laudo_pcd", nome: "Laudo Médico Caracterizador para PCD" },
  { chave: "certificados", nome: "Certificados de Cursos (conforme função)" },
  { chave: "termo_estagio", nome: "Termo de Compromisso de Estágio", dica: "Somente para estagiários." },
];

/** Bloco "Estrangeiro" — itens de anexo; os campos (data, sim/não, visto) ficam em ESTRANGEIRO_CAMPOS. */
export const DOCUMENTOS_ESTRANGEIRO: DocumentoConvite[] = [
  { chave: "est_data_chegada", nome: "Documento de data de chegada ao Brasil" },
  { chave: "est_rne", nome: "Carteira RNE" },
];

export const TODOS_DOCUMENTOS: DocumentoConvite[] = [...DOCUMENTOS_PESSOAIS, ...DOCUMENTOS_ESTRANGEIRO];

export function buscarDocumentoConvite(chave: string): DocumentoConvite | undefined {
  return TODOS_DOCUMENTOS.find((d) => d.chave === chave);
}

export const VISTOS = ["Temporário", "Permanente", "Turista"] as const;

export interface DadosEstrangeiro {
  dataNaturalizacao: string | null;
  casadoComBrasileiro: boolean | null;
  filhoComBrasileiro: boolean | null;
  visto: (typeof VISTOS)[number] | null;
}

export const REGRAS_ANEXO = {
  tamanhoMaxBytes: 10 * 1024 * 1024,
  maxArquivosPorItem: 5,
  maxArquivosTotal: 60,
} as const;

export const TIPOS_MIME: Record<FormatoAceito, string[]> = {
  pdf: ["application/pdf"],
  foto: ["image/jpeg", "image/png"],
};

export const ACCEPT_HTML: Record<FormatoAceito, string> = {
  pdf: "application/pdf,.pdf",
  foto: "image/jpeg,image/png,.jpg,.jpeg,.png",
};
