-- ============================================================================
-- MIGRATION 005 — rateio de uma compra entre várias pessoas
-- ----------------------------------------------------------------------------
-- Uma compra pode ser rachada entre pessoas (da família ou de fora). Cada pessoa
-- tem uma parte (valor previsto) e pode pagar em vários pagamentos. Quem adiantou
-- a compra (o portador do lançamento) absorve o que não for cobrado.
--
-- Cria:
--   fatura_transacao.rateado   : flag "esta compra é rateada" (linha atípica na tela)
--   rateio_pessoa              : nomes de quem divide (só nome), por família
--   fatura_rateio              : a parte de cada pessoa em um lançamento
--   fatura_rateio_pagamento    : cada pagamento recebido de uma parte
-- O "valor pago" de uma parte NÃO é coluna: é a soma dos pagamentos. Pagar a mais
-- que o previsto é permitido (51,50 previsto, 52 pago).
-- Idempotente: pode rodar mais de uma vez. Não apaga nem altera dados.
-- Aplicar MANUALMENTE no SQL Editor do Neon (copie e execute tudo).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ============================================================================

-- 1º passo: flag do lançamento rateado
ALTER TABLE fatura_transacao ADD COLUMN IF NOT EXISTS rateado BOOLEAN NOT NULL DEFAULT false;

-- 2º passo: pessoas do rateio (só o nome; "Marcos" é reaproveitado nas próximas compras)
CREATE TABLE IF NOT EXISTS rateio_pessoa (
    id_pessoa UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rateio_pessoa_nome ON rateio_pessoa(id_familia, LOWER(nome));

-- 3º passo: a parte de cada pessoa em um lançamento (apagou o lançamento, apagam as partes)
CREATE TABLE IF NOT EXISTS fatura_rateio (
    id_rateio UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_transacao UUID NOT NULL REFERENCES fatura_transacao(id_transacao) ON DELETE CASCADE,
    id_pessoa UUID NOT NULL REFERENCES rateio_pessoa(id_pessoa) ON DELETE RESTRICT,
    valor_previsto NUMERIC(14,2) NOT NULL CHECK (valor_previsto > 0),
    absorvido BOOLEAN NOT NULL DEFAULT false,
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_rateio_transacao_pessoa UNIQUE (id_transacao, id_pessoa)
);

-- 4º passo: os pagamentos de cada parte (quantos forem; podem passar do previsto)
CREATE TABLE IF NOT EXISTS fatura_rateio_pagamento (
    id_pagamento UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_rateio UUID NOT NULL REFERENCES fatura_rateio(id_rateio) ON DELETE CASCADE,
    valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
    dt_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- 5º passo: índices
CREATE INDEX IF NOT EXISTS idx_rateio_pessoa_familia ON rateio_pessoa(id_familia);
CREATE INDEX IF NOT EXISTS idx_fat_rateio_familia    ON fatura_rateio(id_familia);
CREATE INDEX IF NOT EXISTS idx_fat_rateio_transacao  ON fatura_rateio(id_transacao);
CREATE INDEX IF NOT EXISTS idx_fat_rateio_pag_familia ON fatura_rateio_pagamento(id_familia);
CREATE INDEX IF NOT EXISTS idx_fat_rateio_pag_rateio ON fatura_rateio_pagamento(id_rateio);

-- 6º passo: isolamento por família (RLS), igual às outras tabelas
ALTER TABLE rateio_pessoa ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_rateio ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_rateio_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acesso_rateio_pessoa ON rateio_pessoa;
CREATE POLICY acesso_rateio_pessoa ON rateio_pessoa
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_fatura_rateio ON fatura_rateio;
CREATE POLICY acesso_fatura_rateio ON fatura_rateio
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_fatura_rateio_pagamento ON fatura_rateio_pagamento;
CREATE POLICY acesso_fatura_rateio_pagamento ON fatura_rateio_pagamento
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);
