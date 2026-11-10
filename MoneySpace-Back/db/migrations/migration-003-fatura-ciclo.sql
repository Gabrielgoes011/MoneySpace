-- ============================================================================
-- MIGRATION 003 — ciclo da fatura (competência, fechamento e vencimento)
-- ----------------------------------------------------------------------------
-- Adiciona em `fatura_corpo`:
--   competencia      : mês da fatura no formato AAAA-MM (ex.: '2026-10')
--   data_fechamento  : dia em que a fatura fecha (calculado pelo dia do cartão)
--   data_vencimento  : dia em que a fatura vence (calculado pelo dia do cartão)
-- Troca a regra de unicidade: antes era (id_familia, titulo); agora é
-- (id_cartao, competencia), porque cada cartão tem a sua fatura por mês.
-- Idempotente: pode rodar mais de uma vez.
-- Aplicar MANUALMENTE no SQL Editor do Neon (copie e execute tudo).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ============================================================================

-- 1º passo: colunas do ciclo da fatura (NULL = fatura legada, criada antes do ciclo)
ALTER TABLE fatura_corpo ADD COLUMN IF NOT EXISTS competencia VARCHAR(7);
ALTER TABLE fatura_corpo ADD COLUMN IF NOT EXISTS data_fechamento DATE;
ALTER TABLE fatura_corpo ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- 2º passo: a regra antiga (título único por família) não serve com vários cartões
ALTER TABLE fatura_corpo DROP CONSTRAINT IF EXISTS uq_fatura_titulo;

-- 3º passo: só uma fatura por cartão e competência
CREATE UNIQUE INDEX IF NOT EXISTS uq_fatura_cartao_competencia ON fatura_corpo(id_cartao, competencia);
