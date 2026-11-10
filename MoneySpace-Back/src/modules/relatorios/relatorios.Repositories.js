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
            TO_CHAR(a.dt_compra, 'DD/MM/YYYY') AS data_compra,
            TO_CHAR(a.dt_compra, 'YYYY-MM-DD') AS data_iso,
            a.estabelecimento,
            a.portador,
            a.valor,
            a.parcela,
            a.categoria,
            a.status_transacao
        FROM fatura_transacao a
        WHERE a.id_fatura = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY a.dt_compra ASC, a.estabelecimento ASC`, [idFatura]
    );

    //retorna a lista de lançamentos
    return resultado.rows;
}
//#endregion

//#region => exportação das funções
export {
    buscarCabecalhoFaturaRepository,
    listarLancamentosRelatorioRepository
}
//#endregion
