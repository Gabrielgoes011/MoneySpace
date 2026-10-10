// ========================================
// REPOSITORY: CONTA
// ========================================
// Camada de acesso ao banco. ÚNICO lugar com SQL do módulo de conta.
// Mapeado para a tabela `conta` do script.sql:
//   tipo ∈ ('CORRENTE', 'CREDITO', 'CARTEIRA')
//   campos de cartão (bandeira, final_cartao, limite, dia_fechamento,
//   dia_vencimento) só valem quando tipo = 'CREDITO'.
//   `ativo` = soft delete (arquivar). RLS filtra por id_familia automaticamente.
//
// IMPORTANTE (RLS): o contexto app.current_familia_id vive na TRANSAÇÃO que o
// rlsMiddleware abre por request. Essa transação é o `req.db`. Por isso as
// funções recebem `db` (o client da transação) por parâmetro — assim as queries
// enxergam o contexto e as policies filtram pela família correta.

// Lista as contas ativas da família (RLS filtra por id_familia).
async function listarContas(db) {
  const result = await db.query(
    `SELECT id, nome, tipo, saldo_inicial, bandeira,
            final_cartao, limite, dia_fechamento, dia_vencimento,
            ativo, usuario_cadastro, dt_cadastro
       FROM conta
      WHERE ativo = true
      ORDER BY nome ASC`
  );

  return result.rows;
}

// Busca uma conta pelo id (RLS garante que seja da família do request).
async function buscarContaPorId(db, id) {
  const result = await db.query(
    `SELECT id, nome, tipo, saldo_inicial, bandeira,
            final_cartao, limite, dia_fechamento, dia_vencimento,
            ativo, usuario_cadastro, dt_cadastro
       FROM conta
      WHERE id = $1
      LIMIT 1`,
    [id]
  );

  return result.rows[0];
}

// Cria uma nova conta. id_familia vem do contexto de RLS da transação.
async function criarConta(db, dados) {
  const result = await db.query(
    `INSERT INTO conta
        (id_familia, nome, tipo, saldo_inicial, bandeira, final_cartao,
         limite, dia_fechamento, dia_vencimento, usuario_cadastro)
     VALUES
        (current_setting('app.current_familia_id', true)::uuid,
         $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING 
        id, nome, tipo, saldo_inicial, bandeira, final_cartao,
        limite, dia_fechamento, dia_vencimento, ativo,
        usuario_cadastro, dt_cadastro`,
    [
      dados.nome,
      dados.tipo,
      dados.saldo_inicial,
      dados.bandeira,
      dados.final_cartao,
      dados.limite,
      dados.dia_fechamento,
      dados.dia_vencimento,
      dados.usuario_cadastro,
    ]
  );

  return result.rows[0];
}

// Atualiza uma conta existente.
async function atualizarConta(db, id, dados) {
  const result = await db.query(
    `UPDATE conta
        SET nome = $1,
            tipo = $2,
            saldo_inicial = $3,
            bandeira = $4,
            final_cartao = $5,
            limite = $6,
            dia_fechamento = $7,
            dia_vencimento = $8
      WHERE id = $9
      RETURNING 
            id, nome, tipo, saldo_inicial, bandeira, final_cartao,
            limite, dia_fechamento, dia_vencimento, ativo,
            usuario_cadastro, dt_cadastro`,
    [
      dados.nome,
      dados.tipo,
      dados.saldo_inicial,
      dados.bandeira,
      dados.final_cartao,
      dados.limite,
      dados.dia_fechamento,
      dados.dia_vencimento,
      id,
    ]
  );

  return result.rows[0];
}

// Arquiva (soft delete) uma conta -> ativo = false. Preserva o histórico.
async function arquivarConta(db, id) {
  const result = await db.query(
    `UPDATE conta SET ativo = false WHERE id = $1 RETURNING id`,
    [id]
  );

  return result.rows[0];
}

export {
  listarContas,
  buscarContaPorId,
  criarConta,
  atualizarConta,
  arquivarConta,
};
