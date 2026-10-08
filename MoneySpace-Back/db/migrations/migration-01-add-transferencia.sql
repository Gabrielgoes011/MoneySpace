-- ============================================================================
--  Migration 001: Adiciona tabela de transferências entre membros da família
--  Data: 2026-10-07
--  Descrição: Cria tabela `transferencia` para registrar PIX/transferências
--             internas entre usuários da mesma família, com histórico completo.
-- ============================================================================

-- ============================================================================
-- 1. CRIAR TABELA transferencia
-- ============================================================================
CREATE TABLE transferencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_usuario_remetente UUID NOT NULL REFERENCES usuario(id),    -- quem enviou
    id_usuario_destinatario UUID NOT NULL REFERENCES usuario(id), -- quem recebeu

    valor NUMERIC(14,2) NOT NULL,                 -- valor em reais
    descricao VARCHAR(255),                       -- opcional (ex: 'Mesada', 'Gasto compartilhado')

    dt_transferencia TIMESTAMP DEFAULT NOW(),     -- quando a transferência foi feita
    usuario_cadastro VARCHAR(100),                -- nome de quem registrou
    dt_cadastro TIMESTAMP DEFAULT NOW()
);


-- ============================================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX idx_transferencia_familia ON transferencia(id_familia);
CREATE INDEX idx_transferencia_remetente ON transferencia(id_usuario_remetente);
CREATE INDEX idx_transferencia_destinatario ON transferencia(id_usuario_destinatario);
CREATE INDEX idx_transferencia_data ON transferencia(dt_transferencia);


-- ============================================================================
-- 3. ROW-LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE transferencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY acesso_transferencia ON transferencia
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);


-- ============================================================================
-- 4. VERIFICAÇÃO (opcional - deixar comentado)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name='transferencia';
