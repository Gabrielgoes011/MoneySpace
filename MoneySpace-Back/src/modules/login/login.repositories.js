// ========================================
// REPOSITORY: LOGIN / AUTENTICAÇÃO
// ========================================
// Camada de acesso ao banco. Toda query do módulo de login mora aqui.
// Mapeada 1:1 com a tabela `usuario` do script.sql do MoneySpace:
//   - senha fica na coluna `senha` (hash bcrypt)
//   - 2FA fica em `mfa_secreto` (segredo cifrado) e `mfa_ativo` (liga/desliga)
//   - `id_familia` é essencial: vai no token e alimenta o RLS por request

import { openDb } from '../../config/configDb.js';

//#region => Queries para login

// Busca o usuário pelo e-mail. Traz tudo que o login precisa, inclusive o hash
// da senha e os campos de 2FA (a validação acontece na camada de service).
async function findUserByEmail(email) {
    const db = await openDb();

    const result = await db.query(
        `SELECT id, id_familia, nome, email, senha, mfa_secreto, mfa_ativo
           FROM usuario
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1`,
        [email]
    );

    return result.rows[0];
}

// Busca o usuário pelo id (usado no /me e no refresh). Não traz a senha.
async function findUserById(userId) {
    const db = await openDb();

    const result = await db.query(
        `SELECT id, id_familia, nome, email, mfa_secreto, mfa_ativo
           FROM usuario
          WHERE id = $1
          LIMIT 1`,
        [userId]
    );

    return result.rows[0];
}

//#endregion

//#region => Queries para 2FA

// Atualiza os campos de 2FA do usuário. Aceita atualizar o segredo e/ou o
// liga-desliga, montando o UPDATE dinamicamente conforme o que foi passado.
async function updateUser2fa(userId, updates) {
    const db = await openDb();

    const fields = [];
    const values = [];
    let index = 1;

    if (updates.mfa_secreto !== undefined) {
        fields.push(`mfa_secreto = $${index++}`);
        values.push(updates.mfa_secreto);
    }
    if (updates.mfa_ativo !== undefined) {
        fields.push(`mfa_ativo = $${index++}`);
        values.push(updates.mfa_ativo);
    }

    if (!fields.length) {
        throw new Error('Nenhuma atualização de 2FA fornecida.');
    }

    values.push(userId);
    await db.query(
        `
        UPDATE usuario 
        SET ${fields.join(', ')} 
        WHERE id = $${index}`,
        values
    );
}

//#endregion

export {
    findUserByEmail,
    findUserById,
    updateUser2fa,
};
