// ========================================
// REPOSITORY: FATURA
// ========================================
// Camada de acesso ao banco. ÚNICO lugar com SQL do módulo de fatura.
// Tabelas: `fatura`, `fatura_importacao`, `fatura_transacao` (ver script.sql /
// migration-03-controle-fatura.sql).
//
// RLS: o contexto app.current_familia_id vive na TRANSAÇÃO que o rlsMiddleware
// abre por request (= req.db). Por isso TODAS as funções recebem `db` por
// parâmetro; as policies filtram pela família. Em INSERTs preenchemos id_familia
// com current_setting('app.current_familia_id', true)::uuid (true = missing_ok).
//
// NUMERIC volta como STRING do pg -> o cálculo (Number()) fica no service.

// Colunas do cabeçalho reutilizadas nos SELECT/RETURNING.
const COLS_FATURA = `id, id_conta, competencia, nome_exibicao, status,
            saldo_reserva_declarado, fechada_em, fechada_por,
            usuario_cadastro, dt_cadastro`;

// ── Cabeçalho da fatura ──────────────────────────────────────────────────────

// Lista os cabeçalhos de fatura de um cartão (RLS filtra por família).
async function listarFaturasPorConta(db, idConta) {
  const result = await db.query(
    `SELECT ${COLS_FATURA}
       FROM fatura
      WHERE id_conta = $1
      ORDER BY competencia DESC`,
    [idConta]
  );
  return result.rows;
}

// Busca a fatura de uma competência específica (p/ checar duplicidade/idempotência).
async function buscarFaturaPorCompetencia(db, idConta, competencia) {
  const result = await db.query(
    `SELECT ${COLS_FATURA}
       FROM fatura
      WHERE id_conta = $1 AND competencia = $2
      LIMIT 1`,
    [idConta, competencia]
  );
  return result.rows[0];
}

// Busca uma fatura pelo id (RLS garante que seja da família).
async function buscarFaturaPorId(db, idFatura) {
  const result = await db.query(
    `SELECT ${COLS_FATURA} FROM fatura WHERE id = $1 LIMIT 1`,
    [idFatura]
  );
  return result.rows[0];
}

// Cria uma competência vazia. id_familia vem do contexto de RLS.
async function criarFatura(db, dados) {
  const result = await db.query(
    `INSERT INTO fatura
        (id_familia, id_conta, competencia, nome_exibicao, status, usuario_cadastro)
     VALUES
        (current_setting('app.current_familia_id', true)::uuid,
         $1, $2, $3, 'ABERTA', $4)
     RETURNING ${COLS_FATURA}`,
    [dados.id_conta, dados.competencia, dados.nome_exibicao, dados.usuario_cadastro]
  );
  return result.rows[0];
}

// Atualiza o saldo declarado da reserva.
async function atualizarReserva(db, idFatura, saldoDeclarado) {
  const result = await db.query(
    `UPDATE fatura SET saldo_reserva_declarado = $1
      WHERE id = $2
      RETURNING ${COLS_FATURA}`,
    [saldoDeclarado, idFatura]
  );
  return result.rows[0];
}

// Fecha a fatura (status, fechada_em, fechada_por).
async function fecharFatura(db, idFatura, idUsuario) {
  const result = await db.query(
    `UPDATE fatura
        SET status = 'FECHADA', fechada_em = NOW(), fechada_por = $1
      WHERE id = $2
      RETURNING ${COLS_FATURA}`,
    [idUsuario, idFatura]
  );
  return result.rows[0];
}

// Confere se a conta existe, é da família (RLS) e é do tipo CREDITO.
async function buscarContaCredito(db, idConta) {
  const result = await db.query(
    `SELECT id, tipo FROM conta WHERE id = $1 AND tipo = 'CREDITO' LIMIT 1`,
    [idConta]
  );
  return result.rows[0];
}

// ── Agregados do dashboard ───────────────────────────────────────────────────

// Somatórios por status_liquidacao da fatura.
async function totaisPorStatus(db, idFatura) {
  const result = await db.query(
    `SELECT status_liquidacao, SUM(valor) AS total, COUNT(*)::int AS qtd
       FROM fatura_transacao
      WHERE id_fatura = $1
      GROUP BY status_liquidacao`,
    [idFatura]
  );
  return result.rows;
}

// Totais por portador (exclui 'nao aplicavel' dos KPIs).
async function totaisPorPortador(db, idFatura) {
  const result = await db.query(
    `SELECT t.id_usuario_portador AS id_usuario,
            COALESCE(u.nome, t.portador_nome_importado, 'Sem portador') AS nome,
            SUM(t.valor) AS total,
            COUNT(*)::int AS qtd
       FROM fatura_transacao t
       LEFT JOIN usuario u ON u.id = t.id_usuario_portador
      WHERE t.id_fatura = $1
        AND t.status_liquidacao <> 'nao aplicavel'
      GROUP BY t.id_usuario_portador, u.nome, t.portador_nome_importado
      ORDER BY total DESC`,
    [idFatura]
  );
  return result.rows;
}

// Totais por categoria (exclui 'nao aplicavel' dos KPIs).
async function totaisPorCategoria(db, idFatura) {
  const result = await db.query(
    `SELECT t.id_categoria,
            COALESCE(c.nome, 'Sem categoria') AS nome,
            c.cor AS cor,
            SUM(t.valor) AS total,
            COUNT(*)::int AS qtd
       FROM fatura_transacao t
       LEFT JOIN categoria c ON c.id = t.id_categoria
      WHERE t.id_fatura = $1
        AND t.status_liquidacao <> 'nao aplicavel'
      GROUP BY t.id_categoria, c.nome, c.cor
      ORDER BY total DESC`,
    [idFatura]
  );
  return result.rows;
}

// ── Transações da fatura ─────────────────────────────────────────────────────

// Lista transações com filtros/busca/sort/paginação. Retorna { transacoes, total }.
async function listarTransacoes(db, idFatura, filtros = {}) {
  const where = ['t.id_fatura = $1'];
  const params = [idFatura];
  let i = 2;

  if (filtros.status) { where.push(`t.status_liquidacao = $${i++}`); params.push(filtros.status); }
  if (filtros.portador) { where.push(`t.id_usuario_portador = $${i++}`); params.push(filtros.portador); }
  if (filtros.categoria) { where.push(`t.id_categoria = $${i++}`); params.push(filtros.categoria); }
  if (filtros.busca) { where.push(`t.estabelecimento ILIKE $${i++}`); params.push(`%${filtros.busca}%`); }

  const whereSql = where.join(' AND ');

  // Sort seguro (whitelist).
  const campo = filtros.sortCampo === 'valor' ? 'valor' : 'dt_compra';
  const dir = filtros.sortDir === 'asc' ? 'ASC' : 'DESC';

  // Total p/ paginação.
  const totalRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM fatura_transacao t WHERE ${whereSql}`,
    params
  );
  const total = totalRes.rows[0]?.total ?? 0;

  // Paginação.
  const limit = Number.isInteger(filtros.limit) && filtros.limit > 0 ? filtros.limit : 50;
  const offset = Number.isInteger(filtros.offset) && filtros.offset >= 0 ? filtros.offset : 0;

  const listaParams = [...params, limit, offset];
  const result = await db.query(
    `SELECT t.id, t.dt_compra, t.estabelecimento,
            t.id_usuario_portador,
            COALESCE(u.nome, t.portador_nome_importado) AS portador_nome,
            t.portador_nome_importado,
            t.id_categoria, c.nome AS categoria_nome, c.cor AS categoria_cor,
            t.valor, t.valor_original,
            t.parcela_texto, t.numero_parcela, t.total_parcelas,
            t.status_liquidacao, t.dt_cadastro, t.dt_atualizacao
       FROM fatura_transacao t
       LEFT JOIN usuario u ON u.id = t.id_usuario_portador
       LEFT JOIN categoria c ON c.id = t.id_categoria
      WHERE ${whereSql}
      ORDER BY t.${campo} ${dir}, t.id ASC
      LIMIT $${i++} OFFSET $${i++}`,
    listaParams
  );

  return { transacoes: result.rows, total };
}

// Busca uma transação pelo id (valida pertencimento à fatura).
async function buscarTransacaoPorId(db, idFatura, idTransacao) {
  const result = await db.query(
    `SELECT id, id_fatura, id_categoria, id_usuario_portador, status_liquidacao
       FROM fatura_transacao
      WHERE id = $1 AND id_fatura = $2
      LIMIT 1`,
    [idTransacao, idFatura]
  );
  return result.rows[0];
}

// Atualiza categoria, portador e status_liquidacao de uma transação.
async function atualizarTransacao(db, idFatura, idTransacao, dados) {
  const result = await db.query(
    `UPDATE fatura_transacao
        SET id_categoria = $1,
            id_usuario_portador = $2,
            status_liquidacao = $3,
            dt_atualizacao = NOW()
      WHERE id = $4 AND id_fatura = $5
      RETURNING id, dt_compra, estabelecimento, id_usuario_portador,
                portador_nome_importado, id_categoria, valor, valor_original,
                parcela_texto, numero_parcela, total_parcelas, status_liquidacao`,
    [dados.id_categoria, dados.id_usuario_portador, dados.status_liquidacao, idTransacao, idFatura]
  );
  return result.rows[0];
}

// ── Importação (lote CSV) ────────────────────────────────────────────────────

// Verifica se já existe importação com o mesmo hash para a fatura.
async function buscarImportacaoPorHash(db, idFatura, hashArquivo) {
  const result = await db.query(
    `SELECT id, hash_arquivo, qtd_linhas, dt_cadastro
       FROM fatura_importacao
      WHERE id_fatura = $1 AND hash_arquivo = $2
      LIMIT 1`,
    [idFatura, hashArquivo]
  );
  return result.rows[0];
}

// Conta transações existentes da fatura (p/ política de "CSV corrigido").
async function contarTransacoes(db, idFatura) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total FROM fatura_transacao WHERE id_fatura = $1`,
    [idFatura]
  );
  return result.rows[0]?.total ?? 0;
}

// Registra o lote de importação. id_familia vem do contexto de RLS.
async function criarImportacao(db, dados) {
  const result = await db.query(
    `INSERT INTO fatura_importacao
        (id_familia, id_fatura, emissor, hash_arquivo, nome_arquivo,
         tamanho_bytes, qtd_linhas, usuario_cadastro)
     VALUES
        (current_setting('app.current_familia_id', true)::uuid,
         $1, $2, $3, $4, $5, $6, $7)
     RETURNING id, id_fatura, emissor, hash_arquivo, nome_arquivo,
               tamanho_bytes, qtd_linhas, usuario_cadastro, dt_cadastro`,
    [
      dados.id_fatura,
      dados.emissor,
      dados.hash_arquivo,
      dados.nome_arquivo,
      dados.tamanho_bytes,
      dados.qtd_linhas,
      dados.usuario_cadastro,
    ]
  );
  return result.rows[0];
}

// Insere as transações do lote (em massa), na mesma transação (db) — atômico.
// Cada item deve trazer fingerprint_linha já calculado pelo service.
async function inserirTransacoesEmLote(db, idFatura, idImportacao, transacoes, usuarioCadastro) {
  if (!Array.isArray(transacoes) || transacoes.length === 0) return 0;

  // Monta o VALUES dinâmico. Colunas por linha (sem id_familia, que vem do contexto):
  // id_fatura, id_importacao, dt_compra, estabelecimento, valor, valor_original,
  // parcela_texto, numero_parcela, total_parcelas, portador_nome_importado,
  // status_liquidacao, fingerprint_linha, usuario_cadastro
  const COLS_POR_LINHA = 13;
  const valuesSql = [];
  const params = [];

  transacoes.forEach((t, idx) => {
    const base = idx * COLS_POR_LINHA;
    valuesSql.push(
      `(current_setting('app.current_familia_id', true)::uuid,` +
      ` $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5},` +
      ` $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10},` +
      ` $${base + 11}, $${base + 12}, $${base + 13})`
    );
    params.push(
      idFatura,
      idImportacao,
      t.dt_compra,
      t.estabelecimento,
      t.valor,
      t.valor_original,
      t.parcela_texto,
      t.numero_parcela,
      t.total_parcelas,
      t.portador_nome_importado,
      t.status_liquidacao,
      t.fingerprint_linha,
      usuarioCadastro ?? null
    );
  });

  const result = await db.query(
    `INSERT INTO fatura_transacao
        (id_familia, id_fatura, id_importacao, dt_compra, estabelecimento,
         valor, valor_original, parcela_texto, numero_parcela, total_parcelas,
         portador_nome_importado, status_liquidacao, fingerprint_linha, usuario_cadastro)
     VALUES ${valuesSql.join(', ')}
     RETURNING id`,
    params
  );
  return result.rowCount;
}

export {
  listarFaturasPorConta,
  buscarFaturaPorCompetencia,
  buscarFaturaPorId,
  criarFatura,
  atualizarReserva,
  fecharFatura,
  buscarContaCredito,
  totaisPorStatus,
  totaisPorPortador,
  totaisPorCategoria,
  listarTransacoes,
  buscarTransacaoPorId,
  atualizarTransacao,
  buscarImportacaoPorHash,
  contarTransacoes,
  criarImportacao,
  inserirTransacoesEmLote,
};
