// ========================================
// REPOSITORY: CADASTRO DE USUÁRIOS (da família)
// ========================================
// Camada de acesso ao banco. Só SQL da tabela `usuario` (e o nome da `familia`).
// Todas as funções recebem `db` = req.db (client da transação com o contexto de
// RLS). Além do RLS, TODA query filtra por `id_familia` explicitamente (defesa
// em profundidade: se o papel do banco ignorar o RLS, o filtro ainda isola).
// Nunca devolve `senha` nem `mfa_secreto`.
// Regra: SQL 100% literal e parametrizado ($1, $2). Nada de concatenar string na query.

//#region => Query para buscar a família do usuário logado
async function buscarFamiliaAtualRepository(db) {

    //executa a consulta SQL para buscar id e nome da família
    const resultado = await db.query(`
        SELECT id, nome
        FROM familia
        WHERE id = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`
    );

    //retorna o resultado da consulta
    return resultado.rows[0];
}
//#endregion

//#region => Query para listar os membros da família
async function listarUsuariosRepository(db) {

    //executa a consulta SQL para listar os membros por nome
    const resultado = await db.query(`
        SELECT
            id,
            nome,
            email,
            cpf,
            role,
            is_master,
            mfa_ativo,
            dt_cadastro
        FROM usuario
        WHERE id_familia = current_setting('app.current_familia_id', true)::uuid
        ORDER BY nome ASC`
    );

    //retorna a lista de usuários
    return resultado.rows;
}
//#endregion

//#region => Querys para buscar um usuário
//busca um usuário da família pelo id
async function buscarUsuarioPorIdRepository(db, id) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        SELECT
            id,
            nome,
            email,
            cpf,
            role,
            is_master,
            mfa_ativo,
            dt_cadastro
        FROM usuario
        WHERE id = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [id]
    );

    //retorna o usuário ou undefined se não existir
    return resultado.rows[0];
}

//busca o papel de quem está fazendo a requisição (para checar autorização)
async function buscarPapelRepository(db, id) {

    //executa a consulta SQL para buscar role e is_master
    const resultado = await db.query(`
        SELECT id, role, is_master
        FROM usuario
        WHERE id = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [id]
    );

    //retorna o papel do usuário
    return resultado.rows[0];
}
//#endregion

//#region => Query para cadastrar usuário
//`senhaHash` já vem com bcrypt
async function criarUsuarioRepository(db, { nome, cpf, email, senhaHash, role }) {

    //executa a consulta SQL para inserir o usuário na família atual
    const resultado = await db.query(`
        INSERT INTO usuario
            (id_familia, nome, cpf, email, senha, role)
        VALUES
            (current_setting('app.current_familia_id', true)::uuid, $1, $2, $3, $4, $5)
        RETURNING
            id,
            nome,
            email,
            cpf,
            role,
            is_master,
            mfa_ativo,
            dt_cadastro`,
        [nome, cpf, email, senhaHash, role]
    );

    //retorna o usuário criado
    return resultado.rows[0];
}
//#endregion

//#region => Query para atualizar usuário
//atualiza só os campos informados: o que vier undefined/null mantém o valor atual (COALESCE)
async function atualizarUsuarioRepository(db, id, { nome, cpf, email, role, senhaHash }) {

    //executa a consulta SQL para atualizar o usuário
    const resultado = await db.query(`
        UPDATE usuario
        SET
            nome = COALESCE($1, nome),
            cpf = COALESCE($2, cpf),
            email = COALESCE($3, email),
            role = COALESCE($4, role),
            senha = COALESCE($5, senha)
        WHERE id = $6
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING
            id,
            nome,
            email,
            cpf,
            role,
            is_master,
            mfa_ativo,
            dt_cadastro`,
        [
            nome ?? null,
            cpf ?? null,
            email ?? null,
            role ?? null,
            senhaHash ?? null,
            id
        ]
    );

    //retorna o usuário atualizado
    return resultado.rows[0];
}
//#endregion

//#region => Queries para trocar a senha do próprio usuário
//busca só o hash da senha atual do usuário logado (nunca sai daqui para o front)
async function buscarSenhaHashRepository(db, id) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        SELECT id, senha
        FROM usuario
        WHERE id = $1
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        LIMIT 1`, [id]
    );

    //retorna o usuário com o hash ou undefined
    return resultado.rows[0];
}

//grava o novo hash da senha do próprio usuário
async function atualizarSenhaRepository(db, id, senhaHash) {

    //executa a consulta SQL filtrando pela família
    const resultado = await db.query(`
        UPDATE usuario
        SET senha = $1
        WHERE id = $2
        AND id_familia = current_setting('app.current_familia_id', true)::uuid
        RETURNING id`, [senhaHash, id]
    );

    //retorna o id atualizado ou undefined
    return resultado.rows[0];
}
//#endregion

//#region => exportação das funções
export {
    buscarFamiliaAtualRepository,
    listarUsuariosRepository,
    buscarUsuarioPorIdRepository,
    buscarPapelRepository,
    criarUsuarioRepository,
    atualizarUsuarioRepository,
    buscarSenhaHashRepository,
    atualizarSenhaRepository
}
//#endregion
