-- ============================================================================
--  MoneySpace - SCRIPT DE CRIAÇÃO DO BANCO (BASE + CONTROLE DE FATURA SIMPLES)
-- ============================================================================
--  Banco: PostgreSQL (Neon). Multi-tenant por família com RLS.
--  IDEMPOTENTE: pode ser executado várias vezes sem erro (usa IF NOT EXISTS,
--  ON CONFLICT e DROP POLICY IF EXISTS antes de criar as policies).
--
--  CONVENÇÕES
--  ----------
--  - snake_case em tudo. FK com prefixo `id_`. Dinheiro em NUMERIC(14,2)
--    (o driver pg entrega como string -> use Number()).
--  - Datas do "fato" em DATE; carimbo de criação em TIMESTAMP (dt_cadastro).
--
--  ARQUITETURA MULTI-TENANT (RLS)
--  ------------------------------
--  Cada família é um tenant isolado por `id_familia` + Row-Level Security.
--  A cada request o backend injeta o contexto:
--      SELECT set_config('app.current_familia_id', '<uuid-do-JWT>', true);
--  As policies filtram as linhas por esse contexto. A tabela `utilitario` é
--  GLOBAL (opções de sistema, só leitura) -> NÃO tem id_familia nem RLS.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSÕES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- crypt()/gen_salt() p/ seed de senha


-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- familia: o "tenant". Tudo pendura nela via id_familia.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS familia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- usuario: pessoas que logam. Pertencem a 1 família.
--   `senha`       -> hash bcrypt (nunca o texto puro).
--   `mfa_secreto` -> segredo TOTP cifrado; `mfa_ativo` liga o 2FA.
--   `is_master` (GLOBAL) -> dono do app; `role` (POR FAMÍLIA) -> ADMIN | MEMBRO.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,         -- login
    senha VARCHAR(255) NOT NULL,                -- hash bcrypt
    mfa_secreto VARCHAR(100),
    mfa_ativo BOOLEAN DEFAULT false,

    is_master BOOLEAN NOT NULL DEFAULT false,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBRO',

    ativo BOOLEAN DEFAULT true,                 -- desativar sem apagar
    ultimo_acesso TIMESTAMP,                    -- atualizado no login (opcional)
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_usuario_role CHECK (role IN ('ADMIN', 'MEMBRO'))
);

-- ----------------------------------------------------------------------------
-- cartao: cartões de crédito da família. Cada cartão tem um DONO (usuario).
--   `final`: últimos 4 dígitos (ex.: '4821').
--   `principal`: só 1 por família (índice único parcial) -> carrega no dashboard.
--   `arquivado` = some das telas sem apagar (o histórico continua).
--   `usuario_cadastro` = nome de quem cadastrou (snapshot, sem JOIN).
-- ----------------------------------------------------------------------------
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

-- Só 1 cartão principal por família (índice único parcial).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cartao_principal_familia ON cartao(id_familia) WHERE principal = true;

-- ----------------------------------------------------------------------------
-- utilitario: lista genérica e GLOBAL (tipo, valor) que alimenta selects do
--   front. Ex: tipo='status'. Somente leitura para o usuário -> SEM id_familia
--   e SEM RLS. `ordem` controla a ordenação no select.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilitario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(40) NOT NULL,                  -- ex: 'status'
    valor VARCHAR(60) NOT NULL,                 -- ex: 'pendente'
    ordem SMALLINT DEFAULT 0,
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_utilitario_tipo_valor UNIQUE (tipo, valor)
);

-- Seed das opções de `status` (minúsculas, sem '_'). ON CONFLICT: não duplica
-- se já existirem no banco (a unique é por tipo+valor).
INSERT INTO utilitario (tipo, valor, ordem) VALUES
    ('status', 'pendente',      1),
    ('status', 'na hora',       2),
    ('status', 'no fechamento', 3),
    ('status', 'nao aplicavel', 4)
ON CONFLICT (tipo, valor) DO NOTHING;

-- Seed das categorias (tipo='categoria'). O `valor` já é o rótulo exibido no
-- dropdown do front (sem de-para). ON CONFLICT: não duplica em reruns.
INSERT INTO utilitario (tipo, valor, ordem) VALUES
    ('categoria', 'Alimentação & Mercado',     1),
    ('categoria', 'Farmácia & Saúde',          2),
    ('categoria', 'Transporte & Combustível',  3),
    ('categoria', 'Compras & Vestuário',       4),
    ('categoria', 'Lazer & Restaurantes',      5),
    ('categoria', 'Educação & Cursos',         6),
    ('categoria', 'Serviços & Assinaturas',    7),
    ('categoria', 'Pet & Veterinário',         8),
    ('categoria', 'Outros',                    9)
ON CONFLICT (tipo, valor) DO NOTHING;

-- ----------------------------------------------------------------------------
-- fatura_corpo: a fatura/competência (uma por família + título). Guarda o
--   saldo de reserva que o usuário digita e o status do ciclo.
--   `titulo`     = rótulo do ciclo (ex: 'Outubro / 2026').
--   `status_fat` : 'ABERTA' (editável/importável) -> 'FECHADA'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fatura_corpo (
    id_fatura UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    titulo VARCHAR(50) NOT NULL,                           -- 'Outubro / 2026'
    saldo_reserva NUMERIC(14,2) NOT NULL DEFAULT 0,        -- saldo digitado no app
    status_fat VARCHAR(20) NOT NULL DEFAULT 'ABERTA',

    dt_fechamento TIMESTAMP,                               -- quando fechou (NULL = aberta)
    id_cartao UUID REFERENCES cartao(id) ON DELETE RESTRICT, -- cartão da fatura (NULL = legada)
    competencia VARCHAR(7),                                -- mês da fatura 'AAAA-MM' (NULL = legada)
    data_fechamento DATE,                                  -- dia que a fatura fecha (pelo dia do cartão)
    data_vencimento DATE,                                  -- dia que a fatura vence (pelo dia do cartão)
    usuario_cadastro VARCHAR(100),                         -- nome de quem criou
    dt_cadastro TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_fatura_status CHECK (status_fat IN ('ABERTA', 'FECHADA'))
);
-- Uma fatura por cartão e competência (cada cartão tem a sua).
CREATE UNIQUE INDEX IF NOT EXISTS uq_fatura_cartao_competencia ON fatura_corpo(id_cartao, competencia);

-- ----------------------------------------------------------------------------
-- fatura_transacao: os lançamentos da fatura (uma linha do CSV = um registro).
--   `status_transacao` usa EXATAMENTE os valores da `utilitario`
--     (tipo='status'): 'pendente' | 'na hora' | 'no fechamento' | 'nao aplicavel'.
--   `portador` = nome do portador vindo do CSV (ex: 'GABRIEL GOES').
--   `valor` = valor normalizado (positivo). `parcela` = '-' ou 'N de M'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fatura_transacao (
    id_transacao UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_fatura UUID NOT NULL REFERENCES fatura_corpo(id_fatura) ON DELETE CASCADE,

    dt_compra DATE NOT NULL,                               -- data do fato
    estabelecimento VARCHAR(255) NOT NULL,
    portador VARCHAR(100),                                 -- nome do CSV
    valor NUMERIC(14,2) NOT NULL,
    parcela VARCHAR(20) DEFAULT '-',                       -- '-' ou 'N de M'

    categoria VARCHAR(60),                                 -- rótulo da utilitario (tipo='categoria')
    status_transacao VARCHAR(20) NOT NULL DEFAULT 'pendente',

    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_status_transacao CHECK (status_transacao IN
        ('pendente', 'na hora', 'no fechamento', 'nao aplicavel'))
);


-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_usuario_familia  ON usuario(id_familia);
CREATE INDEX IF NOT EXISTS idx_cartao_familia   ON cartao(id_familia);
CREATE INDEX IF NOT EXISTS idx_cartao_usuario   ON cartao(id_usuario);
CREATE INDEX IF NOT EXISTS idx_usuario_email     ON usuario(email);
-- Índice parcial: há pouquíssimos masters (idealmente 1).
CREATE INDEX IF NOT EXISTS idx_usuario_master    ON usuario(is_master) WHERE is_master = true;

CREATE INDEX IF NOT EXISTS idx_utilitario_tipo   ON utilitario(tipo);

CREATE INDEX IF NOT EXISTS idx_fatura_familia    ON fatura_corpo(id_familia);
CREATE INDEX IF NOT EXISTS idx_fatura_cartao     ON fatura_corpo(id_cartao);

CREATE INDEX IF NOT EXISTS idx_fat_trans_familia  ON fatura_transacao(id_familia);
CREATE INDEX IF NOT EXISTS idx_fat_trans_fatura   ON fatura_transacao(id_fatura);
CREATE INDEX IF NOT EXISTS idx_fat_trans_portador ON fatura_transacao(portador);
CREATE INDEX IF NOT EXISTS idx_fat_trans_status    ON fatura_transacao(status_transacao);
CREATE INDEX IF NOT EXISTS idx_fat_trans_categoria ON fatura_transacao(categoria);
CREATE INDEX IF NOT EXISTS idx_fat_trans_data      ON fatura_transacao(dt_compra);


-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) — isolamento por família
-- ----------------------------------------------------------------------------
-- `current_setting(..., true)` retorna NULL (em vez de erro) quando o contexto
-- não está setado. `utilitario` é GLOBAL -> fica de fora do RLS de propósito.
-- ENABLE RLS é idempotente. Policies: DROP IF EXISTS + CREATE (o Postgres não
-- tem CREATE POLICY IF NOT EXISTS), para o script poder rodar de novo.
-- ============================================================================
ALTER TABLE familia          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_corpo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_transacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartao           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acesso_familia ON familia;
CREATE POLICY acesso_familia ON familia
    FOR ALL USING (id = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_usuario ON usuario;
CREATE POLICY acesso_usuario ON usuario
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_fatura ON fatura_corpo;
CREATE POLICY acesso_fatura ON fatura_corpo
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_cartao ON cartao;
CREATE POLICY acesso_cartao ON cartao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_fatura_transacao ON fatura_transacao;
CREATE POLICY acesso_fatura_transacao ON fatura_transacao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);


-- ============================================================================
-- 5. SEED (referência — descomente e ajuste para criar família + usuários)
-- ----------------------------------------------------------------------------
-- A senha é gravada já com hash bcrypt via pgcrypto: crypt('senha', gen_salt('bf')).
-- Troque 'TROQUE_A_SENHA' pela senha real de cada um antes de rodar.
-- Idempotente: ON CONFLICT no email não recria se já existir.
--
-- WITH nova_familia AS (
--   INSERT INTO familia (nome) VALUES ('Família Gabriel & Geovana')
--   RETURNING id
-- )
-- INSERT INTO usuario (id_familia, nome, cpf, email, senha, is_master, role)
-- SELECT id, 'Gabriel Goes',    '00000000000', 'gabriel@email.com',
--        crypt('TROQUE_A_SENHA', gen_salt('bf')), true,  'ADMIN'  FROM nova_familia
-- UNION ALL
-- SELECT id, 'Geovana Tavares',  '11111111111', 'geovana@email.com',
--        crypt('TROQUE_A_SENHA', gen_salt('bf')), false, 'MEMBRO' FROM nova_familia
-- ON CONFLICT (email) DO NOTHING;
-- ============================================================================
