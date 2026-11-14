// ========================================
// REPOSITORY: LOGIN / AUTENTICAÇÃO
// ========================================
// Camada de acesso ao banco. Toda query do módulo de login mora aqui.
// O login roda ANTES de existir contexto de família (RLS), então não lê a tabela
// `usuario` direto: o role da aplicação (app_moneyspace) não enxerga nada sem contexto.
// As consultas passam por 3 funções SECURITY DEFINER criadas na migration 006:
//   - fn_login_buscar_por_email: traz o usuário com hash da senha e campos de 2FA
//   - fn_login_buscar_por_id: igual, mas SEM a senha
//   - fn_login_atualizar_2fa: grava segredo e/ou liga-desliga do 2FA
// `id_familia` é essencial: vai no token e alimenta o RLS por request.

import { openDb } from '../../config/configDb.js';

//#region => queries para login
//busca o usuário pelo e-mail (traz o hash da senha, a validação acontece no controller)
async function findUserByEmail(email) {
    const db = await openDb();

    //executa a função de login (já devolve o nome da família)
    const result = await db.query(`
        SELECT
            a.id,
            a.id_familia,
            a.nome,
            a.email,
            a.senha,
            a.mfa_secreto,
            a.mfa_ativo,
            a.familia_nome
        FROM fn_login_buscar_por_email($1) a
    `, [email]);

    //retorna um registro ou undefined
    return result.rows[0];
}

//busca o usuário pelo id (usado no /me, no refresh e no 2FA). Não traz a senha.
async function findUserById(userId) {
    const db = await openDb();

    //executa a função de login por id
    const result = await db.query(`
        SELECT
            a.id,
            a.id_familia,
            a.nome,
            a.email,
            a.mfa_secreto,
            a.mfa_ativo,
            a.familia_nome
        FROM fn_login_buscar_por_id($1) a
    `, [userId]);

    //retorna um registro ou undefined
    return result.rows[0];
}
//#endregion

//#region => queries para 2FA
//atualiza o segredo e/ou o liga-desliga do 2FA. Campo não informado (undefined) fica como está.
async function updateUser2fa(userId, updates) {
    const db = await openDb();

    //1º passo: precisa de pelo menos uma alteração
    if (updates.mfa_secreto === undefined && updates.mfa_ativo === undefined) {
        throw new Error('Nenhuma atualização de 2FA fornecida.');
    }

    //2º passo: a função precisa saber se o segredo deve mudar (permite gravar NULL ao desativar)
    const alterarSegredo = updates.mfa_secreto !== undefined;

    //3º passo: executa a função de atualização
    await db.query(`
        SELECT fn_login_atualizar_2fa($1::uuid, $2::boolean, $3::text, $4::boolean)
    `, [userId, alterarSegredo, updates.mfa_secreto ?? null, updates.mfa_ativo ?? null]);
}
//#endregion

//#region => exportação das funções
export {
    findUserByEmail,
    findUserById,
    updateUser2fa,
};
//#endregion
