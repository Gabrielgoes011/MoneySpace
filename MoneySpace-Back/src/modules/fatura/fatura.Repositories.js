// ========================================
// REPOSITORY: FATURA (cabeçalho + lançamentos)
// ========================================
// Só SQL. Todas as funções recebem `db` = req.db (transação com RLS).
// Além do RLS, toda query filtra por `id_familia` explicitamente.
// Alias de tabela: só letra, na ordem a, b, c, d, e (1ª tabela = a, 2ª = b...).
// Regra: SQL 100% literal e parametrizado ($1, $2). Nada de concatenar string na query.

//#region => Queries para buscar a fatura
//busca o cartão da família (precisa dos dias para calcular fechamento e vencimento)
async function buscarCartaoParaFaturaRepository(db, idCartao) {

    //executa a consulta SQL filtrando pela família e por cartão ativo
    const resultado = await db.query(`
        SELECT a.id, a.nome, a.final, a.dia_fechamento, a.dia_vencimento
        FROM cartao a
        WHERE a.id = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        AND a.arquivado = false
        LIMIT 1`, [idCartao]
    );

    //retorna o cartão ou undefined se não existir
    return resultado.rows[0];
}

//busca a fatura de um cartão em uma competência (AAAA-MM)
async function buscarFaturaPorCartaoCompetenciaRepository(db, idCartao, competencia) {

    //executa a consulta SQL da fatura do cartão no mês
    const resultado = await db.query(`
        SELECT
            a.id_fatura,
            a.titulo,
            a.competencia,
            a.id_cartao,
            a.saldo_reserva,
            a.status_fat,
            TO_CHAR(a.data_fechamento, 'YYYY-MM-DD') AS data_fechamento,
            TO_CHAR(a.data_vencimento, 'YYYY-MM-DD') AS data_vencimento
        FROM fatura_corpo a
        WHERE a.id_cartao = $1
        AND a.competencia = $2
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idCartao, competencia]
    );

    //retorna a fatura ou undefined
    return resultado.rows[0];
}

//busca uma fatura da família pelo id
async function buscarFaturaPorIdRepository(db, idFatura) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        SELECT
            a.id_fatura,
            a.titulo,
            a.competencia,
            a.id_cartao,
            a.saldo_reserva,
            a.status_fat,
            TO_CHAR(a.data_fechamento, 'YYYY-MM-DD') AS data_fechamento,
            TO_CHAR(a.data_vencimento, 'YYYY-MM-DD') AS data_vencimento
        FROM fatura_corpo a
        WHERE a.id_fatura = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idFatura]
    );

    //retorna a fatura ou undefined
    return resultado.rows[0];
}

//lista os lançamentos da fatura (mais antigos primeiro)
async function listarLancamentosFaturaRepository(db, idFatura) {

    //executa a consulta SQL dos lançamentos da fatura
    const resultado = await db.query(`
        SELECT
            a.id_transacao,
            TO_CHAR(a.dt_compra, 'YYYY-MM-DD') AS dt_compra,
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

//#region => Queries para criar e alterar a fatura
//cria a fatura do cartão no mês (dados já calculados pelo controller)
async function criarFaturaRepository(db, dadosFatura) {

    //executa a consulta SQL para inserir a fatura na família atual
    const resultado = await db.query(`
        INSERT INTO fatura_corpo
            (id_familia, id_cartao, titulo, competencia, data_fechamento, data_vencimento, usuario_cadastro)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2, $3, $4, $5, $6)
        RETURNING
            id_fatura,
            titulo,
            competencia,
            id_cartao,
            saldo_reserva,
            status_fat,
            TO_CHAR(data_fechamento, 'YYYY-MM-DD') AS data_fechamento,
            TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS data_vencimento`,
        [
            dadosFatura.idCartao,
            dadosFatura.titulo,
            dadosFatura.competencia,
            dadosFatura.dataFechamento,
            dadosFatura.dataVencimento,
            dadosFatura.usuarioCadastro
        ]
    );

    //retorna a fatura criada
    return resultado.rows[0];
}

//grava o saldo da reserva digitado na fatura
async function definirSaldoFaturaRepository(db, idFatura, saldoReserva) {

    //executa a consulta SQL que atualiza só o saldo
    const resultado = await db.query(`
        UPDATE fatura_corpo
        SET saldo_reserva = $1
        WHERE id_fatura = $2
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id_fatura, saldo_reserva`,
        [saldoReserva, idFatura]
    );

    //retorna a fatura atualizada
    return resultado.rows[0];
}

//fecha a fatura (só se ainda estiver aberta)
async function fecharFaturaRepository(db, idFatura) {

    //executa a consulta SQL que marca como FECHADA e guarda a data do fechamento
    const resultado = await db.query(`
        UPDATE fatura_corpo
        SET status_fat = 'FECHADA', dt_fechamento = NOW()
        WHERE id_fatura = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        AND status_fat = 'ABERTA'
        RETURNING id_fatura, status_fat`,
        [idFatura]
    );

    //retorna a fatura fechada
    return resultado.rows[0];
}
//#endregion

//#region => Queries para categoria (validação do lançamento)
//devolve o valor exato cadastrado da categoria (sem diferença de maiúsculas)
async function buscarCategoriaRepository(db, valorCategoria) {

    //executa a consulta SQL na tabela global de categorias
    const resultado = await db.query(`
        SELECT a.valor
        FROM utilitario a
        WHERE a.tipo = 'categoria'
        AND UPPER(TRIM(a.valor)) = UPPER(TRIM($1))
        LIMIT 1`, [valorCategoria]
    );

    //retorna a categoria cadastrada ou undefined
    return resultado.rows[0];
}
//#endregion

//#region => Queries para lançamentos
//grava um lançamento manual na fatura
async function criarLancamentoRepository(db, dadosLancamento) {

    //executa a consulta SQL para inserir o lançamento na família atual
    const resultado = await db.query(`
        INSERT INTO fatura_transacao
            (id_familia, id_fatura, dt_compra, estabelecimento, portador, valor, parcela, categoria, status_transacao, usuario_cadastro)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id_transacao`,
        [
            dadosLancamento.idFatura,
            dadosLancamento.dataCompra,
            dadosLancamento.estabelecimento,
            dadosLancamento.portador,
            dadosLancamento.valor,
            dadosLancamento.parcela,
            dadosLancamento.categoria,
            dadosLancamento.statusTransacao,
            dadosLancamento.usuarioCadastro
        ]
    );

    //retorna o id do lançamento criado
    return resultado.rows[0];
}

//busca um lançamento com o status da fatura dele (para saber se pode alterar)
async function buscarLancamentoComFaturaRepository(db, idTransacao) {

    //executa a consulta SQL com JOIN na fatura
    const resultado = await db.query(`
        SELECT
            a.id_transacao,
            a.id_fatura,
            TO_CHAR(a.dt_compra, 'YYYY-MM-DD') AS dt_compra,
            a.estabelecimento,
            a.portador,
            a.valor,
            a.parcela,
            a.categoria,
            a.status_transacao,
            b.status_fat
        FROM fatura_transacao a
        INNER JOIN fatura_corpo b ON b.id_fatura = a.id_fatura
        WHERE a.id_transacao = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idTransacao]
    );

    //retorna o lançamento ou undefined
    return resultado.rows[0];
}

//altera o status de um lançamento
async function alterarStatusLancamentoRepository(db, idTransacao, statusTransacao) {

    //executa a consulta SQL que atualiza só o status
    const resultado = await db.query(`
        UPDATE fatura_transacao
        SET status_transacao = $1
        WHERE id_transacao = $2
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id_transacao, status_transacao`,
        [statusTransacao, idTransacao]
    );

    //retorna o lançamento atualizado
    return resultado.rows[0];
}
//#endregion

//#region => Query para listar as faturas de um cartão
//todas as faturas do cartão, da mais recente para a mais antiga
async function listarFaturasCartaoRepository(db, idCartao) {

    //executa a consulta SQL filtrando pela família e pelo cartão
    const resultado = await db.query(`
        SELECT
            a.id_fatura,
            a.titulo,
            a.competencia,
            a.status_fat
        FROM fatura_corpo a
        WHERE a.id_cartao = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY a.competencia DESC`, [idCartao]
    );

    //retorna a lista de faturas
    return resultado.rows;
}
//#endregion

//#region => Queries para editar e excluir lançamento
//grava todos os campos editáveis do lançamento (o controller já decidiu o valor de cada um)
async function atualizarLancamentoRepository(db, idTransacao, dadosLancamento) {

    //executa a consulta SQL que atualiza o lançamento da família
    const resultado = await db.query(`
        UPDATE fatura_transacao
        SET
            dt_compra = $1,
            estabelecimento = $2,
            portador = $3,
            valor = $4,
            parcela = $5,
            categoria = $6,
            status_transacao = $7
        WHERE id_transacao = $8
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id_transacao, status_transacao`,
        [
            dadosLancamento.dataCompra,
            dadosLancamento.estabelecimento,
            dadosLancamento.portador,
            dadosLancamento.valor,
            dadosLancamento.parcela,
            dadosLancamento.categoria,
            dadosLancamento.statusTransacao,
            idTransacao
        ]
    );

    //retorna o lançamento atualizado
    return resultado.rows[0];
}

//apaga um lançamento da família
async function excluirLancamentoRepository(db, idTransacao) {

    //executa a consulta SQL que apaga o lançamento
    const resultado = await db.query(`
        DELETE FROM fatura_transacao
        WHERE id_transacao = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id_transacao`,
        [idTransacao]
    );

    //retorna o lançamento apagado
    return resultado.rows[0];
}
//#endregion

//#region => Query para reabrir a fatura
//volta a fatura para aberta (só se estiver fechada) e limpa a data de fechamento
async function abrirFaturaRepository(db, idFatura) {

    //executa a consulta SQL que muda o status de volta para ABERTA
    const resultado = await db.query(`
        UPDATE fatura_corpo
        SET status_fat = 'ABERTA', dt_fechamento = NULL
        WHERE id_fatura = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        AND status_fat = 'FECHADA'
        RETURNING id_fatura, status_fat`,
        [idFatura]
    );

    //retorna a fatura reaberta
    return resultado.rows[0];
}
//#endregion

//#region => exportação das funções
export {
    abrirFaturaRepository,
    atualizarLancamentoRepository,
    excluirLancamentoRepository,
    listarFaturasCartaoRepository,
    buscarCartaoParaFaturaRepository,
    buscarFaturaPorCartaoCompetenciaRepository,
    buscarFaturaPorIdRepository,
    listarLancamentosFaturaRepository,
    criarFaturaRepository,
    definirSaldoFaturaRepository,
    fecharFaturaRepository,
    buscarCategoriaRepository,
    criarLancamentoRepository,
    buscarLancamentoComFaturaRepository,
    alterarStatusLancamentoRepository
}
//#endregion
