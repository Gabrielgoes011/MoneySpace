-- ============================================================================
--  Migration 002: Adiciona papéis (roles) de usuário
--  Data: 2026-10-08
--  Descrição: Introduz o controle de acesso por papel no `usuario`:
--
--    - is_master (BOOLEAN, global): dono do APP inteiro (super admin).
--      Está ACIMA das famílias. Só ele pode criar novas famílias/tenants.
--      No uso interno atual, é a sua conta. Pensado para o futuro SaaS.
--
--    - role (VARCHAR, por família): papel do usuário DENTRO da própria família.
--      'ADMIN'  = responsável da família (cria contas, convida/gerencia membros).
--      'MEMBRO' = usuário comum (esposa, filho) — uso do dia a dia.
--
--  POR QUE DOIS CAMPOS (e não um só):
--    `is_master` é GLOBAL (vale no app inteiro); `role` é RELATIVO a UMA família.
--    São dimensões diferentes. Separá-los evita a pergunta sem sentido
--    "esse MASTER é admin de qual família?" e deixa o modelo pronto para o SaaS:
--    no signup público, o 1º usuário da família nasce ADMIN e is_master=false.
--
--  IMPORTANTE (segurança):
--    Estes campos definem o papel, mas NÃO se protegem sozinhos. A tabela
--    `usuario` tem RLS por id_familia; promover/rebaixar alguém (mexer em role
--    ou is_master) é uma operação sensível que DEVE ser autorizada na camada de
--    aplicação (ex.: só is_master promove outro master; só ADMIN mexe em MEMBRO
--    da própria família). A migration cuida apenas do schema.
--
--  NOTA sobre id_familia:
--    Mantemos usuario.id_familia como NOT NULL (inalterado). No uso interno o
--    master também tem a própria família. Se um dia for preciso um master
--    puramente administrativo (sem família), isso será tratado em migration
--    futura, pois exige revisar a FK e as policies de RLS.
-- ============================================================================


-- ============================================================================
-- 1. NOVAS COLUNAS EM usuario
-- ----------------------------------------------------------------------------
-- IF NOT EXISTS: a migration é idempotente (pode rodar de novo sem quebrar).
-- Defaults garantem que as linhas já existentes recebam valores seguros:
--   is_master = false (ninguém vira dono do app por acidente)
--   role      = 'MEMBRO' (papel mais restrito por padrão)
-- ============================================================================
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'MEMBRO';


-- ============================================================================
-- 2. RESTRIÇÃO DE VALORES PARA role
-- ----------------------------------------------------------------------------
-- Garante no banco que `role` só aceita os papéis previstos. Barreira final
-- contra valores inválidos vindos de um bug na aplicação.
-- (DROP antes de criar deixa a migration reexecutável.)
-- ============================================================================
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS chk_usuario_role;

ALTER TABLE usuario
    ADD CONSTRAINT chk_usuario_role CHECK (role IN ('ADMIN', 'MEMBRO'));


-- ============================================================================
-- 3. ÍNDICE (opcional, mas útil)
-- ----------------------------------------------------------------------------
-- Índice parcial só nos masters: a tabela terá pouquíssimos (idealmente 1).
-- Acelera a consulta "quem é master?" sem pesar nas linhas comuns.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_usuario_master ON usuario(is_master) WHERE is_master = true;


-- ============================================================================
-- 4. PROMOVER O PRIMEIRO MASTER (ajuste manual)
-- ----------------------------------------------------------------------------
-- Rode UMA vez, trocando o e-mail pelo da sua conta de dono do app.
-- Deixado comentado de propósito para não promover ninguém sem intenção.
-- ----------------------------------------------------------------------------
-- UPDATE usuario
--    SET is_master = true, role = 'ADMIN'
--  WHERE LOWER(email) = LOWER('seu-email@exemplo.com');


-- ============================================================================
-- 5. VERIFICAÇÃO (opcional - deixar comentado)
-- ----------------------------------------------------------------------------
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'usuario' AND column_name IN ('is_master', 'role');
--
-- SELECT nome, email, is_master, role FROM usuario ORDER BY is_master DESC;
