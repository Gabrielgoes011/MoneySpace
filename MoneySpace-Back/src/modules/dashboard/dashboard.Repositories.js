// ========================================
// REPOSITORY: DASHBOARD (início)
// ========================================
// Só SQL. Todas as funções recebem `db` = req.db (transação com RLS).
// Além do RLS, toda query filtra por `id_familia` explicitamente.
// Gastos vêm dos lançamentos (fatura_transacao) das faturas da família.
// Parâmetros de período: `inicioPeriodo` (1º dia do mês) e `fimPeriodo` (1º dia do mês seguinte).
// `idCartao` = null significa "todos os cartões".
// Alias de tabela: só letra, na ordem a, b, c, d, e (1ª tabela = a, 2ª = b...).
// Regra: SQL 100% literal e parametrizado ($1, $2). Nada de concatenar string na query.

//#region => Query para listar os cartões do dashboard
//cartões não arquivados da família; o principal primeiro
async function listarCartoesDashboardRepository(db) {

    //executa a consulta SQL com o nome do dono (JOIN com usuario)
    const resultado = await db.query(`
        SELECT
            a.id,
            a.nome,
            a.final,
            a.principal,
            a.id_usuario,
            b.nome AS nome_dono
        FROM cartao a
        INNER JOIN usuario b ON b.id = a.id_usuario
        WHERE a.id_familia = current_setting('app.current_familia_id', true)::uuid
        AND a.arquivado = false
        ORDER BY a.principal DESC, a.nome ASC`
    );

    //retorna a lista de cartões
    return resultado.rows;
}
//#endregion

//#region => Queries de gasto por usuário (quem gasta mais)
//lista TODOS os usuários da família com o total gasto no período (0 se não gastou)
//o portador da fatura é o nome vindo do CSV, então o vínculo é pelo nome (sem diferença de maiúsculas)
async function totalPorUsuarioRepository(db, inicioPeriodo, fimPeriodo, idCartao) {

    //executa a consulta SQL: LEFT JOIN para manter quem não tem nenhum lançamento
    const resultado = await db.query(`
        SELECT
            a.id,
            a.nome,
            COALESCE(SUM(b.valor), 0) AS total,
            COUNT(b.id_transacao)::int AS qtd
        FROM usuario a
        LEFT JOIN fatura_transacao b
            ON UPPER(TRIM(b.portador)) = UPPER(TRIM(a.nome))
            AND b.id_familia = current_setting('app.current_familia_id', true)::uuid
            AND b.dt_compra >= $1::date
            AND b.dt_compra < $2::date
            AND b.valor > 0
            AND b.estabelecimento <> 'Pagamento de fatura'
            AND b.id_fatura IN (
                SELECT c.id_fatura
                FROM fatura_corpo c
                WHERE c.id_familia = current_setting('app.current_familia_id', true)::uuid
                AND ($3::uuid IS NULL OR c.id_cartao = $3::uuid)
            )
        WHERE a.id_familia = current_setting('app.current_familia_id', true)::uuid
        GROUP BY a.id, a.nome
        ORDER BY total DESC, a.nome ASC`, [inicioPeriodo, fimPeriodo, idCartao]
    );

    //retorna a lista de usuários com o total
    return resultado.rows;
}
//#endregion

//#region => Queries de gasto por categoria
//lista TODAS as categorias cadastradas (tabela global utilitario) com o total no período
//a categoria do lançamento é o texto da categoria, então o vínculo é pelo valor (sem diferença de maiúsculas)
async function totalPorCategoriaRepository(db, inicioPeriodo, fimPeriodo, idCartao) {

    //executa a consulta SQL: LEFT JOIN para manter categorias sem gasto
    const resultado = await db.query(`
        SELECT
            a.id,
            a.valor,
            COALESCE(SUM(b.valor), 0) AS total,
            COUNT(b.id_transacao)::int AS qtd
        FROM utilitario a
        LEFT JOIN fatura_transacao b
            ON UPPER(TRIM(b.categoria)) = UPPER(TRIM(a.valor))
            AND b.id_familia = current_setting('app.current_familia_id', true)::uuid
            AND b.dt_compra >= $1::date
            AND b.dt_compra < $2::date
            AND b.valor > 0
            AND b.estabelecimento <> 'Pagamento de fatura'
            AND b.id_fatura IN (
                SELECT c.id_fatura
                FROM fatura_corpo c
                WHERE c.id_familia = current_setting('app.current_familia_id', true)::uuid
                AND ($3::uuid IS NULL OR c.id_cartao = $3::uuid)
            )
        WHERE a.tipo = 'categoria'
        GROUP BY a.id, a.valor
        ORDER BY total DESC, a.valor ASC`, [inicioPeriodo, fimPeriodo, idCartao]
    );

    //retorna a lista de categorias com o total
    return resultado.rows;
}

//total dos lançamentos SEM categoria (vazia ou que não existe mais no cadastro)
async function totalSemCategoriaRepository(db, inicioPeriodo, fimPeriodo, idCartao) {

    //executa a consulta SQL: lançamentos cuja categoria não bate com nenhuma cadastrada
    const resultado = await db.query(`
        SELECT
            COALESCE(SUM(a.valor), 0) AS total,
            COUNT(a.id_transacao)::int AS qtd
        FROM fatura_transacao a
        WHERE a.id_familia = current_setting('app.current_familia_id', true)::uuid
        AND a.dt_compra >= $1::date
        AND a.dt_compra < $2::date
        AND a.valor > 0
        AND a.estabelecimento <> 'Pagamento de fatura'
        AND a.id_fatura IN (
            SELECT b.id_fatura
            FROM fatura_corpo b
            WHERE b.id_familia = current_setting('app.current_familia_id', true)::uuid
            AND ($3::uuid IS NULL OR b.id_cartao = $3::uuid)
        )
        AND NOT EXISTS (
            SELECT 1
            FROM utilitario c
            WHERE c.tipo = 'categoria'
            AND UPPER(TRIM(c.valor)) = UPPER(TRIM(a.categoria))
        )`, [inicioPeriodo, fimPeriodo, idCartao]
    );

    //retorna o total e a quantidade
    return resultado.rows[0];
}
//#endregion

//#region => Query do resumo da fatura (cards do topo)
//soma por status do lançamento no período
async function resumoPeriodoRepository(db, inicioPeriodo, fimPeriodo, idCartao) {

    //executa a consulta SQL: totais por status dos lançamentos
    const resultado = await db.query(`
        SELECT
            COALESCE(SUM(a.valor) FILTER (WHERE a.status_transacao = 'na hora'), 0) AS pago,
            COALESCE(SUM(a.valor) FILTER (WHERE a.status_transacao = 'pendente'), 0) AS pendente,
            COALESCE(SUM(a.valor) FILTER (WHERE a.status_transacao = 'no fechamento'), 0) AS fechamento,
            COALESCE(SUM(a.valor), 0) AS total
        FROM fatura_transacao a
        WHERE a.id_familia = current_setting('app.current_familia_id', true)::uuid
        AND a.dt_compra >= $1::date
        AND a.dt_compra < $2::date
        AND a.valor > 0
        AND a.estabelecimento <> 'Pagamento de fatura'
        AND a.id_fatura IN (
            SELECT b.id_fatura
            FROM fatura_corpo b
            WHERE b.id_familia = current_setting('app.current_familia_id', true)::uuid
            AND ($3::uuid IS NULL OR b.id_cartao = $3::uuid)
        )`, [inicioPeriodo, fimPeriodo, idCartao]
    );

    //retorna os totais do resumo
    return resultado.rows[0];
}

//saldo da reserva digitado nas faturas do cartão escolhido (soma)
async function saldoReservaPeriodoRepository(db, idCartao) {

    //executa a consulta SQL: soma o saldo_reserva das faturas da família para o cartão escolhido
    const resultado = await db.query(`
        SELECT COALESCE(SUM(a.saldo_reserva), 0) AS saldo_reserva
        FROM fatura_corpo a
        WHERE a.id_familia = current_setting('app.current_familia_id', true)::uuid
        AND ($1::uuid IS NULL OR a.id_cartao = $1::uuid)`, [idCartao]
    );

    //retorna o saldo
    return resultado.rows[0];
}
//#endregion

//#region => exportação das funções
export {
    listarCartoesDashboardRepository,
    totalPorUsuarioRepository,
    totalPorCategoriaRepository,
    totalSemCategoriaRepository,
    resumoPeriodoRepository,
    saldoReservaPeriodoRepository
}
//#endregion
