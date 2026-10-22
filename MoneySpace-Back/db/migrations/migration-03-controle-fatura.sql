-- ============================================================================
--  Migration 003: Controle de Fatura & Conferência da Reserva
--  Data: 2026-10-11
--  Descrição: Cria o domínio de fatura de cartão de crédito:
--
--    - fatura             : cabeçalho mensal por competência (família + cartão +
--                           mês), status do ciclo e saldo da reserva declarado.
--    - fatura_importacao  : lote de CSV importado (hash do conteúdo p/ idempotência).
--    - fatura_transacao   : os lançamentos da fatura, com status_liquidacao ÚNICO
--                           em texto simples (pendente/na hora/no fechamento/
--                           nao aplicavel) e fingerprint por linha p/ anti-duplicata.
--
--    - utilitario         : tabela GENÉRICA e GLOBAL (id, tipo, valor) que alimenta
--                           selects/dropdowns do front por `tipo`. No MVP as opções
--                           de `status` são globais e somente leitura (padrão do
--                           sistema, como as categorias de sistema) -> NÃO tem
--                           id_familia nem RLS. Seed de `tipo='status'` incluído.
--
--  CONVENÇÕES (iguais ao script.sql):
--    id UUID (uuid_generate_v4()), FKs com prefixo id_, dinheiro NUMERIC(14,2),
--    data do fato em DATE, carimbo de criação em TIMESTAMP, snake_case,
--    status em VARCHAR + CHECK (nunca ENUM).
--
--  RLS: fatura, fatura_importacao e fatura_transacao são POR FAMÍLIA -> RLS
--    habilitada + policy por current_setting('app.current_familia_id', true)::uuid
--    (o `true` = missing_ok, retorna NULL em vez de erro quando o contexto não
--    está setado). A tabela `utilitario` é GLOBAL -> sem RLS.
--
--  NOTA: idempotência via IF NOT EXISTS / DROP ... IF EXISTS onde faz sentido,
--    para a migration poder ser reexecutada sem quebrar. Aplicar manualmente no
--    SQL Editor do Neon (ver db/migrations/README.md). NÃO reexecutar script.sql.
-- ============================================================================


-- ============================================================================
-- 1. TABELA fatura
-- ----------------------------------------------------------------------------
-- Cabeçalho mensal. competencia = 1º dia do mês (DATE). O cartão é uma `conta`
-- do tipo 'CREDITO' (não existe tabela `cartoes`). saldo_reserva_declarado é o
-- quanto o usuário diz ter guardado na reserva para esta competência.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fatura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_conta UUID NOT NULL REFERENCES conta(id),           -- cartão (tipo 'CREDITO')
    competencia DATE NOT NULL,                             -- 1º dia do mês de referência
    nome_exibicao VARCHAR(50) NOT NULL,                    -- ex.: 'Outubro / 2026'
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',          -- 'ABERTA' | 'FECHADA' | 'PAGA'
    saldo_reserva_declarado NUMERIC(14,2) NOT NULL DEFAULT 0,  -- quanto o usuário diz ter guardado

    fechada_em TIMESTAMP,                                  -- quando foi fechada (NULL = aberta)
    fechada_por UUID REFERENCES usuario(id),               -- quem fechou (auditoria)

    usuario_cadastro VARCHAR(100),                         -- nome de quem criou a competência
    dt_cadastro TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_fatura_status CHECK (status IN ('ABERTA', 'FECHADA', 'PAGA')),
    -- uma competência por família + cartão + mês
    CONSTRAINT uq_fatura_competencia UNIQUE (id_familia, id_conta, competencia)
);


-- ============================================================================
-- 2. TABELA fatura_importacao
-- ----------------------------------------------------------------------------
-- Um lote de CSV importado e confirmado. hash_arquivo = sha256 do conteúdo do
-- arquivo -> reimportar o MESMO arquivo na MESMA fatura bate no unique e vira
-- conflito (409), sem duplicar lançamentos.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fatura_importacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_fatura UUID NOT NULL REFERENCES fatura(id) ON DELETE CASCADE,

    emissor VARCHAR(30) NOT NULL DEFAULT 'RICO',           -- origem do parser (hoje só 'RICO')
    hash_arquivo CHAR(64) NOT NULL,                        -- sha256 (hex) do conteúdo do arquivo
    nome_arquivo VARCHAR(255),                             -- só auditoria; NÃO confiar no nome
    tamanho_bytes INTEGER,                                 -- tamanho do upload
    qtd_linhas INTEGER NOT NULL DEFAULT 0,                 -- linhas válidas persistidas

    usuario_cadastro VARCHAR(100),                         -- nome de quem importou
    dt_cadastro TIMESTAMP DEFAULT NOW(),

    -- mesmo arquivo (hash) não entra duas vezes na mesma fatura
    CONSTRAINT uq_importacao_hash UNIQUE (id_fatura, hash_arquivo)
);


-- ============================================================================
-- 3. TABELA fatura_transacao
-- ----------------------------------------------------------------------------
-- Os lançamentos da fatura. status_liquidacao é um CAMPO ÚNICO em texto simples
-- (minúsculas, sem '_'): 'pendente' | 'na hora' | 'no fechamento' | 'nao aplicavel'.
-- Já entra preenchido pela sugestão automática da importação e é editável direto
-- na tela (sem campos separados de "sugestão"/"ajuste").
--
-- valor         = valor absoluto normalizado (sempre positivo), NUMERIC(14,2).
-- valor_original= texto bruto do CSV (com 'R$' e sinal) p/ auditoria.
-- fingerprint_linha = sha256 determinístico por linha no lote (inclui ordem no
--   arquivo) -> anti-duplicata dentro de uma mesma importação.
-- ============================================================================
CREATE TABLE IF NOT EXISTS fatura_transacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_fatura UUID NOT NULL REFERENCES fatura(id) ON DELETE CASCADE,
    id_importacao UUID REFERENCES fatura_importacao(id) ON DELETE SET NULL,

    id_usuario_portador UUID REFERENCES usuario(id),       -- portador mapeado (opcional)
    portador_nome_importado VARCHAR(120),                  -- nome bruto do CSV (auditoria)
    id_categoria UUID REFERENCES categoria(id),            -- global ou da família

    dt_compra DATE NOT NULL,                               -- data do fato (DATE)
    estabelecimento VARCHAR(255) NOT NULL,
    valor NUMERIC(14,2) NOT NULL,                          -- valor normalizado (positivo)
    valor_original VARCHAR(100),                           -- texto bruto do CSV (auditoria)

    parcela_texto VARCHAR(20) DEFAULT '-',                 -- '-' (à vista) ou 'N de M'
    numero_parcela SMALLINT,                               -- N (quando parcelada)
    total_parcelas SMALLINT,                               -- M (quando parcelada)

    status_liquidacao VARCHAR(20) NOT NULL,                -- CAMPO ÚNICO (texto simples)

    fingerprint_linha CHAR(64) NOT NULL,                   -- sha256 determinístico por linha
    usuario_cadastro VARCHAR(100),                         -- nome de quem importou/lançou
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    dt_atualizacao TIMESTAMP DEFAULT NOW(),

    -- status em texto simples, minúsculas, sem '_' (coerente com a tabela utilitario)
    CONSTRAINT chk_status_liquidacao CHECK (status_liquidacao IN
        ('pendente', 'na hora', 'no fechamento', 'nao aplicavel')),
    -- mesma linha (fingerprint) não entra duas vezes no mesmo lote de importação
    CONSTRAINT uq_transacao_fingerprint UNIQUE (id_importacao, fingerprint_linha)
);


-- ============================================================================
-- 4. TABELA utilitario (GLOBAL — opções de selects/dropdowns)
-- ----------------------------------------------------------------------------
-- Lista genérica (id, tipo, valor) para alimentar selects do front por `tipo`.
-- Ex.: tipo='status', valor='pendente'. É GLOBAL e somente leitura para o
-- usuário (padrão do sistema), por isso NÃO tem id_familia nem RLS. O unique
-- (tipo, valor) evita duplicatas; `ordem` controla a ordenação no select.
-- Estrutura permite outros `tipo`s no futuro sem mudar o schema.
-- ============================================================================
CREATE TABLE IF NOT EXISTS utilitario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(40) NOT NULL,                             -- ex.: 'status'
    valor VARCHAR(60) NOT NULL,                            -- ex.: 'pendente'
    ordem SMALLINT DEFAULT 0,                              -- ordenação no select (opcional)
    dt_cadastro TIMESTAMP DEFAULT NOW(),

    CONSTRAINT uq_utilitario_tipo_valor UNIQUE (tipo, valor)
);


-- ============================================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- ----------------------------------------------------------------------------
-- Indexamos as FKs mais consultadas (sempre filtramos por família) e as colunas
-- usadas em filtros/ordenção da tela de lançamentos (data).
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fatura_familia      ON fatura(id_familia);
CREATE INDEX IF NOT EXISTS idx_fatura_conta        ON fatura(id_conta);
CREATE INDEX IF NOT EXISTS idx_fatura_competencia  ON fatura(id_familia, id_conta, competencia);

CREATE INDEX IF NOT EXISTS idx_fat_imp_familia     ON fatura_importacao(id_familia);
CREATE INDEX IF NOT EXISTS idx_fat_imp_fatura      ON fatura_importacao(id_fatura);

CREATE INDEX IF NOT EXISTS idx_fat_trans_familia   ON fatura_transacao(id_familia);
CREATE INDEX IF NOT EXISTS idx_fat_trans_fatura    ON fatura_transacao(id_fatura);
CREATE INDEX IF NOT EXISTS idx_fat_trans_importacao ON fatura_transacao(id_importacao);
CREATE INDEX IF NOT EXISTS idx_fat_trans_portador  ON fatura_transacao(id_usuario_portador);
CREATE INDEX IF NOT EXISTS idx_fat_trans_categoria ON fatura_transacao(id_categoria);
CREATE INDEX IF NOT EXISTS idx_fat_trans_data      ON fatura_transacao(dt_compra);

CREATE INDEX IF NOT EXISTS idx_utilitario_tipo     ON utilitario(tipo);


-- ============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) — só nas tabelas POR FAMÍLIA
-- ----------------------------------------------------------------------------
-- utilitario é GLOBAL (sem RLS). As três tabelas de fatura são por família:
-- a cada request o backend abre a transação e seta app.current_familia_id; a
-- policy filtra por esse contexto (missing_ok = retorna NULL se não setado).
-- ============================================================================
ALTER TABLE fatura            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_importacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_transacao  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS acesso_fatura ON fatura;
CREATE POLICY acesso_fatura ON fatura
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_fatura_importacao ON fatura_importacao;
CREATE POLICY acesso_fatura_importacao ON fatura_importacao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

DROP POLICY IF EXISTS acesso_fatura_transacao ON fatura_transacao;
CREATE POLICY acesso_fatura_transacao ON fatura_transacao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);


-- ============================================================================
-- 7. SEED — opções de status (tabela utilitario)
-- ----------------------------------------------------------------------------
-- Valores em texto simples (minúsculas, sem '_'), na ordem natural de uso.
-- ON CONFLICT no unique (tipo, valor) deixa o seed idempotente/reexecutável.
-- ============================================================================
INSERT INTO utilitario (tipo, valor, ordem) VALUES
    ('status', 'pendente',      1),
    ('status', 'na hora',       2),
    ('status', 'no fechamento', 3),
    ('status', 'nao aplicavel', 4)
ON CONFLICT (tipo, valor) DO NOTHING;


-- ============================================================================
-- 8. VERIFICAÇÃO (opcional - deixar comentado)
-- ----------------------------------------------------------------------------
-- -- Tabelas criadas:
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name IN ('fatura','fatura_importacao','fatura_transacao','utilitario')
--  ORDER BY table_name;
--
-- -- Constraints das tabelas de fatura:
-- SELECT conname FROM pg_constraint
--  WHERE conname IN ('chk_fatura_status','uq_fatura_competencia','uq_importacao_hash',
--                    'chk_status_liquidacao','uq_transacao_fingerprint',
--                    'uq_utilitario_tipo_valor')
--  ORDER BY conname;
--
-- -- RLS habilitada (esperado: t p/ as 3 tabelas de fatura):
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('fatura','fatura_importacao','fatura_transacao','utilitario');
--
-- -- Seed de status (esperado: 4 linhas):
-- SELECT tipo, valor, ordem FROM utilitario WHERE tipo = 'status' ORDER BY ordem;


-- ============================================================================
-- 9. ROLLBACK (desfazer esta migration) — deixar comentado
-- ----------------------------------------------------------------------------
-- Rode SOMENTE para reverter. Dropar as tabelas apaga TODOS os dados de fatura.
-- Ordem: filhas antes das pais (FKs). As policies caem junto com as tabelas.
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS fatura_transacao;
-- DROP TABLE IF EXISTS fatura_importacao;
-- DROP TABLE IF EXISTS fatura;
-- -- Para remover só o seed de status (mantendo a tabela utilitario):
-- -- DELETE FROM utilitario WHERE tipo = 'status';
-- DROP TABLE IF EXISTS utilitario;
