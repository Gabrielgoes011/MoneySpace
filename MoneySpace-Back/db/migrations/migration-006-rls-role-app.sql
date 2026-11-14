-- ============================================================================
-- MIGRATION 006 — RLS valendo de verdade (role da aplicação sem BYPASSRLS)
-- ----------------------------------------------------------------------------
-- PROBLEMA: o app conecta como neondb_owner, que é DONO das tabelas e tem
-- BYPASSRLS (herdado de neon_superuser). Para esse role as policies são ignoradas,
-- então o isolamento entre famílias só depende do WHERE id_familia das queries.
--
-- O QUE ESTA MIGRATION FAZ:
--   1º passo: cria o role app_moneyspace (LOGIN, sem BYPASSRLS, sem ser dono).
--   2º passo: dá a ele só as permissões que o código usa (menor privilégio).
--   3º passo: liga FORCE ROW LEVEL SECURITY (o dono também passa a respeitar as
--             policies, desde que não tenha BYPASSRLS).
--   4º passo: cria 3 funções SECURITY DEFINER para o LOGIN, que roda ANTES de existir
--             contexto de família (precisa achar o usuário pelo e-mail/id).
--
-- NÃO FAZ: não define a senha do role e não troca a DATABASE_URL (ver DEPOIS DE APLICAR).
-- Idempotente: pode rodar mais de uma vez. Não apaga nem altera dados.
-- Aplicar MANUALMENTE no SQL Editor do Neon (copie e execute tudo), logado como o dono.
-- Mesma definição que está em db/script.sql (fonte da verdade).
--
-- DEPOIS DE APLICAR (nesta ordem):
--   a) Defina a senha (NÃO a coloque neste arquivo):
--        ALTER ROLE app_moneyspace WITH PASSWORD <senha-forte entre aspas simples>
--   b) Rode node db/testa_rls.mjs (testa tudo dentro de uma transação que é desfeita).
--   c) Só com o back ajustado para usar as funções de login (login.repositories.js e
--      cadFamilia.Repositories.js), troque a DATABASE_URL para o role app_moneyspace.
--      Trocar antes disso derruba o login.
--
-- ATENÇÃO — TABELA NOVA no futuro: o role não tem permissão nela automaticamente.
--   Toda migration que cria tabela precisa de GRANT ... ON <tabela> TO app_moneyspace,.
--
-- REVERTER (se precisar):
--   DROP FUNCTION IF EXISTS fn_login_buscar_por_email(TEXT)
--   DROP FUNCTION IF EXISTS fn_login_buscar_por_id(UUID)
--   DROP FUNCTION IF EXISTS fn_login_atualizar_2fa(UUID, BOOLEAN, TEXT, BOOLEAN)
--   ALTER TABLE <tabela> NO FORCE ROW LEVEL SECURITY, (nas 8 tabelas)
--   REASSIGN OWNED BY app_moneyspace TO CURRENT_USER, DROP OWNED BY app_moneyspace, DROP ROLE app_moneyspace
-- ============================================================================

-- 1º passo: role da aplicação (sem senha aqui, sem poder de ignorar RLS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_moneyspace') THEN
        CREATE ROLE app_moneyspace LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
    END IF;
END
$$;

-- permite ao dono usar SET ROLE app_moneyspace (usado só pelo testa_rls.mjs)
DO $$
BEGIN
    EXECUTE format('GRANT app_moneyspace TO %I', current_user);
END
$$;

-- 2º passo: permissões mínimas, tabela por tabela (o que o código realmente faz)
GRANT USAGE ON SCHEMA public TO app_moneyspace;

-- familia: ler e renomear. SEM INSERT/DELETE (o app não cria família).
GRANT SELECT, UPDATE ON familia TO app_moneyspace;
-- usuario: sem DELETE (não existe excluir usuário)
GRANT SELECT, INSERT, UPDATE ON usuario TO app_moneyspace;
GRANT SELECT, INSERT, UPDATE, DELETE ON cartao TO app_moneyspace;
GRANT SELECT, INSERT, UPDATE, DELETE ON fatura_corpo TO app_moneyspace;
GRANT SELECT, INSERT, UPDATE, DELETE ON fatura_transacao TO app_moneyspace;
GRANT SELECT, INSERT ON rateio_pessoa TO app_moneyspace;
GRANT SELECT, INSERT, UPDATE, DELETE ON fatura_rateio TO app_moneyspace;
GRANT SELECT, INSERT, DELETE ON fatura_rateio_pagamento TO app_moneyspace;
-- utilitario é global (sem RLS): ler e cadastrar categoria (só is_master, checado no controller)
GRANT SELECT, INSERT ON utilitario TO app_moneyspace;

-- 3º passo: o dono também respeita as policies (só vale para quem NÃO tem BYPASSRLS)
ALTER TABLE familia                 FORCE ROW LEVEL SECURITY;
ALTER TABLE usuario                 FORCE ROW LEVEL SECURITY;
ALTER TABLE cartao                  FORCE ROW LEVEL SECURITY;
ALTER TABLE fatura_corpo            FORCE ROW LEVEL SECURITY;
ALTER TABLE fatura_transacao        FORCE ROW LEVEL SECURITY;
ALTER TABLE rateio_pessoa           FORCE ROW LEVEL SECURITY;
ALTER TABLE fatura_rateio           FORCE ROW LEVEL SECURITY;
ALTER TABLE fatura_rateio_pagamento FORCE ROW LEVEL SECURITY;

-- 4º passo: funções do login. Rodam com os direitos do DONO (SECURITY DEFINER) para
-- enxergar usuario sem contexto de família, mas expõem só o que o login precisa.
-- search_path fixo evita sequestro de função/tabela por outro schema.

-- busca o usuário pelo e-mail (traz o hash da senha, só o login usa)
CREATE OR REPLACE FUNCTION fn_login_buscar_por_email(p_email TEXT)
RETURNS TABLE (
    id UUID,
    id_familia UUID,
    nome TEXT,
    email TEXT,
    senha TEXT,
    mfa_secreto TEXT,
    mfa_ativo BOOLEAN,
    familia_nome TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        a.id,
        a.id_familia,
        a.nome::TEXT,
        a.email::TEXT,
        a.senha::TEXT,
        a.mfa_secreto::TEXT,
        COALESCE(a.mfa_ativo, false),
        b.nome::TEXT
    FROM usuario a
    INNER JOIN familia b ON b.id = a.id_familia
    WHERE LOWER(a.email) = LOWER(p_email)
    LIMIT 1
$$;

-- busca o usuário pelo id (me, refresh e 2FA). NÃO devolve a senha.
CREATE OR REPLACE FUNCTION fn_login_buscar_por_id(p_id UUID)
RETURNS TABLE (
    id UUID,
    id_familia UUID,
    nome TEXT,
    email TEXT,
    mfa_secreto TEXT,
    mfa_ativo BOOLEAN,
    familia_nome TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        a.id,
        a.id_familia,
        a.nome::TEXT,
        a.email::TEXT,
        a.mfa_secreto::TEXT,
        COALESCE(a.mfa_ativo, false),
        b.nome::TEXT
    FROM usuario a
    INNER JOIN familia b ON b.id = a.id_familia
    WHERE a.id = p_id
    LIMIT 1
$$;

-- atualiza só os campos de 2FA. p_alterar_segredo = false mantém o segredo atual
-- (permite gravar NULL ao desativar), p_mfa_ativo = NULL mantém o estado atual.
CREATE OR REPLACE FUNCTION fn_login_atualizar_2fa(
    p_id UUID,
    p_alterar_segredo BOOLEAN,
    p_mfa_secreto TEXT,
    p_mfa_ativo BOOLEAN
)
RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE usuario a
    SET
        mfa_secreto = CASE WHEN p_alterar_segredo THEN p_mfa_secreto ELSE a.mfa_secreto END,
        mfa_ativo = COALESCE(p_mfa_ativo, a.mfa_ativo)
    WHERE a.id = p_id
$$;

-- só o role da aplicação executa (PUBLIC não)
REVOKE ALL ON FUNCTION fn_login_buscar_por_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_login_buscar_por_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_login_atualizar_2fa(UUID, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_login_buscar_por_email(TEXT) TO app_moneyspace;
GRANT EXECUTE ON FUNCTION fn_login_buscar_por_id(UUID) TO app_moneyspace;
GRANT EXECUTE ON FUNCTION fn_login_atualizar_2fa(UUID, BOOLEAN, TEXT, BOOLEAN) TO app_moneyspace;
