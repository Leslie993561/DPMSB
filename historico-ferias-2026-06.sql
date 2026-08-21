-- =====================================================================
-- HISTÓRICO DE FÉRIAS JÁ GOZADAS
--
--   Fontes: "Relação de Férias Calculadas.pdf"     (MSB, emissão 17/06/2026)
--           "Relação de Férias CalculadasBIO.pdf"  (BIO, emissão 17/06/2026)
--           período coberto: 01/01/1500 a 17/06/2026 (ou seja, tudo)
--
--   88 registros de férias efetivamente gozadas, com as datas reais de
--   início e fim de cada gozo e, quando houve, o intervalo do abono pecuniário.
--
-- Leitura do relatório: cada registro ocupa duas linhas, com três pares de
-- datas (Aquisitivo, Férias, Abono) — a 1a linha traz os "Início" e a 2a os
-- "Fim". A quantidade de dias é (fim - início + 1); conferida contra os
-- valores em R$ do próprio relatório.
--
-- O que este script faz:
--   1. Cria os períodos aquisitivos antigos que o histórico cita e que não
--      existiam na base (só havia os do relatório de programação de julho).
--      Eles entram com status 'concluido' — ver a observação no passo 3.
--   2. Substitui os lançamentos provisórios (que tinham a data do fim do
--      aquisitivo como aproximação) pelos lançamentos com as datas REAIS.
--
-- Rode o bloco inteiro de uma vez (é uma transação só).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Histórico, como veio do relatório
-- ---------------------------------------------------------------------
CREATE TEMP TABLE hist_ferias (
  nome_pdf          TEXT NOT NULL,
  empresa           TEXT,
  aquisitivo_inicio TEXT NOT NULL,
  aquisitivo_fim    TEXT NOT NULL,
  ferias_inicio     TEXT,
  ferias_fim        TEXT,
  dias_ferias       INTEGER NOT NULL,
  abono_inicio      TEXT,
  abono_fim         TEXT,
  dias_abono        INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO hist_ferias
  (nome_pdf, empresa, aquisitivo_inicio, aquisitivo_fim,
   ferias_inicio, ferias_fim, dias_ferias, abono_inicio, abono_fim, dias_abono)
VALUES
  ('JOICE MELO DOS SANTOS', 'BIO', '2023-09-01', '2024-08-31', '2024-10-15', '2024-10-29', 15, NULL, NULL, 0),
  ('JOICE MELO DOS SANTOS', 'BIO', '2023-09-01', '2024-08-31', '2024-12-26', '2025-01-04', 10, '2025-01-05', '2025-01-09', 5),
  ('JOICE MELO DOS SANTOS', 'BIO', '2024-09-01', '2025-08-31', '2025-10-13', '2025-11-01', 20, '2025-11-02', '2025-11-11', 10),
  ('JOICE MELO DOS SANTOS', 'BIO', '2025-09-01', '2026-08-31', '2025-12-22', '2026-01-05', 15, NULL, NULL, 0),
  ('PATRICIO FE DE OLIVEIRA', 'BIO', '2024-02-01', '2025-01-31', '2025-12-15', '2026-01-03', 20, '2026-01-04', '2026-01-13', 10),
  ('RAVENA PEIXOTO DOS SANTOS', 'BIO', '2022-10-04', '2023-10-03', '2024-09-10', '2024-09-29', 20, '2024-09-24', '2024-10-03', 10),
  ('RAVENA PEIXOTO DOS SANTOS', 'BIO', '2023-10-04', '2024-10-03', '2025-06-25', '2025-07-09', 15, NULL, NULL, 0),
  ('RAVENA PEIXOTO DOS SANTOS', 'BIO', '2023-10-04', '2024-10-03', '2025-09-18', '2025-10-02', 15, NULL, NULL, 0),
  ('RAVENA PEIXOTO DOS SANTOS', 'BIO', '2024-10-04', '2025-10-03', '2026-05-11', '2026-05-25', 15, NULL, NULL, 0),
  ('TAINARA CORREIA DOS SANTOS', 'BIO', '2022-11-13', '2023-11-12', '2024-06-17', '2024-07-06', 20, '2024-07-06', '2024-07-15', 10),
  ('TAINARA CORREIA DOS SANTOS', 'BIO', '2023-11-13', '2024-11-12', '2025-06-25', '2025-07-14', 20, NULL, NULL, 0),
  ('TAINARA CORREIA DOS SANTOS', 'BIO', '2023-11-13', '2024-11-12', '2025-09-15', '2025-09-24', 10, NULL, NULL, 0),
  ('TAINARA CORREIA DOS SANTOS', 'BIO', '2024-11-13', '2025-11-12', '2025-12-22', '2026-01-05', 15, NULL, NULL, 0),
  ('VICTOR ANTUNES SILVA BARBOSA', 'BIO', '2023-08-16', '2024-08-15', '2025-07-21', '2025-07-30', 10, NULL, NULL, 0),
  ('VICTOR ANTUNES SILVA BARBOSA', 'BIO', '2024-08-16', '2025-08-15', '2025-12-22', '2026-01-06', 16, NULL, NULL, 0),
  ('VICTOR ANTUNES SILVA BARBOSA', 'BIO', '2024-08-16', '2025-08-15', '2026-04-22', '2026-04-30', 9, NULL, NULL, 0),
  ('DRIELLY MITIE MIZUSHIMA VICTOR', 'MSB', '2024-02-14', '2025-02-13', '2025-06-23', '2025-06-27', 5, NULL, NULL, 0),
  ('DRIELLY MITIE MIZUSHIMA VICTOR', 'MSB', '2024-02-14', '2025-02-13', '2025-10-15', '2025-10-24', 10, NULL, NULL, 0),
  ('DRIELLY MITIE MIZUSHIMA VICTOR', 'MSB', '2024-02-14', '2025-02-13', '2026-01-07', '2026-01-21', 15, NULL, NULL, 0),
  ('DRIELLY MITIE MIZUSHIMA VICTOR', 'MSB', '2025-02-14', '2026-02-13', '2026-06-08', '2026-06-22', 15, NULL, NULL, 0),
  ('ANA MARIA ALVES SANTOS', 'MSB', '2024-02-11', '2025-02-10', '2024-12-26', '2025-01-04', 10, NULL, NULL, 0),
  ('ANA MARIA ALVES SANTOS', 'MSB', '2024-02-11', '2025-02-10', '2025-02-10', '2025-02-14', 5, NULL, NULL, 0),
  ('ANA MARIA ALVES SANTOS', 'MSB', '2024-02-11', '2025-02-10', '2025-12-22', '2026-01-05', 15, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2021-10-01', '2021-12-19', '2021-12-20', '2021-12-27', 8, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2021-12-20', '2022-12-19', '2022-12-19', '2023-01-02', 15, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2021-12-20', '2022-12-19', '2023-07-17', '2023-07-31', 15, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2022-12-20', '2023-12-19', '2023-12-20', '2023-12-29', 10, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2022-12-20', '2023-12-19', '2024-07-15', '2024-07-28', 14, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2022-12-20', '2023-12-19', '2024-09-30', '2024-10-05', 6, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2023-12-20', '2024-12-19', '2024-12-26', '2025-01-04', 10, NULL, NULL, 0),
  ('ARLENE SILVA CHAVES MOURA', 'MSB', '2023-12-20', '2024-12-19', '2025-08-18', '2025-08-31', 14, '2025-09-01', '2025-09-06', 6),
  ('EDILCELIA SOUZA DE JESUS', 'MSB', '2024-12-19', '2025-12-18', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('FABIANA SANTOS SOUSA', 'MSB', '2024-12-20', '2025-12-19', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('JANETE CARVALHO DE JESUS', 'MSB', '2024-12-07', '2025-12-06', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('JULIANA LIMA DOS SANTOS', 'MSB', '2024-04-12', '2025-04-11', '2025-09-15', '2025-10-04', 20, NULL, NULL, 0),
  ('JULIANA LIMA DOS SANTOS', 'MSB', '2024-04-12', '2025-04-11', '2025-12-22', '2025-12-31', 10, NULL, NULL, 0),
  ('JULIANA LIMA DOS SANTOS', 'MSB', '2025-04-12', '2026-01-12', '2026-01-01', '2026-01-04', 4, NULL, NULL, 0),
  ('LAILA KELEN LIMA FERREIRA', 'MSB', '2023-12-19', '2024-12-18', '2024-12-26', '2025-01-06', 12, NULL, NULL, 0),
  ('LAILA KELEN LIMA FERREIRA', 'MSB', '2023-12-19', '2024-12-18', '2025-10-13', '2025-10-30', 18, NULL, NULL, 0),
  ('LAILA KELEN LIMA FERREIRA', 'MSB', '2024-12-19', '2025-12-18', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('LEILDES DE QUEIROS BONFIM', 'MSB', '2024-07-01', '2025-06-30', '2025-09-15', '2025-10-04', 20, NULL, NULL, 0),
  ('LEILDES DE QUEIROS BONFIM', 'MSB', '2024-07-01', '2025-06-30', '2025-12-22', '2025-12-31', 10, NULL, NULL, 0),
  ('LEILDES DE QUEIROS BONFIM', 'MSB', '2025-07-01', '2026-06-30', '2026-01-01', '2026-01-04', 4, NULL, NULL, 0),
  ('SILVANA TRINDADE PIRES DOS SANTOS', 'MSB', '2024-10-01', '2025-09-30', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('SILVANA TRINDADE PIRES DOS SANTOS', 'MSB', '2024-10-01', '2025-09-30', '2026-04-13', '2026-04-17', 5, NULL, NULL, 0),
  ('YASMIN BATISTA SANTOS', 'MSB', '2024-08-19', '2025-08-18', '2024-12-26', '2025-01-06', 12, NULL, NULL, 0),
  ('YASMIN BATISTA SANTOS', 'MSB', '2024-08-19', '2025-08-18', '2025-11-24', '2025-12-01', 8, NULL, NULL, 0),
  ('YASMIN BATISTA SANTOS', 'MSB', '2024-08-19', '2025-08-18', '2025-12-22', '2025-12-31', 10, NULL, NULL, 0),
  ('YASMIN BATISTA SANTOS', 'MSB', '2025-08-19', '2026-08-18', '2026-01-01', '2026-01-04', 4, NULL, NULL, 0),
  ('DIONES DE SANTANA SILVA', 'MSB', '2024-04-04', '2025-04-03', '2025-06-25', '2025-07-14', 20, '2025-07-15', '2025-07-24', 10),
  ('IAGO ROSAS IUNG', 'MSB', '2023-08-14', '2024-08-13', '2025-07-14', '2025-07-28', 15, NULL, NULL, 0),
  ('IAGO ROSAS IUNG', 'MSB', '2024-08-14', '2025-08-13', '2026-04-08', '2026-04-17', 10, NULL, NULL, 0),
  ('ALAIDE CONCEICAO', 'MSB', '2023-12-16', '2024-12-15', '2025-06-25', '2025-07-24', 30, NULL, NULL, 0),
  ('ALAIDE CONCEICAO', 'MSB', '2024-12-16', '2025-12-15', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('EDNALVA NASCIMENTO DA SILVA', 'MSB', '2023-12-19', '2024-12-18', '2025-11-10', '2025-11-23', 14, '2025-11-25', '2025-11-30', 6),
  ('EDNALVA NASCIMENTO DA SILVA', 'MSB', '2024-12-19', '2025-12-18', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('ERIVALDO OLIVEIRA DA SILVA', 'MSB', '2023-12-20', '2024-12-19', '2025-08-18', '2025-09-01', 15, '2025-09-02', '2025-09-11', 10),
  ('ERIVALDO OLIVEIRA DA SILVA', 'MSB', '2023-12-20', '2024-12-19', '2025-10-27', '2025-10-31', 5, NULL, NULL, 0),
  ('ERIVALDO OLIVEIRA DA SILVA', 'MSB', '2024-12-20', '2025-12-19', '2026-05-11', '2026-05-25', 15, '2026-05-26', '2026-05-30', 5),
  ('JACQUES DOUGLAS DA SILVA OLIVEIRA JUNIOR', 'MSB', '2024-02-14', '2025-02-13', '2025-06-09', '2025-06-18', 10, NULL, NULL, 0),
  ('JACQUES DOUGLAS DA SILVA OLIVEIRA JUNIOR', 'MSB', '2024-02-14', '2025-02-13', '2025-08-04', '2025-08-23', 20, NULL, NULL, 0),
  ('JAQUELINE LIMA TEIXEIRA', 'MSB', '2025-03-13', '2026-03-12', '2026-03-18', '2026-03-22', 5, NULL, NULL, 0),
  ('JOAO VITOR LIMA SILVA', 'MSB', '2024-07-01', '2025-06-30', '2025-07-30', '2025-08-13', 15, NULL, NULL, 0),
  ('LUCAS PUGLIESI DI GIROLAMO', 'MSB', '2024-09-23', '2025-09-22', '2025-12-01', '2025-12-15', 15, NULL, NULL, 0),
  ('LUCAS PUGLIESI DI GIROLAMO', 'MSB', '2024-09-23', '2025-09-22', '2025-12-22', '2026-01-05', 15, NULL, NULL, 0),
  ('FELIPE MARCOS PEIXOTO PEREIRA', 'MSB', '2024-04-15', '2025-04-14', '2025-10-27', '2025-10-31', 5, NULL, NULL, 0),
  ('FELIPE MARCOS PEIXOTO PEREIRA', 'MSB', '2024-04-15', '2025-04-14', '2025-11-24', '2025-12-05', 12, '2025-12-06', '2025-12-09', 4),
  ('LUCAS PRATA OLIVEIRA', 'MSB', '2025-04-25', '2025-12-21', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('REBECA SOUZA SANTOS OLIVEIRA', 'MSB', '2024-12-02', '2025-12-01', '2026-01-05', '2026-01-14', 10, NULL, NULL, 0),
  ('REBECA SOUZA SANTOS OLIVEIRA', 'MSB', '2024-12-02', '2025-12-01', '2026-03-30', '2026-04-03', 5, NULL, NULL, 0),
  ('MATEUS CHAVES MOURA', 'MSB', '2024-03-18', '2025-03-17', '2026-01-12', '2026-01-25', 14, '2026-01-26', '2026-02-04', 10),
  ('MATEUS CHAVES MOURA', 'MSB', '2024-03-18', '2025-03-17', '2026-02-23', '2026-02-28', 6, NULL, NULL, 0),
  ('PATRICIA NOGUEIRA DA SILVA', 'MSB', '2025-02-24', '2025-12-21', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('SELMA RIBEIRO BISPO', 'MSB', '2024-02-15', '2025-02-14', '2025-06-25', '2025-07-04', 10, NULL, NULL, 0),
  ('SELMA RIBEIRO BISPO', 'MSB', '2024-02-15', '2025-02-14', '2025-09-08', '2025-09-12', 5, NULL, NULL, 0),
  ('SELMA RIBEIRO BISPO', 'MSB', '2024-02-15', '2025-02-14', '2026-01-05', '2026-01-14', 10, '2026-01-15', '2026-01-19', 5),
  ('OURIVANIA JEAN SANTOS CARVALHO NERY', 'MSB', '2024-06-14', '2025-06-13', '2024-12-26', '2025-01-06', 12, NULL, NULL, 0),
  ('TAIS BATISTA SANTOS', 'MSB', '2025-01-04', '2026-01-03', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('TAIS BATISTA SANTOS', 'MSB', '2025-01-04', '2026-01-03', '2026-02-19', '2026-03-06', 16, NULL, NULL, 0),
  ('WILLIAM ALVES CRUZ', 'MSB', '2025-02-06', '2026-02-05', '2026-03-09', '2026-04-07', 30, NULL, NULL, 0),
  ('ELEN PEREIRA BARBOZA BRANDAO', 'MSB', '2023-10-03', '2024-10-02', '2025-08-18', '2025-09-01', 15, '2025-09-02', '2025-09-06', 5),
  ('ELEN PEREIRA BARBOZA BRANDAO', 'MSB', '2024-10-03', '2025-10-02', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('RODRIGO ARAUJO PORTO BOMFIM', 'MSB', '2024-08-12', '2025-08-11', '2025-12-22', '2026-01-04', 14, NULL, NULL, 0),
  ('RODRIGO ARAUJO PORTO BOMFIM', 'MSB', '2024-08-12', '2025-08-11', '2026-02-02', '2026-02-17', 16, NULL, NULL, 0),
  ('CAROLINA MATOS DA CRUZ', 'MSB', '2023-11-22', '2024-11-21', '2025-01-06', '2025-01-10', 5, NULL, NULL, 0),
  ('CAROLINA MATOS DA CRUZ', 'MSB', '2023-11-22', '2024-11-21', '2025-08-12', '2025-09-05', 25, NULL, NULL, 0),
  ('CAROLINA MATOS DA CRUZ', 'MSB', '2024-11-22', '2025-11-21', '2026-01-05', '2026-01-14', 10, NULL, NULL, 0),
  ('CAROLINA MATOS DA CRUZ', 'MSB', '2024-11-22', '2025-11-21', '2026-02-23', '2026-02-27', 5, NULL, NULL, 0);

-- ---------------------------------------------------------------------
-- 1b. Guarda quanto a PROGRAMAÇÃO (mais recente) diz que já foi gozado em
--     cada período, ANTES de apagar aqueles lançamentos. É esse total que
--     precisa ser preservado — ver o passo 3b.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE gozo_programacao ON COMMIT DROP AS
SELECT l.periodo_aquisitivo_id AS periodo_id,
       SUM(l.dias)             AS dias_programacao
  FROM lancamentos_ferias l
 WHERE l.observacao = '[programacao-ferias-julho-2026]'
 GROUP BY l.periodo_aquisitivo_id;

-- ---------------------------------------------------------------------
-- 2. Períodos aquisitivos citados no histórico que ainda não existem
--
--    Entram com status 'concluido' de propósito. Motivo: em vários desses
--    períodos antigos a soma dos dias lançados não fecha os 30 (a Elen, por
--    exemplo, tem 20 dos 30 no período 2023/2024). Como o relatório de
--    PROGRAMAÇÃO de julho/2026 — que lista tudo que ainda tem saldo — não cita
--    nenhum deles, o DP os considera resolvidos. Sem 'concluido', o resto
--    viraria saldo em aberto e apareceria como "vencida" no Controle.
-- ---------------------------------------------------------------------
INSERT INTO periodos_aquisitivos
  (colaborador_id, data_inicio, data_fim, dias_direito, abono_utilizado, dias_abono, status)
SELECT DISTINCT c.id, h.aquisitivo_inicio, h.aquisitivo_fim, 30, 0, 0, 'concluido'
  FROM hist_ferias h
  JOIN colaboradores c
    ON translate(upper(trim(c.nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
     = translate(upper(trim(h.nome_pdf)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
    ON CONFLICT (colaborador_id, data_inicio) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. Lançamentos com as datas reais de gozo
--
--    Antes, apaga os provisórios da carga anterior (marcador
--    '[programacao-ferias-julho-2026]'), que só tinham a QUANTIDADE de dias e
--    usavam a data do fim do aquisitivo como aproximação. Agora existe data
--    real, então eles são substituídos, não somados.
-- ---------------------------------------------------------------------
DELETE FROM lancamentos_ferias
 WHERE observacao IN ('[programacao-ferias-julho-2026]', '[historico-ferias-calculadas-2026-06]', '[programacao-ferias-julho-2026-sem-data]');

INSERT INTO lancamentos_ferias
  (periodo_aquisitivo_id, origem, status, dias, data_inicio_gozo, data_fim_gozo,
   abono, dias_abono, abono_inicio, abono_fim, observacao, criado_por)
SELECT p.id,
       'manual',
       'concluida',
       h.dias_ferias,
       h.ferias_inicio,
       h.ferias_fim,
       CASE WHEN h.dias_abono > 0 THEN 1 ELSE 0 END,
       h.dias_abono,
       h.abono_inicio,
       h.abono_fim,
       '[historico-ferias-calculadas-2026-06]',
       'Relação de Férias Calculadas (PDF do DP)'
  FROM hist_ferias h
  JOIN colaboradores c
    ON translate(upper(trim(c.nome)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
     = translate(upper(trim(h.nome_pdf)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN')
  JOIN periodos_aquisitivos p
    ON p.colaborador_id = c.id AND p.data_inicio = h.aquisitivo_inicio;

-- ---------------------------------------------------------------------
-- 3b. Complemento: dias gozados que a PROGRAMAÇÃO conhece e o histórico não
--
--     O histórico foi emitido em 17/06/2026 e a programação em 29/07/2026.
--     Nesse intervalo houve férias que só constam na programação — ela informa
--     a QUANTIDADE, sem as datas. Em 6 dos 10 casos os dois relatórios batem
--     exatamente; nos outros 4 falta um pedaço, que entra aqui como lançamento
--     sem data de gozo, marcado como "sem data no relatório". Sem isto, o saldo
--     de férias dessas 4 pessoas ficaria maior do que o DP informa.
-- ---------------------------------------------------------------------
INSERT INTO lancamentos_ferias
  (periodo_aquisitivo_id, origem, status, dias, data_inicio_gozo, data_fim_gozo,
   abono, dias_abono, observacao, criado_por)
SELECT g.periodo_id,
       'manual',
       'concluida',
       g.dias_faltantes,
       NULL,
       NULL,
       0,
       0,
       '[programacao-ferias-julho-2026-sem-data]',
       'Programação de Férias (dias sem data detalhada)'
  FROM (
    SELECT pg.periodo_id,
           pg.dias_programacao - COALESCE(SUM(l.dias), 0) AS dias_faltantes
      FROM gozo_programacao pg
      LEFT JOIN lancamentos_ferias l
             ON l.periodo_aquisitivo_id = pg.periodo_id
            AND l.status IN ('concluida', 'alterada')
     GROUP BY pg.periodo_id, pg.dias_programacao
    HAVING pg.dias_programacao - COALESCE(SUM(l.dias), 0) > 0
  ) g;

-- ---------------------------------------------------------------------
-- 4. Marca como 'concluido' todo período que ficou sem saldo
-- ---------------------------------------------------------------------
UPDATE periodos_aquisitivos p
   SET status = 'concluido'
 WHERE p.dias_direito - COALESCE((
         SELECT SUM(l.dias) FROM lancamentos_ferias l
          WHERE l.periodo_aquisitivo_id = p.id
            AND l.status IN ('concluida', 'alterada')), 0) <= 0;

-- ---------------------------------------------------------------------
-- 5. Conferência
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM hist_ferias)                                                        AS registros_no_relatorio,
  (SELECT COUNT(DISTINCT nome_pdf) FROM hist_ferias)                                        AS pessoas_no_relatorio,
  (SELECT COUNT(*) FROM lancamentos_ferias WHERE observacao = '[historico-ferias-calculadas-2026-06]')              AS lancamentos_com_data,
  (SELECT COUNT(*) FROM lancamentos_ferias WHERE observacao = '[programacao-ferias-julho-2026-sem-data]')  AS complementos_sem_data,
  (SELECT COUNT(*) FROM periodos_aquisitivos)                                               AS total_periodos,
  (SELECT COUNT(*) FROM periodos_aquisitivos WHERE status = 'concluido')                    AS periodos_concluidos;

COMMIT;
