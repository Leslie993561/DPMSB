# Portal Inteligente de Departamento Pessoal

Portal web para rotinas de Departamento Pessoal (férias, folha, rescisão) com assistente de IA
para interpretação, base legal e sinalização de riscos.

## Princípio de arquitetura

**Números de folha de pagamento nunca são calculados pelo LLM.**

- Toda a matemática (INSS, IRRF, FGTS, férias, 13º, aviso prévio, rescisão) roda em funções puras
  e testáveis em `lib/calc/`, com tabelas legais versionadas por ano em `lib/legal-tables/`.
- O Claude atua como camada de interpretação: explica, cita base legal, aponta riscos e monta
  checklists. Quando um cálculo é necessário, ele **chama uma ferramenta** (tool use) que executa
  a mesma função determinística usada pelos formulários — nunca faz a conta "de cabeça".
- A interface renderiza os valores a partir do retorno das ferramentas, não do texto do modelo.

## ⚠️ Antes de usar com dados reais

Os valores em `lib/legal-tables/2025.ts` (faixas de INSS, faixas de IRRF, dedução por dependente,
salário mínimo, teto do INSS) são **placeholders estruturais**. Confira cada um contra a Portaria
Interministerial e a Instrução Normativa da Receita Federal vigentes na data da competência antes
de usar em folha real. Atualizar um ano é editar um arquivo — a lógica de cálculo não muda.

## Requisitos

- Node.js 22.5+ (o módulo de Gestão de Férias usa `node:sqlite`, disponível a partir dessa
  versão). Desenvolvido com a versão 24 LTS.

## Configuração

```bash
npm install
```

Crie um arquivo `.env.local` na raiz do projeto (veja `.env.example`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Obtenha a chave em https://console.anthropic.com/settings/keys. Ela é usada **apenas no servidor**
(`lib/ai/client.ts` é marcado com `server-only`) e nunca chega ao navegador. Os módulos de cálculo
(Férias, Rescisão, Folha) funcionam sem a chave — só o chat depende dela.

## Comandos

```bash
npm run dev
```

```bash
npm run test
```

```bash
npm run build
```

```bash
npm run lint
```

## Estrutura

```
app/
  dashboard/                              indicadores gerais de férias
  ferias/                                 Controle de Férias | Simulador | Alertas Inteligentes
  colaboradores/ chat/ rescisao/ folha/   demais módulos (fora da sidebar por enquanto)
  api/
    chat/                                  loop de tool use do Claude
    calc/{ferias,rescisao,folha,simulador-ferias}/   cálculo determinístico, sem LLM
    upload/{spreadsheet,pdf}/              parsing de planilha e holerite
    colaboradores/{,[id],importar}/        CRUD e importação de colaboradores
    periodos-aquisitivos/                  tabela de gestão + lançamentos (programar)
    lancamentos-ferias/{[id]/baixa,[id]/cancelar,ativos}/   ciclo de vida (baixa/cancelamento)
    dashboard/ferias/                      indicadores agregados
lib/
  legal-tables/                      tabelas legais versionadas por ano
  calc/                              motor de cálculo puro + testes
  ai/                                cliente, system prompt, tools, tool loop
  parsing/                           planilha (exceljs) e PDF (pdf-parse)
  db/                                acesso a dados (node:sqlite)
  ferias-gestao/                     validações de negócio da Gestão de Férias (puras, testadas)
components/
  nav/          Sidebar, Header, Logo (shell do portal inteiro)
  shared/ chat/ modules/
```

## Módulos implementados

| Módulo | Estado |
|---|---|
| Dashboard (indicadores de férias) | ✅ |
| Férias — Controle, Simulador, Alertas Inteligentes | ✅ |
| Chat com assistente | ✅ (fora da sidebar por enquanto, acessível em `/chat`) |
| Colaboradores | ✅ (fora da sidebar por enquanto, acessível em `/colaboradores`) |
| Rescisão | ✅ (fora da sidebar por enquanto, acessível em `/rescisao`) |
| Folha de Pagamento (upload de planilha) | ✅ (fora da sidebar por enquanto, acessível em `/folha`) |
| Admissão, Ponto, Benefícios, Indicadores, Calendário, Auditoria | ⏳ fases futuras |

A sidebar (`components/nav/Sidebar.tsx`) hoje só lista Dashboard e Férias — os demais módulos
continuam funcionando normalmente por URL direta e devem ser adicionados à navegação um a um.

## Gestão de Férias

Persistência em SQLite via `node:sqlite` (nativo do Node, sem dependência externa), arquivo em
`data/portal-dp.db` (ignorado pelo git — é estado local, não código).

- **Colaboradores** (`/colaboradores`): cadastro manual ou importação de planilha (reaproveita o
  parser de `lib/parsing/spreadsheet.ts`, com o mesmo fluxo de revisão de mapeamento de colunas do
  módulo de Folha).
- **Controle de Férias** (aba em `/ferias`): períodos aquisitivos em aberto (gerados
  automaticamente a partir da data de admissão, em ciclos de 12 meses), com busca por nome/CPF,
  filtro por departamento, exportação em CSV e destaque de **risco de pagamento em dobro**
  (Art. 137 CLT). Abrir uma linha mostra o histórico do período e permite:
  - **Programar férias** — aplica as regras de fracionamento (máx. 3 períodos; 1º ≥ 14 dias,
    2º/3º ≥ 5 dias — Art. 134, §1º CLT) e de abono pecuniário (teto de 1/3 dos dias de direito,
    uso único por período aquisitivo). Nasce com status **Programada**.
  - **Dar baixa** — só quando as férias tiverem sido efetivamente concedidas (ou com a
    documentação anexada — nesta versão só o nome do arquivo é registrado, sem armazenar o
    conteúdo). Vira **Concluída** ou **Alterada** (se os dias reais diferirem do programado).
  - **Cancelar** — devolve o saldo ao período aquisitivo. Só se aplica a programações ainda não
    baixadas.
- **Lançamento Manual / Histórico Anterior ao Sistema** (dentro de Controle de Férias): registra
  períodos já gozados antes da implantação do sistema, sem os mínimos de dias nem o limite de
  fracionamento (é fato consumado), mas contando normalmente para os dias já tirados e para o
  limite de fracionamentos futuros. Nasce direto como **Concluída**.
- **Simulador de Férias** (aba em `/ferias`): salário + média de variáveis, dias de férias, venda
  de abono e adiantamento do 13º → remuneração, 1/3, abono, INSS/IRRF, líquido e custo total para
  a empresa. Reaproveita o mesmo motor de cálculo (`lib/calc`), sem persistência.
- **Alertas Inteligentes** (aba em `/ferias`): vencendo em 30/60/90 dias, vencidas, sem saldo de
  abono, programações pendentes de baixa e conflitos de programação por setor (duas pessoas do
  mesmo departamento com férias sobrepostas).
- **Dashboard** (`/dashboard`): total de colaboradores, férias programadas/vencidas/próximas do
  vencimento, valor previsto e custo mensal (estimados pelo motor de cálculo sobre os períodos em
  aberto), colaboradores por mês e percentual de férias concluídas.
- **Auditoria**: todo lançamento (programado, manual, baixado ou cancelado) grava o nome do
  operador informado no campo "Operador" do cabeçalho (sem login — apenas rastreabilidade) e o
  timestamp da gravação. Histórico nunca é apagado — cancelamentos e alterações ficam registrados
  com seu status, não removidos.

## Limitações conhecidas

- **PDF de holerite**: só funciona em PDFs com camada de texto. PDFs digitalizados (imagem) não são
  suportados — OCR está fora do escopo. Mesmo em PDFs de texto, a extração é heurística (layouts
  variam entre Totvs, Senior, SAP etc.) e exige confirmação do usuário antes de qualquer cálculo.
- **Planilhas**: o mapeamento de colunas é sugerido por similaridade de nome e precisa ser
  confirmado na tela. Linhas com dados inválidos são reportadas, nunca silenciadas.
- **Folha em lote**: cobre INSS, IRRF e FGTS sobre o salário base. Adicionais, benefícios e
  descontos específicos não estão incluídos.
- **Rescisão**: quando o saldo de FGTS não é informado, a base da multa é estimada (8% × salário ×
  meses) e não reflete correção monetária — confira o extrato do FGTS Digital.
- **Anexo na baixa de férias**: só o nome do arquivo é registrado (metadata) — o conteúdo não é
  processado nem armazenado nesta versão.
- **Convenção Coletiva**: nenhum cálculo considera CCT. Regras de categoria podem alterar os
  resultados.
- **Sem autenticação**: protótipo single-user. A Gestão de Férias tem persistência real (SQLite),
  mas a identificação do "operador" é só um campo de texto local (sem senha), não um login.

## Identidade visual

Cores e tipografia seguem o Manual de Marca MSB (fev/2024), centralizados como tokens CSS em
`app/globals.css`. A fonte oficial (Gotham) é paga e não está incluída; usamos Poppins como
substituta de estrutura similar, conforme autorizado pelo próprio manual. O logo no topo da
sidebar (`components/nav/Logo.tsx`) é uma aproximação em texto — não há um arquivo de logo
(SVG/PNG) no projeto; se houver um arquivo oficial, ele pode substituir esse componente.
