-- ============================================================================
-- MIGRATION 004 — coluna `categoria` nos lançamentos da fatura
-- ----------------------------------------------------------------------------
-- O db/script.sql já tem `fatura_transacao.categoria`, mas o banco do Neon foi
-- criado antes dela. Sem esta coluna, a busca da fatura e o dashboard dão erro
-- ("column a.categoria does not exist").
-- Idempotente: pode rodar mais de uma vez. Não apaga nem altera dados.
-- Aplicar MANUALMENTE no SQL Editor do Neon (copie e execute tudo).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ============================================================================

-- 1º passo: coluna da categoria do lançamento (NULL = sem categoria)
ALTER TABLE fatura_transacao ADD COLUMN IF NOT EXISTS categoria VARCHAR(60);
