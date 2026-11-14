-- ============================================================================
-- MIGRATION 008 — perfil do usuário em formato legível (Admin e Membro)
-- ----------------------------------------------------------------------------
-- Decisão do Gabriel: o valor de usuario.role deixa de ser ADMIN e MEMBRO (maiúsculas)
-- e passa a ser Admin e Membro, no banco e em todo o código.
--
-- O que faz:
--   1º passo: solta a regra antiga chk_usuario_role (só aceitava maiúsculas).
--   2º passo: converte os valores já gravados (ADMIN para Admin e MEMBRO para Membro).
--   3º passo: troca o valor padrão da coluna para Membro e recria a regra com os valores novos.
--   4º passo: recria fn_master_criar_familia para criar o primeiro usuário como Admin.
--
-- ORDEM DE APLICAÇÃO: o código novo (que compara com Admin e Membro) e esta migration precisam
-- entrar juntos. Em desenvolvimento aplique a migration logo depois de salvar o código.
-- Em produção suba o código novo e aplique esta migration em seguida.
-- Enquanto a migration não rodar, só o dono do app (is_master) consegue gerenciar usuários e cartões.
--
-- Idempotente: pode rodar mais de uma vez. Não apaga dados.
-- Aplicar MANUALMENTE no DBeaver ou no SQL Editor do Neon, como dono (neondb_owner).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ATENÇÃO: nunca usar ponto e vírgula dentro de comentário SQL (o editor divide o texto ali).
--
-- REVERTER (se precisar):
--   ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_role
--   UPDATE usuario SET role = UPPER(role)
--   ALTER TABLE usuario ALTER COLUMN role SET DEFAULT 'MEMBRO'
--   ALTER TABLE usuario ADD CONSTRAINT chk_usuario_role CHECK (role IN ('ADMIN', 'MEMBRO'))
--   e recriar fn_master_criar_familia com 'ADMIN' (ver migration-007-master.sql)
-- ============================================================================

-- 1º passo: solta a regra antiga
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_role;

-- 2º passo: converte o que já está gravado
UPDATE usuario SET role = 'Admin' WHERE role = 'ADMIN';
UPDATE usuario SET role = 'Membro' WHERE role = 'MEMBRO';

-- 3º passo: valor padrão e regra nova
ALTER TABLE usuario ALTER COLUMN role SET DEFAULT 'Membro';
ALTER TABLE usuario ADD CONSTRAINT chk_usuario_role CHECK (role IN ('Admin', 'Membro'));

-- 4º passo: a função do dono do app cria o primeiro usuário da família como Admin
CREATE OR REPLACE FUNCTION fn_master_criar_familia(
    p_nome TEXT,
    p_admin_nome TEXT,
    p_admin_cpf TEXT,
    p_admin_email TEXT,
    p_admin_senha_hash TEXT
)
RETURNS TABLE (
    nova_familia_id UUID,
    novo_usuario_id UUID
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_familia_id UUID;
    v_usuario_id UUID;
BEGIN
    IF NOT fn_master_eh_master() THEN
        RAISE EXCEPTION 'Acesso restrito ao dono do app.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO familia (nome)
    VALUES (p_nome)
    RETURNING familia.id INTO v_familia_id;

    INSERT INTO usuario (id_familia, nome, cpf, email, senha, role)
    VALUES (v_familia_id, p_admin_nome, p_admin_cpf, LOWER(p_admin_email), p_admin_senha_hash, 'Admin')
    RETURNING usuario.id INTO v_usuario_id;

    RETURN QUERY SELECT v_familia_id, v_usuario_id;
END
$$;
