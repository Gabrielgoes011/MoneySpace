// ========================================
// REPOSITORY: FAMÍLIAS (gestão do dono do app)
// ========================================
// Camada de acesso ao banco. Todas as funções recebem `db` = req.db (client da transação com o contexto de RLS).
// O role da aplicação NÃO lê nem cria famílias de outras famílias direto: tudo passa pelas funções
// SECURITY DEFINER da migration 007, que conferem no banco se quem chamou é master (usuario.is_master).
// Regra: SQL 100% literal e parametrizado ($1, $2). Nada de concatenar string na query.

//#region => query para saber se quem chamou é o dono do app
async function verificarMasterRepository(db) {

    //executa a função que lê o usuário do contexto e confere is_master no banco
    const resultado = await db.query(`
        SELECT fn_master_eh_master() AS master
    `);

    //retorna true ou false
    return resultado.rows[0].master === true;
}
//#endregion

//#region => query para listar todas as famílias (só master)
async function listarFamiliasRepository(db) {

    //executa a função de listagem (já devolve os totais de usuários e cartões)
    const resultado = await db.query(`
        SELECT
            a.id,
            a.nome,
            a.dt_cadastro,
            a.total_usuarios,
            a.total_cartoes
        FROM fn_master_listar_familias() a
    `);

    //retorna a lista de famílias
    return resultado.rows;
}
//#endregion

//#region => query para cadastrar família com o primeiro administrador (só master)
//`adminSenhaHash` já vem com bcrypt
async function cadastrarFamiliaRepository(db, { nome, adminNome, adminCpf, adminEmail, adminSenhaHash }) {

    //executa a função que cria a família e o usuário Admin na mesma chamada
    const resultado = await db.query(`
        SELECT
            a.nova_familia_id,
            a.novo_usuario_id
        FROM fn_master_criar_familia($1, $2, $3, $4, $5) a
    `, [nome, adminNome, adminCpf, adminEmail, adminSenhaHash]);

    //retorna os ids criados
    return resultado.rows[0];
}
//#endregion

//#region => exportação das funções
export {
    verificarMasterRepository,
    listarFamiliasRepository,
    cadastrarFamiliaRepository
};
//#endregion
