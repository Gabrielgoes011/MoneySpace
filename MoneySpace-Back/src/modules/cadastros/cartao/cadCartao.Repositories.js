// ========================================
// REPOSITORY: CADASTRO DE CARTÕES
// ========================================
// Só SQL da tabela `cartao`. Todas as funções recebem `db` = req.db (transação com RLS).
// Além do RLS, toda query filtra por `id_familia` explicitamente.
// Regra: SQL 100% literal e parametrizado ($1, $2). Nada de concatenar string na query.

//#region => Query para listar os cartões da família
//lista os cartões não arquivados, o principal primeiro
async function listarCartoesRepository(db) {

    //executa a consulta SQL com o nome do dono (JOIN com usuario)
    const resultado = await db.query(`
        SELECT
            a.id,
            a.nome,
            a.final,
            a.limite,
            a.dia_fechamento,
            a.dia_vencimento,
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

//#region => Query para desmarcar o cartão principal atual
//usado antes de marcar outro cartão como principal (só pode existir 1 por família)
async function desmarcarPrincipalRepository(db) {

    //executa a consulta SQL que tira o principal de todos os cartões da família
    await db.query(`
        UPDATE cartao
        SET principal = false
        WHERE id_familia = current_setting('app.current_familia_id', true)::uuid
        AND principal = true`
    );
}
//#endregion

//#region => Query para cadastrar cartão
//recebe o objeto `dadosCartao` já validado pelo controller
async function criarCartaoRepository(db, dadosCartao) {

    //executa a consulta SQL para inserir o cartão na família atual
    const resultado = await db.query(`
        INSERT INTO cartao
            (id_familia, id_usuario, nome, final, limite, dia_fechamento, dia_vencimento, principal, usuario_cadastro)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
            id,
            id_usuario,
            nome,
            final,
            limite,
            dia_fechamento,
            dia_vencimento,
            principal`,
        [
            dadosCartao.idUsuario,
            dadosCartao.nome,
            dadosCartao.final,
            dadosCartao.limite,
            dadosCartao.diaFechamento,
            dadosCartao.diaVencimento,
            dadosCartao.principal,
            dadosCartao.usuarioCadastro
        ]
    );

    //retorna o cartão criado
    return resultado.rows[0];
}
//#endregion

//#region => Queries para excluir cartão
//busca um cartão da família pelo id (para saber se existe)
async function buscarCartaoPorIdRepository(db, idCartao) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        SELECT id, nome, final, principal
        FROM cartao
        WHERE id = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [idCartao]
    );

    //retorna o cartão ou undefined se não existir
    return resultado.rows[0];
}

//conta os lançamentos (movimentação) das faturas do cartão
async function contarMovimentacoesCartaoRepository(db, idCartao) {

    //executa a consulta SQL: lançamentos ligados às faturas deste cartão
    const resultado = await db.query(`
        SELECT COUNT(*)::int AS total
        FROM fatura_transacao a
        INNER JOIN fatura_corpo b ON b.id_fatura = a.id_fatura
        WHERE b.id_cartao = $1
        AND b.id_familia = current_setting('app.current_familia_id', true)::uuid`, [idCartao]
    );

    //retorna o total de lançamentos
    return resultado.rows[0].total;
}

//apaga as faturas do cartão que estão vazias (sem nenhum lançamento)
async function excluirFaturasVaziasCartaoRepository(db, idCartao) {

    //executa a consulta SQL para apagar só faturas sem lançamentos
    await db.query(`
        DELETE FROM fatura_corpo a
        WHERE a.id_cartao = $1
        AND a.id_familia = current_setting('app.current_familia_id', true)::uuid
        AND NOT EXISTS (
            SELECT 1
            FROM fatura_transacao b
            WHERE b.id_fatura = a.id_fatura
        )`, [idCartao]
    );
}

//apaga o cartão da família e devolve o que foi apagado
async function excluirCartaoRepository(db, idCartao) {

    //executa a consulta SQL para apagar o cartão
    const resultado = await db.query(`
        DELETE FROM cartao
        WHERE id = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id, nome`, [idCartao]
    );

    //retorna o cartão apagado
    return resultado.rows[0];
}
//#endregion

//#region => exportação das funções
export {
    listarCartoesRepository,
    desmarcarPrincipalRepository,
    criarCartaoRepository,
    buscarCartaoPorIdRepository,
    contarMovimentacoesCartaoRepository,
    excluirFaturasVaziasCartaoRepository,
    excluirCartaoRepository
}
//#endregion
