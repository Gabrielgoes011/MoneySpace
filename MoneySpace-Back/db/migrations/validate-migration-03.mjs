// Harness de validação da migration-03 contra um Postgres DESCARTÁVEL (PGlite).
// Não faz parte do app em runtime — é um utilitário de validação de migration.
//
// COMO RODAR (não precisa de Docker, Neon nem psql — só Node):
//   1) cd MoneySpace-Back
//   2) npm install --no-save @electric-sql/pglite   (dependência só p/ validar)
//   3) node db/migrations/validate-migration-03.mjs
//
// Por que PGlite: o ambiente de dev não tem Docker nem psql; só Node. PGlite é um
// Postgres REAL (compilado p/ WASM), então suporta de verdade CHECK/UNIQUE,
// set_config/current_setting, NUMERIC e RLS — ao contrário de um emulador.
//
// NOTA RLS (importante): no Postgres, a RLS é IGNORADA para o dono/superuser da
// tabela. A sessão padrão do PGlite roda como 'postgres' (superuser), então um
// SELECT direto veria TODAS as linhas e o teste de isolamento daria falso-
// negativo. No app real a conexão usa um role comum (não-dono) e a RLS passa a
// valer. Para reproduzir isso fielmente, este harness cria um role 'app_role'
// sem privilégios especiais e roda os testes de isolamento com SET LOCAL ROLE
// dentro da transação — exatamente o cenário que o rlsMiddleware produz.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, 'migration-03-controle-fatura.sql');

let pass = 0;
let fail = 0;
const log = (ok, msg, extra = '') => {
  if (ok) { pass++; console.log(`  PASS  ${msg}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL  ${msg}${extra ? ' — ' + extra : ''}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

// Espera que uma query LANCE erro; valida (opcionalmente) a substring da mensagem.
// IMPORTANTE: no Postgres, um erro dentro de uma transação aborta a transação
// inteira ("current transaction is aborted"). Por isso cada tentativa que deve
// falhar roda dentro de um SAVEPOINT e é revertida com ROLLBACK TO SAVEPOINT,
// mantendo a transação viva para os próximos testes. É assim que um fluxo real
// isolaria uma violação esperada dentro de uma transação única.
let spCounter = 0;
async function expectError(db, label, sql, params = [], needle = null) {
  const sp = `sp_${spCounter++}`;
  await db.query(`SAVEPOINT ${sp}`);
  try {
    await db.query(sql, params);
    log(false, label, 'não lançou erro (esperava rejeição)');
    await db.query(`RELEASE SAVEPOINT ${sp}`);
  } catch (e) {
    const m = String(e.message || e);
    await db.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    if (needle && !m.toLowerCase().includes(needle.toLowerCase())) {
      log(false, label, `erro inesperado: ${m}`);
    } else {
      log(true, label, m.split('\n')[0].slice(0, 80));
    }
  }
}

const db = new PGlite();

// --- Pré-requisitos: extensão + tabelas base (subset fiel do script.sql) ---
// uuid-ossp não existe no PGlite -> criamos uma função uuid_generate_v4() que
// delega para gen_random_uuid() (nativa), mantendo o DDL da migration intacto.
const prereq = `
CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid
  LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;

CREATE TABLE familia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    senha VARCHAR(200) NOT NULL
);

CREATE TABLE conta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    saldo_inicial NUMERIC(14,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    padrao_sistema BOOLEAN DEFAULT false
);
`;

try {
  section('Setup: pré-requisitos + aplicar migration-03');
  await db.exec(prereq);
  log(true, 'Pré-requisitos (familia/usuario/conta/categoria + shim uuid) criados');

  const migrationSql = readFileSync(migrationPath, 'utf8');
  await db.exec(migrationSql);
  log(true, 'migration-03-controle-fatura.sql aplicada sem erro');

  // Tabelas criadas?
  const t = await db.query(`SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('fatura','fatura_importacao','fatura_transacao','utilitario')
     ORDER BY table_name`);
  log(t.rows.length === 4, 'As 4 tabelas foram criadas', t.rows.map(r => r.table_name).join(','));

  // Seed de status (4 linhas)?
  const seed = await db.query(`SELECT valor FROM utilitario WHERE tipo='status' ORDER BY ordem`);
  log(seed.rows.length === 4, 'Seed utilitario tipo=status tem 4 linhas',
    seed.rows.map(r => r.valor).join(' | '));

  // RLS habilitada nas 3 tabelas de fatura e NÃO em utilitario?
  const rls = await db.query(`SELECT relname, relrowsecurity FROM pg_class
     WHERE relname IN ('fatura','fatura_importacao','fatura_transacao','utilitario')`);
  const rlsMap = Object.fromEntries(rls.rows.map(r => [r.relname, r.relrowsecurity]));
  log(rlsMap.fatura && rlsMap.fatura_importacao && rlsMap.fatura_transacao,
    'RLS habilitada em fatura/fatura_importacao/fatura_transacao');
  log(rlsMap.utilitario === false, 'utilitario é GLOBAL (sem RLS)');

  // IMPORTANTE p/ testar RLS: no Postgres a RLS é IGNORADA para o dono/superuser
  // da tabela. A sessão padrão do PGlite roda como 'postgres' (superuser), então
  // o SELECT veria tudo e o teste de isolamento daria falso-negativo. No app real
  // a conexão usa um role comum (não-dono) e a RLS é aplicada. Para reproduzir
  // isso de forma fiel, criamos um role sem privilégios especiais e rodamos os
  // testes de isolamento com SET LOCAL ROLE dentro da transação (igual a uma
  // sessão de aplicação). Esse é o cenário que o rlsMiddleware produz em produção.
  await db.exec(`
    CREATE ROLE app_role NOLOGIN;
    GRANT SELECT, INSERT, UPDATE, DELETE ON fatura, fatura_importacao, fatura_transacao TO app_role;
    GRANT SELECT ON utilitario TO app_role;
  `);

  // --- Dados base para 2 famílias (inseridos SEM RLS nas tabelas base) ---
  const famA = (await db.query(`INSERT INTO familia (nome) VALUES ('Família A') RETURNING id`)).rows[0].id;
  const famB = (await db.query(`INSERT INTO familia (nome) VALUES ('Família B') RETURNING id`)).rows[0].id;
  const userA = (await db.query(`INSERT INTO usuario (id_familia,nome,email,senha) VALUES ($1,'Gabriel','g@a.com','x') RETURNING id`, [famA])).rows[0].id;
  const contaA = (await db.query(`INSERT INTO conta (id_familia,nome,tipo) VALUES ($1,'Rico','CREDITO') RETURNING id`, [famA])).rows[0].id;
  const contaB = (await db.query(`INSERT INTO conta (id_familia,nome,tipo) VALUES ($1,'Rico B','CREDITO') RETURNING id`, [famB])).rows[0].id;

  // ============================================================
  section('RLS + contexto: inserir no contexto da Família A');
  // ============================================================
  // O rlsMiddleware roda dentro de UMA transação com SET app.current_familia_id.
  // Aqui reproduzimos: BEGIN; set_config(...); INSERTs usando current_setting.
  await db.exec('BEGIN');
  await db.query(`SELECT set_config('app.current_familia_id', $1, true)`, [famA]);

  const faturaA = (await db.query(
    `INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao, usuario_cadastro)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-10-01', 'Outubro / 2026', 'Gabriel')
     RETURNING id`, [contaA])).rows[0].id;
  log(!!faturaA, 'INSERT fatura usando current_setting para id_familia');

  const impA = (await db.query(
    `INSERT INTO fatura_importacao (id_familia, id_fatura, hash_arquivo, qtd_linhas, usuario_cadastro)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, repeat('a',64), 1, 'Gabriel')
     RETURNING id`, [faturaA])).rows[0].id;
  log(!!impA, 'INSERT fatura_importacao (hash 64 chars)');

  // ============================================================
  section('Conversão NUMERIC(14,2)');
  // ============================================================
  // O parser normaliza 'R$ 1.234,56' -> 1234.56 em JS; aqui simulamos o valor já
  // normalizado chegando como string (como o pg trafega) e conferimos a round-trip.
  const valorNormalizado = '1234.56';
  const txA = (await db.query(
    `INSERT INTO fatura_transacao
      (id_familia, id_fatura, id_importacao, dt_compra, estabelecimento, valor, valor_original, status_liquidacao, fingerprint_linha, usuario_cadastro)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, $2, DATE '2026-10-08', 'SUPERMERCADO', $3, 'R$ 1.234,56', 'pendente', repeat('b',64), 'Gabriel')
     RETURNING id, valor`, [faturaA, impA, valorNormalizado]));
  const valorLido = txA.rows[0].valor;
  log(Number(valorLido) === 1234.56, 'NUMERIC round-trip 1.234,56 -> 1234.56',
    `pg devolveu ${JSON.stringify(valorLido)} (typeof ${typeof valorLido}); Number()=${Number(valorLido)}`);

  // Escala: valor com mais de 2 casas é arredondado para 2 por NUMERIC(14,2)
  const escala = (await db.query(
    `INSERT INTO fatura_transacao
      (id_familia, id_fatura, dt_compra, estabelecimento, valor, status_liquidacao, fingerprint_linha, usuario_cadastro)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-10-09', 'ARREDONDA', 10.005, 'pendente', repeat('c',64), 'Gabriel')
     RETURNING valor`, [faturaA]));
  log(Number(escala.rows[0].valor) === 10.01 || Number(escala.rows[0].valor) === 10.00,
    'NUMERIC(14,2) aplica escala de 2 casas', `valor=${escala.rows[0].valor}`);

  // ============================================================
  section('CHECK constraints');
  // ============================================================
  await expectError(db, 'chk_fatura_status rejeita status inválido',
    `INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao, status)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-11-01', 'Nov', 'INVALIDO')`,
    [contaA], 'chk_fatura_status');

  await expectError(db, 'chk_status_liquidacao rejeita status_liquidacao inválido',
    `INSERT INTO fatura_transacao
      (id_familia, id_fatura, dt_compra, estabelecimento, valor, status_liquidacao, fingerprint_linha)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-10-10', 'X', 1.00, 'PAGO', repeat('d',64))`,
    [faturaA], 'chk_status_liquidacao');

  // Sanidade: os 4 valores válidos são aceitos (fingerprint único por linha)
  for (const [i, s] of ['pendente', 'na hora', 'no fechamento', 'nao aplicavel'].entries()) {
    try {
      await db.query(
        `INSERT INTO fatura_transacao
          (id_familia, id_fatura, dt_compra, estabelecimento, valor, status_liquidacao, fingerprint_linha)
         VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-10-11', 'OK', 1.00, $2, repeat('e',63)||$3)`,
        [faturaA, s, String(i)]);
      log(true, `status_liquidacao válido aceito: '${s}'`);
    } catch (e) { log(false, `status_liquidacao válido aceito: '${s}'`, e.message); }
  }

  // ============================================================
  section('UNIQUE constraints');
  // ============================================================
  await expectError(db, 'uq_fatura_competencia rejeita competência duplicada (familia+conta+mes)',
    `INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-10-01', 'Outubro / 2026 dup')`,
    [contaA], 'uq_fatura_competencia');

  await expectError(db, 'uq_importacao_hash rejeita mesmo hash na mesma fatura',
    `INSERT INTO fatura_importacao (id_familia, id_fatura, hash_arquivo, qtd_linhas)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, repeat('a',64), 1)`,
    [faturaA], 'uq_importacao_hash');

  await expectError(db, 'uq_transacao_fingerprint rejeita fingerprint duplicado no mesmo lote',
    `INSERT INTO fatura_transacao
      (id_familia, id_fatura, id_importacao, dt_compra, estabelecimento, valor, status_liquidacao, fingerprint_linha)
     VALUES (current_setting('app.current_familia_id', true)::uuid, $1, $2, DATE '2026-10-08', 'DUP', 1.00, 'pendente', repeat('b',64))`,
    [faturaA, impA], 'uq_transacao_fingerprint');

  await expectError(db, 'uq_utilitario_tipo_valor rejeita (tipo,valor) duplicado',
    `INSERT INTO utilitario (tipo, valor) VALUES ('status','pendente')`,
    [], 'uq_utilitario_tipo_valor');

  await db.exec('COMMIT');

  // ============================================================
  section('Isolamento RLS entre famílias (como role de aplicação)');
  // ============================================================
  // Helper: roda uma função dentro de BEGIN; SET LOCAL ROLE app_role;
  // set_config(app.current_familia_id). Igual ao que o rlsMiddleware monta.
  async function comContexto(fam, fn) {
    await db.exec('BEGIN');
    await db.query(`SET LOCAL ROLE app_role`);
    await db.query(`SELECT set_config('app.current_familia_id', $1, true)`, [fam]);
    try {
      const r = await fn();
      await db.exec('COMMIT');
      return r;
    } catch (e) {
      try { await db.exec('ROLLBACK'); } catch { }
      throw e;
    }
  }

  // Contexto família A: vê só o que é dela.
  const visA = await comContexto(famA, async () =>
    (await db.query(`SELECT count(*)::int AS n FROM fatura`)).rows[0].n);
  log(visA === 1, 'No contexto da Família A, SELECT fatura enxerga só as faturas dela', `n=${visA}`);

  // Contexto família B: NÃO vê a fatura da família A, e cria a própria.
  const visB = await comContexto(famB, async () =>
    (await db.query(`SELECT count(*)::int AS n FROM fatura`)).rows[0].n);
  log(visB === 0, 'No contexto da Família B, a fatura da Família A fica INVISÍVEL', `n=${visB}`);

  const faturaCrossId = await comContexto(famB, async () =>
    (await db.query(
      `INSERT INTO fatura (id_familia, id_conta, competencia, nome_exibicao)
       VALUES (current_setting('app.current_familia_id', true)::uuid, $1, DATE '2026-12-01', 'Dez B')
       RETURNING id`, [contaB])).rows[0].id);
  log(!!faturaCrossId, 'Família B cria a própria fatura normalmente');

  // Confirma de novo que A continua vendo só a dela depois que B inseriu.
  const visA2 = await comContexto(famA, async () =>
    (await db.query(`SELECT count(*)::int AS n FROM fatura`)).rows[0].n);
  log(visA2 === 1, 'Família A continua vendo só a dela depois que B inseriu', `n=${visA2}`);

  // Contexto de uma família INEXISTENTE: a policy não casa com linha nenhuma.
  const visNull = await comContexto('00000000-0000-0000-0000-000000000000', async () =>
    (await db.query(`SELECT count(*)::int AS n FROM fatura`)).rows[0].n);
  log(visNull === 0, 'Contexto de família inexistente -> nenhuma fatura visível', `n=${visNull}`);

  // Família B tenta LER a transação da família A por id (cross-tenant): RLS esconde.
  const crossRead = await comContexto(famB, async () =>
    (await db.query(`SELECT count(*)::int AS n FROM fatura_transacao WHERE id_fatura = $1`, [faturaA])).rows[0].n);
  log(crossRead === 0, 'Família B NÃO lê as transações da fatura da Família A (cross-tenant)', `n=${crossRead}`);

  // ============================================================
  section('utilitario é global (legível sem contexto de família)');
  // ============================================================
  const util = (await db.query(`SELECT count(*)::int AS n FROM utilitario WHERE tipo='status'`)).rows[0].n;
  log(util === 4, 'utilitario legível sem contexto (global, sem RLS)', `n=${util}`);

} catch (e) {
  fail++;
  console.error('\nERRO FATAL no harness:', e);
} finally {
  await db.close();
  console.log(`\n==== RESULTADO: ${pass} passaram, ${fail} falharam ====`);
  process.exit(fail === 0 ? 0 : 1);
}
