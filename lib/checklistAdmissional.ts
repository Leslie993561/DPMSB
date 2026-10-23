/** Estrutura do "Check list do processo admissional" (aba Check list do colaborador). O estado marcado/preenchido
 *  fica em `colaborador_checklist` (lib/db/colaboradorChecklist.ts) como { [chave]: true | texto }. */

export interface ItemChecklist {
  /** Chave estável usada no estado salvo — não mudar depois de publicado. */
  chave: string;
  rotulo: string;
  /** Linhas de apoio exibidas abaixo do item (não são marcáveis). */
  detalhes?: string[];
  /** Observação em itálico. */
  nota?: string;
  /** Campos de data/texto ligados ao item (ex.: "Término do contrato"). */
  campos?: { chave: string; rotulo: string; tipo: "date" | "text" }[];
}

export interface BlocoChecklist {
  titulo?: string;
  itens: ItemChecklist[];
}

export interface SecaoChecklist {
  titulo: string;
  blocos: BlocoChecklist[];
}

export const SECOES_CHECKLIST: SecaoChecklist[] = [
  {
    titulo: "Documentação e contato inicial",
    blocos: [
      {
        itens: [
          { chave: "doc_link_portal_dp", rotulo: "Enviar link de cadastro de colaborador Portal DP" },
          { chave: "doc_link_flash", rotulo: "Enviar link de cadastro de colaborador Flash" },
          {
            chave: "doc_enviar_admissionais",
            rotulo: "Enviar documentos admissionais ao novo colaborador",
            detalhes: [
              "Carta Proposta",
              "Formulário de inscrição de colaborador",
              "Lista de documentos admissionais",
              "Carta de Abertura de conta",
              "Arte com benefícios",
            ],
          },
        ],
      },
    ],
  },
  {
    titulo: "Solicitar e conferir documentos admissionais",
    blocos: [
      {
        itens: [
          { chave: "adm_curriculo", rotulo: "Currículo profissional atualizado" },
          { chave: "adm_foto", rotulo: "1 foto modelo 3x4 - digital" },
          { chave: "adm_escola_filhos", rotulo: "Declaração da escola dos filhos de 7 a 14 anos (ver data atual)" },
          { chave: "adm_conta_bancaria", rotulo: "Conta bancária (Bradesco)" },
          { chave: "adm_carta_recomendacao", rotulo: "Carta de recomendação do último emprego" },
          { chave: "adm_ctps", rotulo: "Cópia da CTPS – 1ª folha frente e verso" },
          { chave: "adm_identidade", rotulo: "Identidade" },
          { chave: "adm_cpf", rotulo: "CPF" },
          { chave: "adm_habilitacao", rotulo: "Habilitação (ver validade)" },
          { chave: "adm_titulo_eleitor", rotulo: "Título de eleitor" },
          { chave: "adm_reservista", rotulo: "Reservista (para homens)" },
          { chave: "adm_pis", rotulo: "Cartão do PIS ou nº" },
          {
            chave: "adm_comprovante_residencia",
            rotulo: "Comprovante de residência",
            nota: "Caso não seja no nome do candidato, pais ou cônjuge, preencher declaração.",
          },
          { chave: "adm_escolaridade", rotulo: "Comprovante de escolaridade" },
          { chave: "adm_certidao_casamento", rotulo: "Certidão de casamento ou doc. união estável" },
          { chave: "adm_cpf_conjuge", rotulo: "CPF do cônjuge ou companheiro(a)" },
          { chave: "adm_certidao_filhos", rotulo: "Certidão de nascimento dos filhos" },
          { chave: "adm_cpf_filhos", rotulo: "CPF dos filhos" },
          { chave: "adm_vacina_filhos", rotulo: "Cartão de vacina filhos menores de 7 anos" },
          { chave: "adm_laudo_pcd", rotulo: "Laudo médico caracterizador para PCD" },
          { chave: "adm_certificados", rotulo: "Certificados de cursos (conforme função)" },
        ],
      },
      {
        titulo: "Estágio / Aprendiz",
        itens: [
          {
            chave: "adm_termo_estagio",
            rotulo: "Termo de compromisso de estágio",
            campos: [{ chave: "adm_termo_estagio_fim", rotulo: "Término do contrato", tipo: "date" }],
          },
          {
            chave: "adm_contrato_aprendiz",
            rotulo: "Contrato do aprendiz",
            campos: [
              { chave: "adm_contrato_aprendiz_fim", rotulo: "Término do contrato", tipo: "date" },
              { chave: "adm_contrato_aprendiz_inicio", rotulo: "Início na empresa", tipo: "date" },
            ],
          },
        ],
      },
      {
        titulo: "Exame médico",
        itens: [
          {
            chave: "adm_aso",
            rotulo: "Exame médico admissional – ASO",
            nota: "Ver data atual e assinatura do candidato.",
            campos: [{ chave: "adm_aso_data", rotulo: "Data da realização", tipo: "date" }],
          },
        ],
      },
      {
        titulo: "Estrangeiro",
        itens: [
          { chave: "est_data_chegada", rotulo: "Documento de data de chegada ao Brasil" },
          { chave: "est_naturalizacao", rotulo: "Data da naturalização" },
          { chave: "est_casado_brasileiro", rotulo: "Casado com brasileiro(a)" },
          { chave: "est_filho_brasileiro", rotulo: "Filho com brasileiro(a)" },
          { chave: "est_visto_temporario", rotulo: "Visto temporário" },
          { chave: "est_visto_permanente", rotulo: "Visto permanente" },
          { chave: "est_visto_turista", rotulo: "Visto de turista" },
          { chave: "est_rne", rotulo: "Carteira RNE" },
        ],
      },
    ],
  },
  {
    titulo: "Cadastro e acessos",
    blocos: [
      {
        titulo: "TI / Zendesk",
        itens: [
          {
            chave: "cad_acessos_ti",
            rotulo: "Solicitar acessos ao TI/Zendesk",
            detalhes: [
              "Nome completo",
              "CPF",
              "RG",
              "Data de nascimento",
              "Data de admissão",
              "Cargo",
              "Líder imediato",
              "Departamento",
              "Centro de custo",
              "Estabelecimento fiscal",
              "Acessos/ativos",
            ],
          },
        ],
      },
      {
        titulo: "Departamento Pessoal",
        itens: [
          {
            chave: "cad_comunicado_admissao",
            rotulo: "Enviar à ARH o comunicado de admissão",
            nota: "Tem que ser enviado em até 3 dias úteis antes da data de início do colaborador.",
          },
        ],
      },
      {
        titulo: "Plataformas",
        itens: [
          { chave: "plat_solides", rotulo: "Sólides" },
          { chave: "plat_flash", rotulo: "Flash" },
          { chave: "plat_peopleflow", rotulo: "PeopleFlow" },
          { chave: "plat_sst", rotulo: "SST" },
          { chave: "plat_portal_dp", rotulo: "Portal DP" },
        ],
      },
    ],
  },
  {
    titulo: "Treinamentos e controles",
    blocos: [
      {
        itens: [
          {
            chave: "trn_matriz",
            rotulo: "Enviar ao líder a Matriz de Treinamento para",
            detalhes: ["Agendar treinamentos", "Criar controle de treinamentos"],
          },
          { chave: "trn_pgr_epis", rotulo: "Verificar PGR para EPIs" },
          { chave: "trn_controle_epi", rotulo: "Criar controle de EPI" },
          { chave: "trn_fardamentos", rotulo: "Solicitar fardamentos, se necessário" },
        ],
      },
    ],
  },
  {
    titulo: "Onboarding",
    blocos: [
      {
        titulo: "Durante",
        itens: [
          { chave: "onb_tag_kit", rotulo: "Entrega da TAG e Kit Onboarding" },
          {
            chave: "onb_assinaturas",
            rotulo: "Assinatura do",
            detalhes: [
              "Termo de opção de transporte/alimentação",
              "Termo de opção de auxílio combustível",
              "Termo de acordo de banco de horas",
              "Autorização do uso de imagem",
              "Ficha de emergência",
            ],
          },
          { chave: "onb_ficha_epi", rotulo: "Assinatura da Ficha de EPI, se necessário" },
          { chave: "onb_apresentacao", rotulo: "Apresentação da empresa" },
        ],
      },
      {
        titulo: "Após",
        itens: [
          { chave: "apos_whatsapp", rotulo: "Adicionar ao grupo de WhatsApp" },
          { chave: "apos_comunicado_solides", rotulo: "Criar comunicado de novo colaborador na Sólides" },
          { chave: "apos_confirmar_treinamentos", rotulo: "Confirmar com o gestor os treinamentos" },
          { chave: "apos_controles_treinamentos", rotulo: "Criar controles dos mesmos treinamentos" },
          { chave: "apos_totalpass", rotulo: "Cadastro do TotalPass" },
        ],
      },
    ],
  },
];

export type EstadoChecklist = Record<string, boolean | string>;

/** Chaves marcáveis (exclui campos de data/texto) — usado para o contador de progresso. */
export function chavesMarcaveis(): string[] {
  return SECOES_CHECKLIST.flatMap((s) => s.blocos.flatMap((b) => b.itens.map((i) => i.chave)));
}
