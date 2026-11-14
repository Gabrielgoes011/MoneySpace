// ========================================
// REPOSITORY: RELATÓRIOS
// ========================================
// Só SQL. Todas as funções recebem `db` = req.db (transação com RLS).
// Além do RLS, toda query filtra por `id_familia` explicitamente.
// Alias de tabela: só letra, na ordem a, b, c, d, e.
// Regra: SQL 100% literal e parametrizado ($1, $2).

//#region => Query para o cabeçalho da fatura do relatório
//fatura com o nome e os dados do cartão
async function buscarCabecalhoFaturaRepository(db, idFatura) {

    //executa a consulta SQL com JOIN no cartão
    const resultado = await db.query(`
        SELECT
            a.id_fatura,
            a.titulo,
            a.competencia,
            a.status_fat,
            a.saldo_reserva,
            TO_CHAR(a.data_fechamento, 'DD/MM/YYYY') AS data_fechamento,
            TO_CHAR(a.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
            b.nome AS nome_cartao,
            b.final AS final_cartao
        FROM fatura_corpo a
        INNER JOIN cartao b ON b.id = a.id_cartao
        WHERE a.id_fatura = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idFatura]
    );

    //retorna o cabeçalho ou undefined
    return resultado.rows[0];
}
//#endregion

//#region => Query para os lançamentos do relatório
//todos os lançamentos da fatura, do mais antigo para o mais recente
async function listarLancamentosRelatorioRepository(db, idFatura) {

    //executa a consulta SQL dos lançamentos
    const resultado = await db.query(`
        SELECT
            a.id_transacao,
            TO_CHAR(a.dt_compra, 'DD/MM/YYYY') AS data_compra,
            TO_CHAR(a.dt_compra, 'YYYY-MM-DD') AS data_iso,
            a.estabelecimento,
            a.portador,
            a.valor,
            a.parcela,
            a.categoria,
            a.status_transacao,
            COALESCE((
                SELECT SUM(c.valor)
                FROM fatura_rateio_pagamento c
                INNER JOIN fatura_rateio b ON b.id_rateio = c.id_rateio
                WHERE b.id_transacao = a.id_transacao
                AND b.absorvido = false
                AND c.id_familia = current_setting('app.current_familia_id', true)::uuid), 0) AS recebido
        FROM fatura_transacao a
        WHERE a.id_fatura = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY a.dt_compra ASC, a.estabelecimento ASC`, [idFatura]
    );

    //retorna a lista de lançamentos
    return resultado.rows;
}
//#endregion

//#region => Query para as partes do rateio das compras da fatura
//uma linha por parte (pessoa), com o total que ela já pagou
async function listarPartesRateioPendentesRepository(db, idFatura) {

    //executa a consulta SQL; a subquery de pagamentos usa a próxima letra livre
    const resultado = await db.query(`
        SELECT
            c.id_transacao,
            b.nome,
            a.valor_previsto,
            a.absorvido,
            COALESCE((
                SELECT SUM(d.valor)
                FROM fatura_rateio_pagamento d
                WHERE d.id_rateio = a.id_rateio
                AND d.id_familia = current_setting('app.current_familia_id', true)::uuid), 0) AS valor_pago
        FROM fatura_rateio a
        INNER JOIN rateio_pessoa b ON b.id_pessoa = a.id_pessoa
        INNER JOIN fatura_transacao c ON c.id_transacao = a.id_transacao
        WHERE c.id_fatura = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY b.nome ASC`, [idFatura]
    );

    //retorna as partes da fatura
    return resultado.rows;
}
//#endregion

//#region => exportação das funções
export {
    buscarCabecalhoFaturaRepository,
    listarLancamentosRelatorioRepository,
    listarPartesRateioPendentesRepository
}
//#endregion
