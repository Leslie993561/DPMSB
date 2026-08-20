-- =====================================================================
-- PROGRAMAÇÃO DE FÉRIAS — lançamento fixo a partir dos relatórios do DP
--
--   Fontes:  "Programação de Férias.pdf"      (MSB, 48 empregados, data base 31/12/2026, emissão 29/07/2026)
--            "Programação de Férias BIO.pdf"  (BIO,  5 empregados, data base 31/12/2027, emissão 30/07/2026)
--
--   Conteúdo: 53 empregados, 94 períodos aquisitivos,
--             10 deles com dias já gozados.
--
-- Como os dados foram lidos (colunas do relatório):
--   Os três números de cada linha são, na ordem:
--     1) dias acumulados proporcionalmente até a data base (30 quando o período fechou;
--        22,5 / 27,5 / 7,5 ... quando ainda está em curso — são avos x 2,5);
--     2) dias JÁ GOZADOS;
--     3) dias RESTANTES.
--   Conferido em todos os 94 períodos: gozados + restantes = 30 sempre.
--   'dias_direito' abaixo usa 30 (o direito legal do período fechado), não a coluna
--   proporcional — a coluna 1 é acúmulo até a data base, não direito, e a tabela
--   guarda inteiros. Nenhum valor foi inventado: o que não estava no relatório
--   (abono) entra como 0, porque no relatório essa coluna está vazia em todas as linhas.
--
-- Casamento com o cadastro: por NOME (o "Código" do relatório é a matrícula da
--   folha, não o id do Portal DP). Acentos e caixa são normalizados. Os 53
--   nomes foram conferidos um a um contra o cadastro: todos casaram.
--
-- Rode o bloco inteiro de uma vez (é uma transação só).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Dados do relatório, como vieram (tabela temporária, sai no COMMIT)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE prog_ferias_import (
  nome_pdf          TEXT NOT NULL,
  codigo_folha      TEXT,
  empresa           TEXT,
  centro_custo      TEXT,
  data_admissao     TEXT,
  inicio_aquisitivo TEXT NOT NULL,
  fim_aquisitivo    TEXT NOT NULL,
  limite_gozo       TEXT,
  dias_gozados      INTEGER NOT NULL,
  dias_restantes    INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO prog_ferias_import
  (nome_pdf, codigo_folha, empresa, centro_custo, data_admissao,
   inicio_aquisitivo, fim_aquisitivo, limite_gozo, dias_gozados, dias_restantes)
VALUES
  ('JOICE MELO DOS SANTOS', '18', 'BIO', 'INDUSTRIA MSB', '2016-09-01', '2026-09-01', '2027-08-31', '2028-08-02', 0, 30),
  ('JOICE MELO DOS SANTOS', '18', 'BIO', 'INDUSTRIA MSB', '2016-09-01', '2027-09-01', '2028-08-31', '2029-08-02', 0, 30),
  ('PATRICIO FE DE OLIVEIRA', '13', 'BIO', 'INDUSTRIA MSB', '2017-02-01', '2025-02-01', '2026-01-31', '2027-01-02', 0, 30),
  ('PATRICIO FE DE OLIVEIRA', '13', 'BIO', 'INDUSTRIA MSB', '2017-02-01', '2026-02-01', '2027-01-31', '2028-01-02', 0, 30),
  ('PATRICIO FE DE OLIVEIRA', '13', 'BIO', 'INDUSTRIA MSB', '2017-02-01', '2027-02-01', '2028-01-31', '2029-01-02', 0, 30),
  ('RAVENA PEIXOTO DOS SANTOS', '15', 'BIO', 'INDUSTRIA MSB', '2021-10-04', '2025-10-04', '2026-10-03', '2027-09-04', 0, 30),
  ('RAVENA PEIXOTO DOS SANTOS', '15', 'BIO', 'INDUSTRIA MSB', '2021-10-04', '2026-10-04', '2027-10-03', '2028-09-04', 0, 30),
  ('RAVENA PEIXOTO DOS SANTOS', '15', 'BIO', 'INDUSTRIA MSB', '2021-10-04', '2027-10-04', '2028-10-03', '2029-09-04', 0, 30),
  ('TAINARA CORREIA DOS SANTOS', '19', 'BIO', 'INDUSTRIA MSB', '2017-11-13', '2024-11-13', '2025-11-12', '2026-10-29', 15, 15),
  ('TAINARA CORREIA DOS SANTOS', '19', 'BIO', 'INDUSTRIA MSB', '2017-11-13', '2025-11-13', '2026-11-12', '2027-10-14', 0, 30),
  ('TAINARA CORREIA DOS SANTOS', '19', 'BIO', 'INDUSTRIA MSB', '2017-11-13', '2026-11-13', '2027-11-12', '2028-10-14', 0, 30),
  ('TAINARA CORREIA DOS SANTOS', '19', 'BIO', 'INDUSTRIA MSB', '2017-11-13', '2027-11-13', '2028-11-12', '2029-10-14', 0, 30),
  ('VICTOR ANTUNES SILVA BARBOSA', '14', 'BIO', 'INDUSTRIA MSB', '2021-08-16', '2025-08-16', '2026-08-15', '2027-07-17', 0, 30),
  ('VICTOR ANTUNES SILVA BARBOSA', '14', 'BIO', 'INDUSTRIA MSB', '2021-08-16', '2026-08-16', '2027-08-15', '2028-07-17', 0, 30),
  ('VICTOR ANTUNES SILVA BARBOSA', '14', 'BIO', 'INDUSTRIA MSB', '2021-08-16', '2027-08-16', '2028-08-15', '2029-07-17', 0, 30),
  ('DRIELLY MITIE MIZUSHIMA VICTOR', '1', 'MSB', 'FINANCEIRO', '2022-02-14', '2025-02-14', '2026-02-13', '2027-01-30', 15, 15),
  ('DRIELLY MITIE MIZUSHIMA VICTOR', '1', 'MSB', 'FINANCEIRO', '2022-02-14', '2026-02-14', '2027-02-13', '2028-01-15', 0, 30),
  ('LUCAS PUGLIESI DI GIROLAMO', '24', 'MSB', 'PLANEJAMENTO E CONTROLE', '2024-09-23', '2025-09-23', '2026-09-22', '2027-08-24', 0, 30),
  ('LUCAS PUGLIESI DI GIROLAMO', '24', 'MSB', 'PLANEJAMENTO E CONTROLE', '2024-09-23', '2026-09-23', '2027-09-22', '2028-08-24', 0, 30),
  ('MARIA LIVIA DE OLIVEIRA FERREIRA', '48', 'MSB', 'PLANEJAMENTO E CONTROLE', '2025-07-09', '2025-07-09', '2026-07-08', '2027-06-09', 0, 30),
  ('MARIA LIVIA DE OLIVEIRA FERREIRA', '48', 'MSB', 'PLANEJAMENTO E CONTROLE', '2025-07-09', '2026-07-09', '2027-07-08', '2028-06-09', 0, 30),
  ('ALICE COUTINHO DA CRUZ', '56', 'MSB', 'PRODUÇÃO', '2025-09-15', '2025-09-15', '2026-09-14', '2027-08-16', 0, 30),
  ('ALICE COUTINHO DA CRUZ', '56', 'MSB', 'PRODUÇÃO', '2025-09-15', '2026-09-15', '2027-09-14', '2028-08-16', 0, 30),
  ('ANA BEATRIZ SOUZA FIGUEIREDO', '77', 'MSB', 'PRODUÇÃO', '2026-04-15', '2026-04-15', '2027-04-14', '2028-03-16', 0, 30),
  ('ANA MARIA ALVES SANTOS', '19', 'MSB', 'PRODUÇÃO', '2020-02-11', '2026-02-11', '2027-02-10', '2028-01-12', 0, 30),
  ('BRUNA FERNANDA DOS SANTOS SILVA', '79', 'MSB', 'PRODUÇÃO', '2026-04-15', '2026-04-15', '2027-04-14', '2028-03-16', 0, 30),
  ('BRUNA SANTOS NASCIMENTO', '60', 'MSB', 'PRODUÇÃO', '2025-11-03', '2025-11-03', '2026-11-02', '2027-10-04', 0, 30),
  ('BRUNA SANTOS NASCIMENTO', '60', 'MSB', 'PRODUÇÃO', '2025-11-03', '2026-11-03', '2027-11-02', '2028-10-04', 0, 30),
  ('EDILCELIA SOUZA DE JESUS', '2', 'MSB', 'PRODUÇÃO', '2019-07-30', '2024-12-19', '2025-12-18', '2026-12-05', 16, 14),
  ('EDILCELIA SOUZA DE JESUS', '2', 'MSB', 'PRODUÇÃO', '2019-07-30', '2025-12-19', '2026-12-18', '2027-11-19', 0, 30),
  ('EDILCELIA SOUZA DE JESUS', '2', 'MSB', 'PRODUÇÃO', '2019-07-30', '2026-12-19', '2027-12-18', '2028-11-19', 0, 30),
  ('ELAINE SANTOS JABALY', '84', 'MSB', 'PRODUÇÃO', '2026-06-29', '2026-06-29', '2027-06-28', '2028-05-30', 0, 30),
  ('JANETE CARVALHO DE JESUS', '8', 'MSB', 'PRODUÇÃO', '2015-04-01', '2025-12-07', '2026-12-06', '2027-11-07', 0, 30),
  ('JANETE CARVALHO DE JESUS', '8', 'MSB', 'PRODUÇÃO', '2015-04-01', '2026-12-07', '2027-12-06', '2028-11-07', 0, 30),
  ('LEILDES DE QUEIROS BONFIM', '23', 'MSB', 'PRODUÇÃO', '2016-07-01', '2026-07-01', '2027-06-30', '2028-06-01', 0, 30),
  ('LUCIA MARIA PUGLIESI DI GIROLAMO', '83', 'MSB', 'PRODUÇÃO', '2026-06-29', '2026-06-29', '2027-06-28', '2028-05-30', 0, 30),
  ('MICHELE BISPO DE SANTANA', '86', 'MSB', 'PRODUÇÃO', '2026-06-29', '2026-06-29', '2027-06-28', '2028-05-30', 0, 30),
  ('POLIANA ALINE DE CERQUEIRA VIEIRA', '57', 'MSB', 'PRODUÇÃO', '2025-09-15', '2025-09-15', '2026-09-14', '2027-08-16', 0, 30),
  ('POLIANA ALINE DE CERQUEIRA VIEIRA', '57', 'MSB', 'PRODUÇÃO', '2025-09-15', '2026-09-15', '2027-09-14', '2028-08-16', 0, 30),
  ('SILVANA TRINDADE PIRES DOS SANTOS', '40', 'MSB', 'PRODUÇÃO', '2024-10-01', '2025-10-01', '2026-09-30', '2027-09-01', 0, 30),
  ('SILVANA TRINDADE PIRES DOS SANTOS', '40', 'MSB', 'PRODUÇÃO', '2024-10-01', '2026-10-01', '2027-09-30', '2028-09-01', 0, 30),
  ('TAISA TRINDADE DA CRUZ', '61', 'MSB', 'PRODUÇÃO', '2025-11-03', '2025-11-03', '2026-11-02', '2027-10-04', 0, 30),
  ('TAISA TRINDADE DA CRUZ', '61', 'MSB', 'PRODUÇÃO', '2025-11-03', '2026-11-03', '2027-11-02', '2028-10-04', 0, 30),
  ('YASMIN BATISTA SANTOS', '44', 'MSB', 'PRODUÇÃO', '2024-08-19', '2025-08-19', '2026-08-18', '2027-08-03', 14, 16),
  ('YASMIN BATISTA SANTOS', '44', 'MSB', 'PRODUÇÃO', '2024-08-19', '2026-08-19', '2027-08-18', '2028-07-20', 0, 30),
  ('DAVI CUNHA BARBOSA MOREIRA', '81', 'MSB', 'MANUTENÇÃO', '2026-05-25', '2026-05-25', '2027-05-24', '2028-04-25', 0, 30),
  ('IAGO ROSAS IUNG', '7', 'MSB', 'MANUTENÇÃO', '2023-08-14', '2024-08-14', '2025-08-13', '2026-07-25', 10, 20),
  ('IAGO ROSAS IUNG', '7', 'MSB', 'MANUTENÇÃO', '2023-08-14', '2025-08-14', '2026-08-13', '2027-07-15', 0, 30),
  ('IAGO ROSAS IUNG', '7', 'MSB', 'MANUTENÇÃO', '2023-08-14', '2026-08-14', '2027-08-13', '2028-07-15', 0, 30),
  ('FABIANA SANTOS SOUSA', '6', 'MSB', 'CONTROLE E QUALIDADE', '2021-10-01', '2025-12-20', '2026-12-19', '2027-11-20', 0, 30),
  ('FABIANA SANTOS SOUSA', '6', 'MSB', 'CONTROLE E QUALIDADE', '2021-10-01', '2026-12-20', '2027-12-19', '2028-11-20', 0, 30),
  ('FELIPE MARCOS PEIXOTO PEREIRA', '68', 'MSB', 'CONTROLE E QUALIDADE', '2025-12-10', '2025-12-10', '2026-12-09', '2027-11-10', 0, 30),
  ('FELIPE MARCOS PEIXOTO PEREIRA', '68', 'MSB', 'CONTROLE E QUALIDADE', '2025-12-10', '2026-12-10', '2027-12-09', '2028-11-10', 0, 30),
  ('MANUELA FRAGA FERNANDES E SILVA', '74', 'MSB', 'CONTROLE E QUALIDADE', '2026-03-04', '2026-03-04', '2027-03-03', '2028-02-03', 0, 30),
  ('MIGUEL CRUZ CAMBESES', '75', 'MSB', 'CONTROLE E QUALIDADE', '2026-03-16', '2026-03-16', '2027-03-15', '2028-02-15', 0, 30),
  ('EDNALVA NASCIMENTO DA SILVA', '4', 'MSB', 'LOGISTICA', '2022-10-10', '2024-12-19', '2025-12-18', '2026-12-03', 14, 16),
  ('EDNALVA NASCIMENTO DA SILVA', '4', 'MSB', 'LOGISTICA', '2022-10-10', '2025-12-19', '2026-12-18', '2027-11-19', 0, 30),
  ('EDNALVA NASCIMENTO DA SILVA', '4', 'MSB', 'LOGISTICA', '2022-10-10', '2026-12-19', '2027-12-18', '2028-11-19', 0, 30),
  ('ITALO DA SILVA FIGUEIREDO', '76', 'MSB', 'LOGISTICA', '2026-03-24', '2026-03-24', '2027-03-23', '2028-02-23', 0, 30),
  ('LEANDRO DE JESUS SILVA', '71', 'MSB', 'LOGISTICA', '2026-01-13', '2026-01-13', '2027-01-12', '2027-12-14', 0, 30),
  ('MIRAILTON DE SANTANA SANTANA', '62', 'MSB', 'LOGISTICA', '2025-11-03', '2025-11-03', '2026-11-02', '2027-10-04', 0, 30),
  ('MIRAILTON DE SANTANA SANTANA', '62', 'MSB', 'LOGISTICA', '2025-11-03', '2026-11-03', '2027-11-02', '2028-10-04', 0, 30),
  ('CINTIA SANTOS SILVA BATISTA', '70', 'MSB', 'ADMNISTRATIVO', '2026-01-13', '2026-01-13', '2027-01-12', '2027-12-14', 0, 30),
  ('MANUELE RODRIGUES DOS SANTOS', '80', 'MSB', 'ADMNISTRATIVO', '2026-05-18', '2026-05-18', '2027-05-17', '2028-04-18', 0, 30),
  ('LUCAS PRATA OLIVEIRA', '25', 'MSB', 'ENGENHARIA - MELHORIA CONTINUA', '2025-04-25', '2025-12-22', '2026-12-21', '2027-11-22', 0, 30),
  ('LUCAS PRATA OLIVEIRA', '25', 'MSB', 'ENGENHARIA - MELHORIA CONTINUA', '2025-04-25', '2026-12-22', '2027-12-21', '2028-11-22', 0, 30),
  ('REBECA SOUZA SANTOS OLIVEIRA', '38', 'MSB', 'ENGENHARIA - MELHORIA CONTINUA', '2024-12-02', '2025-12-02', '2026-12-01', '2027-11-02', 0, 30),
  ('REBECA SOUZA SANTOS OLIVEIRA', '38', 'MSB', 'ENGENHARIA - MELHORIA CONTINUA', '2024-12-02', '2026-12-02', '2027-12-01', '2028-11-02', 0, 30),
  ('MATEUS CHAVES MOURA', '26', 'MSB', 'TECNOLOGIA DA INFORMAÇÃO', '2024-03-18', '2025-03-18', '2026-03-17', '2027-02-16', 0, 30),
  ('MATEUS CHAVES MOURA', '26', 'MSB', 'TECNOLOGIA DA INFORMAÇÃO', '2024-03-18', '2026-03-18', '2027-03-17', '2028-02-17', 0, 30),
  ('EMANOELA MARIA CACIQUINHO COSTA', '87', 'MSB', 'OPERAÇÕES DE VENDAS', '2026-07-15', '2026-07-15', '2027-07-14', '2028-06-15', 0, 30),
  ('JAQUELINE LIMA TEIXEIRA', '10', 'MSB', 'OPERAÇÕES DE VENDAS', '2025-03-13', '2025-03-13', '2026-03-12', '2027-03-03', 20, 10),
  ('JAQUELINE LIMA TEIXEIRA', '10', 'MSB', 'OPERAÇÕES DE VENDAS', '2025-03-13', '2026-03-13', '2027-03-12', '2028-02-12', 0, 30),
  ('OURIVANIA JEAN SANTOS CARVALHO NERY', '36', 'MSB', 'LIMPEZA', '2022-06-14', '2024-06-14', '2025-06-13', '2026-05-27', 12, 18),
  ('ELEN PEREIRA BARBOZA BRANDAO', '5', 'MSB', 'ENGENHARIA - PROJETOS', '2023-10-03', '2025-10-03', '2026-10-02', '2027-09-03', 0, 30),
  ('ELEN PEREIRA BARBOZA BRANDAO', '5', 'MSB', 'ENGENHARIA - PROJETOS', '2023-10-03', '2026-10-03', '2027-10-02', '2028-09-03', 0, 30),
  ('RODRIGO ARAUJO PORTO BOMFIM', '37', 'MSB', 'ENGENHARIA - PROJETOS', '2024-08-12', '2025-08-12', '2026-08-11', '2027-07-13', 0, 30),
  ('RODRIGO ARAUJO PORTO BOMFIM', '37', 'MSB', 'ENGENHARIA - PROJETOS', '2024-08-12', '2026-08-12', '2027-08-11', '2028-07-13', 0, 30),
  ('CAROLINA MATOS DA CRUZ', '21', 'MSB', 'GENTE E GESTÃO', '2021-11-22', '2024-11-22', '2025-11-21', '2026-11-07', 15, 15),
  ('CAROLINA MATOS DA CRUZ', '21', 'MSB', 'GENTE E GESTÃO', '2021-11-22', '2025-11-22', '2026-11-21', '2027-10-23', 0, 30),
  ('CAROLINA MATOS DA CRUZ', '21', 'MSB', 'GENTE E GESTÃO', '2021-11-22', '2026-11-22', '2027-11-21', '2028-10-23', 0, 30),
  ('LESLIE SILVA SOUZA', '50', 'MSB', 'GENTE E GESTÃO', '2025-07-21', '2025-07-21', '2026-07-20', '2027-06-21', 0, 30),
  ('LESLIE SILVA SOUZA', '50', 'MSB', 'GENTE E GESTÃO', '2025-07-21', '2026-07-21', '2027-07-20', '2028-06-21', 0, 30),
  ('CIDALIA PEREIRA CARDOSO', '67', 'MSB', 'GARANTIA DA QUALIDADE', '2025-12-08', '2025-12-08', '2026-12-07', '2027-11-08', 0, 30),
  ('CIDALIA PEREIRA CARDOSO', '67', 'MSB', 'GARANTIA DA QUALIDADE', '2025-12-08', '2026-12-08', '2027-12-07', '2028-11-08', 0, 30),
  ('JULIANA RANZAN MATOS', '49', 'MSB', 'GARANTIA DA QUALIDADE', '2025-07-01', '2025-07-01', '2026-06-30', '2027-06-11', 10, 20),
  ('JULIANA RANZAN MATOS', '49', 'MSB', 'GARANTIA DA QUALIDADE', '2025-07-01', '2026-07-01', '2027-06-30', '2028-06-01', 0, 30),
  ('RAISSA RAYANE SANTOS LAURINDO CALDAS', '58', 'MSB', 'GARANTIA DA QUALIDADE', '2025-10-13', '2025-10-13', '2026-10-12', '2027-09-13', 0, 30),
  ('RAISSA RAYANE SANTOS LAURINDO CALDAS', '58', 'MSB', 'GARANTIA DA QUALIDADE', '2025-10-13', '2026-10-13', '2027-10-12', '2028-09-13', 0, 30),
  ('TAIS BATISTA SANTOS', '42', 'MSB', 'GARANTIA DA QUALIDADE', '2022-01-04', '2026-01-04', '2027-01-03', '2027-12-05', 0, 30),
  ('WILLIAM ALVES CRUZ', '41', 'MSB', 'GARANTIA DA QUALIDADE', '2025-02-06', '2026-02-06', '2027-02-05', '2028-01-07', 0, 30),
  ('CAROLAINE MACARIO DOS SANTOS', '82', 'MSB', 'ENGENHARIA', '2026-06-09', '2026-06-09', '2027-06-08', '2028-05-10', 0, 30),
  ('ITALO RAFAEL ARAUJO ZORZETTO', '72', 'MSB', 'ENGENHARIA', '2026-02-03', '2026-02-03', '2027-02-02', '2028-01-04', 0, 30),
  ('MARCELO RICARDO ARAUJO BACELAR DE LIMA', '88', 'MSB', 'ENGENHARIA', '2026-08-03', '2026-08-03', '2027-08-02', '2028-07-04', 0, 30);

-- ---------------------------------------------------------------------
-- 2. Trava de segurança: aborta se algum nome do relatório não casar com
--    o cadastro. Sem isso, um nome errado passaria em silêncio e o
--    empregado ficaria sem programação nenhuma.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  faltantes TEXT;
BEGIN
  SELECT string_agg(DISTINCT i.nome_pdf, ', ')
    INTO faltantes
    FROM prog_ferias_import i
   WHERE NOT EXISTS (
     SELECT 1 FROM colaboradores c
      WHERE translate(upper(trim(c.nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
          = translate(upper(trim(i.nome_pdf)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
   );
  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Nomes do relatório sem colaborador no cadastro: %', faltantes;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. LIMPEZA — apaga a programação anterior para não sobrar nada duplicado
--
--    O que sai daqui é tudo que havia antes de períodos aquisitivos e
--    lançamentos de férias. Isso é intencional: o relatório do DP passa a ser
--    a única fonte. Os períodos que existiam eram gerados automaticamente pelo
--    aniversário de admissão, e para quem teve afastamento/licença eles não
--    coincidem com os do relatório — deixá-los faria a mesma férias aparecer
--    duas vezes no Controle de Férias.
--
--    Os 3 lançamentos que existiam eram registros de teste de verificação
--    ("Claude (verificacao)", "teste automatizado"), dois deles já cancelados;
--    nenhum lançamento real de DP foi perdido.
-- ---------------------------------------------------------------------
DELETE FROM lancamentos_ferias;
DELETE FROM periodos_aquisitivos;

-- ---------------------------------------------------------------------
-- 4. Períodos aquisitivos, exatamente como estão no relatório
-- ---------------------------------------------------------------------
INSERT INTO periodos_aquisitivos
  (colaborador_id, data_inicio, data_fim, dias_direito, abono_utilizado, dias_abono, status)
SELECT c.id,
       i.inicio_aquisitivo,
       i.fim_aquisitivo,
       30,
       0,
       0,
       CASE WHEN i.dias_restantes <= 0 THEN 'concluido' ELSE 'aberto' END
  FROM prog_ferias_import i
  JOIN colaboradores c
    ON translate(upper(trim(c.nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
     = translate(upper(trim(i.nome_pdf)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
    ON CONFLICT (colaborador_id, data_inicio) DO UPDATE
   SET data_fim     = EXCLUDED.data_fim,
       dias_direito = EXCLUDED.dias_direito,
       status       = EXCLUDED.status;

-- ---------------------------------------------------------------------
-- 5. Férias já gozadas → um lançamento 'concluida' por período
--    O marcador na observação identifica a origem: se você rodar este
--    script de novo, o passo 3 limpa tudo antes, então não duplica.
-- ---------------------------------------------------------------------
INSERT INTO lancamentos_ferias
  (periodo_aquisitivo_id, origem, status, dias, data_inicio_gozo, data_fim_gozo,
   abono, dias_abono, observacao, criado_por)
SELECT p.id,
       'manual',
       'concluida',
       i.dias_gozados,
       i.fim_aquisitivo,   -- o relatório não traz a data real de gozo, só a quantidade
       i.fim_aquisitivo,
       0,
       0,
       '[programacao-ferias-julho-2026]',
       'Programação de Férias (PDF do DP)'
  FROM prog_ferias_import i
  JOIN colaboradores c
    ON translate(upper(trim(c.nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
     = translate(upper(trim(i.nome_pdf)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
  JOIN periodos_aquisitivos p
    ON p.colaborador_id = c.id AND p.data_inicio = i.inicio_aquisitivo
 WHERE i.dias_gozados > 0;

-- ---------------------------------------------------------------------
-- 6. Conferência (aparece no resultado da consulta)
--    'total_periodos_na_base' tem de ser igual a 'periodos_no_relatorio':
--    se for maior, sobrou período de outra origem em algum lugar.
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM prog_ferias_import)                                    AS periodos_no_relatorio,
  (SELECT COUNT(DISTINCT nome_pdf) FROM prog_ferias_import)                    AS empregados_no_relatorio,
  (SELECT COUNT(*) FROM lancamentos_ferias WHERE observacao = '[programacao-ferias-julho-2026]') AS lancamentos_de_gozo_criados,
  (SELECT COUNT(*) FROM periodos_aquisitivos)                                  AS total_periodos_na_base,
  (SELECT COUNT(*) FROM lancamentos_ferias)                                    AS total_lancamentos_na_base;

COMMIT;
