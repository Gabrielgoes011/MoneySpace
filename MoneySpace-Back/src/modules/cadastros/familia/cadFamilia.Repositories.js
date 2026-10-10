import { openDb } from '../../../config/configDb.js';

//#region => Queries para familia

// implementar: listar todas as famílias (SELECT id, nome FROM familia ...)
async function listarFamilias() {
    // implementar: query de listagem
    throw new Error('listarFamilias ainda não implementada.');
}

// implementar: atualizar nome/dados da família por id
// (UPDATE familia SET nome = $1 WHERE id = $2 RETURNING *)
async function atualizarFamilia(/* id, dados */) {
    // implementar: query de atualização
    throw new Error('atualizarFamilia ainda não implementada.');
}

async function buscarFamiliaPorId() {

    //abre o banco
    const db = await openDb();

    //Select
    const result = await db.query(
        `SELECT id, nome FROM familia `);

    return result.rows;

}

//criar familia
async function criarFamilia() {

    //abre o banco
    const db = await openDb();

    //Select
    const result = await db.query(
        `INSERT INTO familia (nome) VALUES ($1) RETURNING * `,);

    //retorna a familia criada
    return result.rows;
}
//#endregion


export {
    listarFamilias,
    buscarFamiliaPorId,
    criarFamilia,
    atualizarFamilia
};