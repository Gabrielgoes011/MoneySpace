-- ============================================================================
--  MoneySpace - SCRIPT DE CRIAÇÃO DO BANCO (BASE)
-- ============================================================================
--  Banco: PostgreSQL (Neon). Base mínima do projeto: multi-tenant por família
--  com usuários e autenticação. As demais tabelas do domínio serão criadas
--  conforme o app crescer.
--
--  CONVENÇÕES
--  ----------
--  - snake_case em tudo. PK sempre `id` (UUID). FK com prefixo `id_`.
--  - Carimbo de criação em TIMESTAMP (dt_cadastro).
--
--  ARQUITETURA MULTI-TENANT (RLS)
--  ------------------------------
--  Cada família é um tenant isolado pela coluna `id_familia` + Row-Level
--  Security. A cada request o backend abre uma transação e injeta:
--      SET LOCAL app.current_familia_id = '<uuid-da-familia-do-JWT>';
--  As policies filtram as linhas por esse contexto.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSÃO: geração automática de UUIDs
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- familia: o "tenant". Tudo no sistema pendura nela via id_familia.
--   Ex: { nome: 'Família Silva' }
-- ----------------------------------------------------------------------------
CREATE TABLE familia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- usuario: pessoas que logam no app. Pertencem a 1 família.
--   `senha`       -> hash bcrypt (nunca a senha pura).
--   `mfa_secreto` -> segredo TOTP cifrado. `mfa_ativo` liga o 2FA.
--
--   CONTROLE DE ACESSO (duas dimensões):
--     `is_master` (GLOBAL)      -> dono do APP (super admin). Só ele cria famílias.
--     `role`      (POR FAMÍLIA) -> 'ADMIN' (responsável) | 'MEMBRO' (comum).
-- ----------------------------------------------------------------------------
CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,            -- CPF (só dígitos)
    email VARCHAR(150) UNIQUE NOT NULL,         -- login; único no banco todo
    senha VARCHAR(255) NOT NULL,                -- hash bcrypt, nunca o texto puro
    mfa_secreto VARCHAR(100),                   -- segredo TOTP cifrado (opcional)
    mfa_ativo BOOLEAN DEFAULT false,            -- 2FA ligado?

    is_master BOOLEAN NOT NULL DEFAULT false,   -- dono do APP (global, super admin)
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBRO', -- papel na família: 'ADMIN' | 'MEMBRO'

    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_usuario_role CHECK (role IN ('ADMIN', 'MEMBRO'))
);


-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
CREATE INDEX idx_usuario_familia ON usuario(id_familia);
-- Índice parcial: há pouquíssimos masters (idealmente 1). Acelera "quem é master?".
CREATE INDEX idx_usuario_master  ON usuario(is_master) WHERE is_master = true;


-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) — isolamento por família
-- ----------------------------------------------------------------------------
-- `current_setting(..., true)` retorna NULL (em vez de erro) quando o contexto
-- não está setado, evitando quebra em tarefas internas.
-- ============================================================================
ALTER TABLE familia ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;

-- Família: só enxerga/edita a própria linha (a do contexto atual).
CREATE POLICY acesso_familia ON familia
    FOR ALL USING (id = current_setting('app.current_familia_id', true)::uuid);

-- Usuário: só os usuários da própria família.
CREATE POLICY acesso_usuario ON usuario
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);


-- ============================================================================
-- 5. EXEMPLO DE USO (referência — não executa)
-- ----------------------------------------------------------------------------
-- -- Criar uma família e seu primeiro usuário (master/admin):
-- INSERT INTO familia (nome) VALUES ('Família Silva');  -- id = 'fff...'
-- INSERT INTO usuario (id_familia, nome, cpf, email, senha, is_master, role)
-- VALUES ('fff...', 'Carlos', '00000000000', 'carlos@email.com', '<hash>', true, 'ADMIN');
-- ============================================================================
