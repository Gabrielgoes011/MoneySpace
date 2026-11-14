-- ============================================================================
-- MIGRATION 007 — acesso MASTER (dono do app) sem desligar o RLS
-- ----------------------------------------------------------------------------
-- O role app_moneyspace NÃO tem BYPASSRLS, então o master não ganha poder "geral".
-- O poder vem por caminhos estreitos, conferidos DENTRO do banco:
--   A) funções de gestão que só rodam para quem é is_master = true:
--        fn_master_listar_familias  lista todas as famílias com totais
--        fn_master_criar_familia    cria a família e o primeiro usuário ADMIN dela
--   B) "entrar" em outra família: o back (rlsMiddleware) confere fn_master_eh_master
--      e troca o contexto app.current_familia_id. Para o master continuar enxergando a
--      PRÓPRIA linha em usuario dentro de outra família, existe a policy acesso_usuario_proprio.
--
-- QUEM É O MASTER: sempre lido do banco (usuario.is_master), nunca do token.
-- QUEM CHAMA: as funções leem o usuário do contexto da requisição (app.current_user_id),
-- que o rlsMiddleware grava a partir do token já validado.
--
-- Cria: policy acesso_usuario_proprio, fn_master_eh_master, fn_master_listar_familias, fn_master_criar_familia.
-- Idempotente: pode rodar mais de uma vez. Não apaga nem altera dados.
-- Aplicar MANUALMENTE no DBeaver ou no SQL Editor do Neon, como dono (neondb_owner).
-- Mesma definição que está em db/script.sql (fonte da verdade).
-- ATENÇÃO: nunca usar ponto e vírgula dentro de comentário SQL (o editor divide o texto ali).
--
-- ANTES DE USAR: confirme que o seu usuário é master (rode como dono):
--   SELECT email, is_master FROM usuario
-- Se não for, ligue com: UPDATE usuario SET is_master = true WHERE email = '<seu-email>'
--
-- REVERTER (se precisar):
--   DROP FUNCTION IF EXISTS fn_master_criar_familia(TEXT, TEXT, TEXT, TEXT, TEXT)
--   DROP FUNCTION IF EXISTS fn_master_listar_familias()
--   DROP FUNCTION IF EXISTS fn_master_eh_master()
--   DROP POLICY IF EXISTS acesso_usuario_proprio ON usuario
-- ============================================================================

-- 1º passo: o usuário logado sempre enxerga a própria linha, mesmo no contexto de outra família.
-- Policies permissivas se somam (OR) com a acesso_usuario. NULLIF evita erro de cast quando o contexto está vazio.
DROP POLICY IF EXISTS acesso_usuario_proprio ON usuario;
CREATE POLICY acesso_usuario_proprio ON usuario
    FOR SELECT USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- 2º passo: confere se quem está na requisição é master (lê o banco, ignora o RLS por ser DEFINER)
CREATE OR REPLACE FUNCTION fn_master_eh_master()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM usuario a
        WHERE a.id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND a.is_master = true
    )
$$;

-- 3º passo: lista todas as famílias com totais (só master)
CREATE OR REPLACE FUNCTION fn_master_listar_familias()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    dt_cadastro TIMESTAMP,
    total_usuarios INTEGER,
    total_cartoes INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT fn_master_eh_master() THEN
        RAISE EXCEPTION 'Acesso restrito ao dono do app.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.nome::TEXT,
        a.dt_cadastro,
        (SELECT COUNT(*)::INTEGER FROM usuario b WHERE b.id_familia = a.id),
        (SELECT COUNT(*)::INTEGER FROM cartao c WHERE c.id_familia = a.id)
    FROM familia a
    ORDER BY a.dt_cadastro DESC;
END
$$;

-- 4º passo: cria a família e o primeiro usuário ADMIN dela, na mesma chamada (só master).
-- O hash da senha vem pronto do back (bcrypt) e CPF/e-mail já chegam validados.
-- E-mail ou CPF repetido estoura 23505 e a chamada inteira é desfeita.
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
    VALUES (v_familia_id, p_admin_nome, p_admin_cpf, LOWER(p_admin_email), p_admin_senha_hash, 'ADMIN')
    RETURNING usuario.id INTO v_usuario_id;

    RETURN QUERY SELECT v_familia_id, v_usuario_id;
END
$$;

-- 5º passo: só o role da aplicação executa (PUBLIC não)
REVOKE ALL ON FUNCTION fn_master_eh_master() FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_master_listar_familias() FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_master_criar_familia(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_master_eh_master() TO app_moneyspace;
GRANT EXECUTE ON FUNCTION fn_master_listar_familias() TO app_moneyspace;
GRANT EXECUTE ON FUNCTION fn_master_criar_familia(TEXT, TEXT, TEXT, TEXT, TEXT) TO app_moneyspace;
