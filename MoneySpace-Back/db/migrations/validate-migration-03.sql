-- ============================================================================
--  Validação da migration-03 (controle de fatura) — NÃO DESTRUTIVO
--  ----------------------------------------------------------------------------
--  Rode DEPOIS de aplicar migration-03-controle-fatura.sql. Todo este script
--  roda dentro de UMA transação e termina em ROLLBACK: nada é persistido.
--
--  COMO RODAR:
--    - Neon SQL Editor: cole o bloco inteiro e execute (ele faz ROLLBACK no fim).
--    - psql local:      psql "$DATABASE_URL" -f validate-migration-03.sql
--
--  Alternativa automatizada (Postgres descartável, sem Neon/psql): existe um
--  harness Node em db/migrations/validate-migration-03.mjs que sobe um Postgres
--  real em memória (PGlite), aplica a migration e roda estas mesmas checagens.
--
--  O que este script exercita:
--    1. constraints CHECK (chk_fatura_status, chk_status_liquidacao)
--    2. UNIQUEs (uq_fatura_competencia, uq_importacao_hash,
--       uq_transacao_fingerprint, uq_utilitario_tipo_valor)
--    3. RLS por família com set_config('app.current_familia_id', ...)
--    4. conversão/roundtrip NUMERIC(14,2)
--
--  NOTA RLS: a RLS é IGNORADA para o dono/superuser da tabela. No app a conexão
--  usa um role comum (não-dono) e a RLS passa a valer. Se você rodar este script
--  como superuser no Neon, os SELECTs de isolamento vão enxergar as duas famílias
--  (falso-negativo esperado). Para testar RLS de verdade use um role de app
--  (ver o harness Node, que faz SET LOCAL ROLE) ou o role de aplicação do Neon.
-- ============================================================================

BEGIN;

-- Dados base (2 famílias) — inseridos fora do contexto RLS das tabelas de fatura.
WITH fam AS (
  INSERT INTO familia (nome) VALUES ('VALID_FAM_A'), ('VALID_FAM_B')
  RETURNING id, nome
)
SELECT 'familias criadas' AS etapa, count(*) AS n FROM fam;

-- Guardar ids em tabela temporária para reuso.
CREATE TEMP TABLE _v (k text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO _v
  SELECT 'famA', id FROM familia WHERE nome = 'VALID_FAM_A'
  UNION ALL SELECT 'famB', id FROM familia WHERE nome = 'VALID_FAM_B';
INSERT INTO _v
  SELECT 'contaA', id FROM (
    INSERT INTO conta (id_familia, nome, tipo)
    VALUES ((SELECT id FROM _v WHERE k='famA'), 'Rico', 'CREDITO') RETURNING id
  ) x;

-- Setar o contexto da Família A (igual ao rlsMiddleware).
SELECT set_config('app.current_familia_id', (SELECT id::text FROM _v WHERE k='famA'), true);

-- INSERT de fatura usando current_setting para id_familia.
INSERT INTO _v
  SELECT 'faturaA', id FROM (
    INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao, usuario_cadastro)
    VALUES (current_setting('app.current_familia_id', true)::uuid,
            (SELECT id FROM _v WHERE k='contaA'),
            DATE '2026-10-01', 'Outubro / 2026', 'Validador')
    RETURNING id
  ) x;

-- Importação (hash de 64 chars).
INSERT INTO _v
  SELECT 'impA', id FROM (
    INSERT INTO fatura_importacao (id_familia, id_fatura, hash_arquivo, qtd_linhas, usuario_cadastro)
    VALUES (current_setting('app.current_familia_id', true)::uuid,
            (SELECT id FROM _v WHERE k='faturaA'), repeat('a',64), 1, 'Validador')
    RETURNING id
  ) x;

-- NUMERIC: inserir 1234.56 e ler de volta (deve voltar 1234.56).
INSERT INTO fatura_transacao
  (id_familia, id_fatura, id_importacao, dt_compra, estabelecimento, valor,
   valor_original, status_liquidacao, fingerprint_linha, usuario_cadastro)
VALUES (current_setting('app.current_familia_id', true)::uuid,
        (SELECT id FROM _v WHERE k='faturaA'), (SELECT id FROM _v WHERE k='impA'),
        DATE '2026-10-08', 'SUPERMERCADO', 1234.56, 'R$ 1.234,56',
        'pendente', repeat('b',64), 'Validador');

SELECT 'NUMERIC roundtrip (esperado 1234.56)' AS etapa, valor
  FROM fatura_transacao WHERE fingerprint_linha = repeat('b',64);

-- ---- CHECK: status de fatura inválido deve FALHAR (descomente p/ confirmar) ----
-- Cada violação aborta a transação; rode UMA por vez dentro de um SAVEPOINT:
SAVEPOINT s1;
DO $$ BEGIN
  INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao, status)
  VALUES (current_setting('app.current_familia_id', true)::uuid,
          (SELECT id FROM _v WHERE k='contaA'), DATE '2026-11-01', 'Nov', 'INVALIDO');
  RAISE EXCEPTION 'FALHOU: chk_fatura_status deixou passar status invalido';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'OK: chk_fatura_status rejeitou status invalido';
END $$;
ROLLBACK TO SAVEPOINT s1;

SAVEPOINT s2;
DO $$ BEGIN
  INSERT INTO fatura_transacao
    (id_familia, id_fatura, dt_compra, estabelecimento, valor, status_liquidacao, fingerprint_linha)
  VALUES (current_setting('app.current_familia_id', true)::uuid,
          (SELECT id FROM _v WHERE k='faturaA'), DATE '2026-10-10', 'X', 1.00, 'PAGO', repeat('d',64));
  RAISE EXCEPTION 'FALHOU: chk_status_liquidacao deixou passar valor invalido';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'OK: chk_status_liquidacao rejeitou valor invalido';
END $$;
ROLLBACK TO SAVEPOINT s2;

-- ---- UNIQUE: competência duplicada deve FALHAR ----
SAVEPOINT s3;
DO $$ BEGIN
  INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao)
  VALUES (current_setting('app.current_familia_id', true)::uuid,
          (SELECT id FROM _v WHERE k='contaA'), DATE '2026-10-01', 'dup');
  RAISE EXCEPTION 'FALHOU: uq_fatura_competencia deixou duplicar';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'OK: uq_fatura_competencia rejeitou competencia duplicada';
END $$;
ROLLBACK TO SAVEPOINT s3;

-- ---- UNIQUE: hash duplicado na mesma fatura deve FALHAR ----
SAVEPOINT s4;
DO $$ BEGIN
  INSERT INTO fatura_importacao (id_familia, id_fatura, hash_arquivo, qtd_linhas)
  VALUES (current_setting('app.current_familia_id', true)::uuid,
          (SELECT id FROM _v WHERE k='faturaA'), repeat('a',64), 1);
  RAISE EXCEPTION 'FALHOU: uq_importacao_hash deixou duplicar';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'OK: uq_importacao_hash rejeitou hash duplicado';
END $$;
ROLLBACK TO SAVEPOINT s4;

-- ---- UNIQUE: fingerprint duplicado no mesmo lote deve FALHAR ----
SAVEPOINT s5;
DO $$ BEGIN
  INSERT INTO fatura_transacao
    (id_familia, id_fatura, id_importacao, dt_compra, estabelecimento, valor, status_liquidacao, fingerprint_linha)
  VALUES (current_setting('app.current_familia_id', true)::uuid,
          (SELECT id FROM _v WHERE k='faturaA'), (SELECT id FROM _v WHERE k='impA'),
          DATE '2026-10-08', 'DUP', 1.00, 'pendente', repeat('b',64));
  RAISE EXCEPTION 'FALHOU: uq_transacao_fingerprint deixou duplicar';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'OK: uq_transacao_fingerprint rejeitou fingerprint duplicado';
END $$;
ROLLBACK TO SAVEPOINT s5;

-- ---- UNIQUE: (tipo,valor) duplicado em utilitario deve FALHAR ----
SAVEPOINT s6;
DO $$ BEGIN
  INSERT INTO utilitario (tipo, valor) VALUES ('status', 'pendente');
  RAISE EXCEPTION 'FALHOU: uq_utilitario_tipo_valor deixou duplicar';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'OK: uq_utilitario_tipo_valor rejeitou (tipo,valor) duplicado';
END $$;
ROLLBACK TO SAVEPOINT s6;

-- ---- RLS: no contexto da Família B a fatura da A some (só vale como role não-dono) ----
SELECT set_config('app.current_familia_id', (SELECT id::text FROM _v WHERE k='famB'), true);
SELECT 'RLS ctx B (esperado 0 como role de app)' AS etapa,
       count(*) AS faturas_visiveis FROM fatura;

-- Volta ao contexto A (esperado: enxerga a fatura dela).
SELECT set_config('app.current_familia_id', (SELECT id::text FROM _v WHERE k='famA'), true);
SELECT 'RLS ctx A (esperado 1 como role de app)' AS etapa,
       count(*) AS faturas_visiveis FROM fatura;

-- NADA é persistido.
ROLLBACK;
