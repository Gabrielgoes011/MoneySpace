// ========================================
// REPOSITORY: RATEIO (compra rachada entre pessoas)
// ========================================
// Só SQL. Todas as funções recebem `db` = req.db (transação com RLS).
// Além do RLS, toda query filtra por `id_familia` explicitamente.
// Alias de tabela: só letra, na ordem a, b, c, d, e (subquery usa a próxima letra livre).
// Regra: SQL 100% literal e parametrizado ($1, $2).

//#region => Queries de leitura
//o lançamento que está sendo rateado
async function buscarLancamentoRateioRepository(db, idTransacao) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        SELECT
            a.id_transacao,
            TO_CHAR(a.dt_compra, 'YYYY-MM-DD') AS dt_compra,
            a.estabelecimento,
            a.portador,
            a.valor,
            a.parcela,
            a.rateado
        FROM fatura_transacao a
        WHERE a.id_transacao = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idTransacao]
    );

    //retorna o lançamento ou undefined
    return resultado.rows[0];
}

//as partes do lançamento, na ordem em que foram incluídas
async function listarPartesRateioRepository(db, idTransacao) {

    //executa a consulta SQL com JOIN na pessoa
    const resultado = await db.query(`
        SELECT
            a.id_rateio,
            b.nome,
            a.valor_previsto,
            a.absorvido
        FROM fatura_rateio a
        INNER JOIN rateio_pessoa b ON b.id_pessoa = a.id_pessoa
        WHERE a.id_transacao = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY a.dt_cadastro ASC, b.nome ASC`, [idTransacao]
    );

    //retorna a lista de partes
    return resultado.rows;
}

//todos os pagamentos das partes do lançamento
async function listarPagamentosRateioRepository(db, idTransacao) {

    //executa a consulta SQL com JOIN na parte
    const resultado = await db.query(`
        SELECT
            a.id_pagamento,
            a.id_rateio,
            a.valor,
            TO_CHAR(a.dt_pagamento, 'YYYY-MM-DD') AS dt_pagamento
        FROM fatura_rateio_pagamento a
        INNER JOIN fatura_rateio b ON b.id_rateio = a.id_rateio
        WHERE b.id_transacao = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY a.dt_pagamento ASC, a.dt_cadastro ASC`, [idTransacao]
    );

    //retorna a lista de pagamentos
    return resultado.rows;
}

//nomes já usados em rateios (para sugerir no campo de nome)
async function listarPessoasRateioRepository(db) {

    //executa a consulta SQL da família
    const resultado = await db.query(`
        SELECT a.nome
        FROM rateio_pessoa a
        WHERE a.id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY a.nome ASC`
    );

    //retorna a lista de nomes
    return resultado.rows;
}

//uma parte com o total já pago (soma dos pagamentos)
async function buscarParteRateioRepository(db, idRateio) {

    //executa a consulta SQL; a subquery usa a próxima letra livre
    const resultado = await db.query(`
        SELECT
            a.id_rateio,
            a.id_transacao,
            a.valor_previsto,
            a.absorvido,
            COALESCE((SELECT SUM(b.valor) FROM fatura_rateio_pagamento b WHERE b.id_rateio = a.id_rateio), 0) AS valor_pago
        FROM fatura_rateio a
        WHERE a.id_rateio = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idRateio]
    );

    //retorna a parte ou undefined
    return resultado.rows[0];
}

//um pagamento com o lançamento a que ele pertence
async function buscarPagamentoRateioRepository(db, idPagamento) {

    //executa a consulta SQL com JOIN na parte
    const resultado = await db.query(`
        SELECT
            a.id_pagamento,
            a.id_rateio,
            b.id_transacao
        FROM fatura_rateio_pagamento a
        INNER JOIN fatura_rateio b ON b.id_rateio = a.id_rateio
        WHERE a.id_pagamento = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idPagamento]
    );

    //retorna o pagamento ou undefined
    return resultado.rows[0];
}

//procura a pessoa pelo nome (sem diferença de maiúsculas)
async function buscarPessoaPorNomeRepository(db, nome) {

    //executa a consulta SQL da família
    const resultado = await db.query(`
        SELECT a.id_pessoa, a.nome
        FROM rateio_pessoa a
        WHERE LOWER(a.nome) = LOWER($1)
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [nome]
    );

    //retorna a pessoa ou undefined
    return resultado.rows[0];
}
//#endregion

//#region => Queries de escrita
//cadastra o nome de uma pessoa nova do rateio
async function criarPessoaRateioRepository(db, nome, usuarioCadastro) {

    //executa a consulta SQL para inserir na família atual
    const resultado = await db.query(`
        INSERT INTO rateio_pessoa
            (id_familia, nome, usuario_cadastro)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2)
        RETURNING id_pessoa, nome`, [nome, usuarioCadastro]
    );

    //retorna a pessoa criada
    return resultado.rows[0];
}

//inclui a parte de uma pessoa no lançamento
async function criarParteRateioRepository(db, dadosParte) {

    //executa a consulta SQL para inserir na família atual
    const resultado = await db.query(`
        INSERT INTO fatura_rateio
            (id_familia, id_transacao, id_pessoa, valor_previsto, usuario_cadastro)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2, $3, $4)
        RETURNING id_rateio`,
        [
            dadosParte.idTransacao,
            dadosParte.idPessoa,
            dadosParte.valorPrevisto,
            dadosParte.usuarioCadastro
        ]
    );

    //retorna o id da parte criada
    return resultado.rows[0];
}

//muda o valor previsto de uma parte
async function atualizarValorParteRepository(db, idRateio, valorPrevisto) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        UPDATE fatura_rateio
        SET valor_previsto = $1
        WHERE id_rateio = $2
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id_rateio`, [valorPrevisto, idRateio]
    );

    //retorna a parte atualizada ou undefined
    return resultado.rows[0];
}

//marca ou desmarca a parte como absorvida por quem adiantou a compra
async function definirAbsorvidoRepository(db, idRateio, absorvido) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        UPDATE fatura_rateio
        SET absorvido = $1
        WHERE id_rateio = $2
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id_rateio, absorvido`, [absorvido, idRateio]
    );

    //retorna a parte atualizada ou undefined
    return resultado.rows[0];
}

//apaga uma parte (os pagamentos dela saem junto, por isso o controller só deixa sem pagamentos)
async function excluirParteRateioRepository(db, idRateio) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        DELETE FROM fatura_rateio
        WHERE id_rateio = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid`, [idRateio]
    );

    //retorna quantas linhas foram apagadas
    return resultado.rowCount;
}

//registra um pagamento recebido de uma parte (sem data = hoje)
async function registrarPagamentoRateioRepository(db, dadosPagamento) {

    //executa a consulta SQL para inserir na família atual
    const resultado = await db.query(`
        INSERT INTO fatura_rateio_pagamento
            (id_familia, id_rateio, valor, dt_pagamento, usuario_cadastro)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2, COALESCE($3::date, CURRENT_DATE), $4)
        RETURNING id_pagamento`,
        [
            dadosPagamento.idRateio,
            dadosPagamento.valor,
            dadosPagamento.dataPagamento ?? null,
            dadosPagamento.usuarioCadastro
        ]
    );

    //retorna o id do pagamento criado
    return resultado.rows[0];
}

//apaga um pagamento lançado por engano
async function excluirPagamentoRateioRepository(db, idPagamento) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        DELETE FROM fatura_rateio_pagamento
        WHERE id_pagamento = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid`, [idPagamento]
    );

    //retorna quantas linhas foram apagadas
    return resultado.rowCount;
}

//liga a flag "rateado" do lançamento (ao incluir a primeira parte)
async function marcarLancamentoRateadoRepository(db, idTransacao) {

    //executa a consulta SQL filtrando pela família
    await db.query(`
        UPDATE fatura_transacao
        SET rateado = true
        WHERE id_transacao = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid`, [idTransacao]
    );
}
//#endregion

//#region => exportação das funções
export {
    buscarLancamentoRateioRepository,
    listarPartesRateioRepository,
    listarPagamentosRateioRepository,
    listarPessoasRateioRepository,
    buscarParteRateioRepository,
    buscarPagamentoRateioRepository,
    buscarPessoaPorNomeRepository,
    criarPessoaRateioRepository,
    criarParteRateioRepository,
    atualizarValorParteRepository,
    definirAbsorvidoRepository,
    excluirParteRateioRepository,
    registrarPagamentoRateioRepository,
    excluirPagamentoRateioRepository,
    marcarLancamentoRateadoRepository
}
//#endregion
