-- ============================================================================
-- MIGRATION 001 — tabela `cartao` + RLS
-- ----------------------------------------------------------------------------
-- Cria a tabela de cartões de crédito da família. Cada cartão tem um DONO
-- (usuario) e pode ter UM cartão `principal` por família (o que aparece no
-- dashboard). Isolamento por família via RLS. Idempotente: pode rodar várias vezes.
-- Não altera nenhuma outra tabela.
-- Aplicar MANUALMENTE no SQL Editor do Neon (copie e execute tudo).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ============================================================================

-- 1º passo: cria a tabela
CREATE TABLE IF NOT EXISTS cartao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_usuario UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    nome VARCHAR(100) NOT NULL,
    final CHAR(4) NOT NULL,
    limite NUMERIC(14,2),
    dia_fechamento SMALLINT,
    dia_vencimento SMALLINT,
    principal BOOLEAN NOT NULL DEFAULT false,
    arquivado BOOLEAN NOT NULL DEFAULT false,
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_cartao_final CHECK (final ~ '^[0-9]{4}$'),
    CONSTRAINT chk_cartao_limite CHECK (limite IS NULL OR limite >= 0),
    CONSTRAINT chk_cartao_dia_fechamento CHECK (dia_fechamento IS NULL OR dia_fechamento BETWEEN 1 AND 31),
    CONSTRAINT chk_cartao_dia_vencimento CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31),
    CONSTRAINT uq_cartao_familia_nome UNIQUE (id_familia, nome)
);

-- 2º passo: só 1 cartão principal por família (índice único parcial)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cartao_principal_familia ON cartao(id_familia) WHERE principal = true;

-- 3º passo: índices de consulta (toda consulta filtra por família)
CREATE INDEX IF NOT EXISTS idx_cartao_familia ON cartao(id_familia);
CREATE INDEX IF NOT EXISTS idx_cartao_usuario ON cartao(id_usuario);

-- 4º passo: liga o RLS e cria a policy de isolamento por família
ALTER TABLE cartao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acesso_cartao ON cartao;
CREATE POLICY acesso_cartao ON cartao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);



--Policy "acesso_cartao" for relation "cartao" does not exist, skipping