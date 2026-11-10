-- ============================================================================
-- MIGRATION 002 — liga a fatura ao cartão (base para excluir cartão sem movimento)
-- ----------------------------------------------------------------------------
-- Adiciona `id_cartao` em `fatura_corpo`: cada fatura pertence a um cartão.
-- Com isso dá para saber se um cartão tem lançamentos (fatura_transacao).
-- ON DELETE RESTRICT: o banco não deixa apagar um cartão que tenha fatura.
-- Faturas antigas ficam com id_cartao NULL (legado, sem cartão vinculado).
-- Idempotente: pode rodar mais de uma vez.
-- Aplicar MANUALMENTE no SQL Editor do Neon (copie e execute tudo).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ============================================================================

-- 1º passo: coluna de ligação com o cartão (NULL = fatura legada)
ALTER TABLE fatura_corpo ADD COLUMN IF NOT EXISTS id_cartao UUID REFERENCES cartao(id) ON DELETE RESTRICT;

-- 2º passo: índice para contar/buscar faturas por cartão
CREATE INDEX IF NOT EXISTS idx_fatura_cartao ON fatura_corpo(id_cartao);
