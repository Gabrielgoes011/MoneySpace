// ========================================
// REPOSITORY: CADASTRO DE CATEGORIAS
// ========================================
// Categorias ficam na tabela GLOBAL `utilitario` (tipo = 'categoria').
// A tabela NÃO tem id_familia nem RLS, então não há filtro de família aqui.
// Todas as funções recebem `db` = req.db e o `tipo` como parâmetro.
// Regra: SQL 100% literal e parametrizado ($1, $2). Nada de concatenar string na query.

//#region => Query para listar as categorias
async function listarCategoriasRepository(db, tipo) {

    //executa a consulta SQL para listar pela ordem e depois pelo nome
    const resultado = await db.query(`
        SELECT
            id,
            valor,
            ordem,
            dt_cadastro
        FROM utilitario
        WHERE tipo = $1
        ORDER BY ordem ASC, valor ASC`, [tipo]
    );

    //retorna a lista de categorias
    return resultado.rows;
}
//#endregion

//#region => Query para cadastrar categoria
async function criarCategoriaRepository(db, tipo, valor) {

    //executa a consulta SQL para inserir já na próxima posição da ordem
    const resultado = await db.query(`
        INSERT INTO utilitario
            (tipo, valor, ordem)
        VALUES
            ($1, $2, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM utilitario WHERE tipo = $3))
        RETURNING id, valor, ordem, dt_cadastro`,
        [tipo, valor, tipo]
    );

    //retorna a categoria criada
    return resultado.rows[0];
}
//#endregion

//#region => exportação das funções
export {
    listarCategoriasRepository,
    criarCategoriaRepository
}
//#endregion
