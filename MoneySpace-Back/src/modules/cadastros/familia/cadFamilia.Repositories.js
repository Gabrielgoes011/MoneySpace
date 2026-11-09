// ========================================
// REPOSITORY: FAMÍLIA
// ========================================
// Camada de acesso ao banco. Só queries SQL da tabela `familia`.
// A lógica (validação, orquestração) fica no controller (2 camadas).

import { openDb } from '../../../config/configDb.js';

//#region => Queries para familia

// Lista as famílias (id + nome), mais recentes primeiro.
async function listarFamilias() {
  const db = await openDb();
  const result = await db.query(
    `SELECT id, nome, dt_cadastro FROM familia ORDER BY dt_cadastro DESC`
  );
  return result.rows;
}

// Busca uma família pelo id.
async function buscarFamiliaPorId(id) {
  const db = await openDb();
  const result = await db.query(
    `SELECT id, nome, dt_cadastro FROM familia WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0];
}

// Cria uma família e retorna o registro criado.
async function criarFamilia({ nome }) {
  const db = await openDb();
  const result = await db.query(
    `INSERT INTO familia (nome) VALUES ($1) RETURNING id, nome, dt_cadastro`,
    [nome]
  );
  return result.rows[0];
}

// Atualiza o nome da família por id. Retorna o registro atualizado (ou undefined).
async function atualizarFamilia(id, { nome }) {
  const db = await openDb();
  const result = await db.query(
    `UPDATE familia SET nome = $1 WHERE id = $2 RETURNING id, nome, dt_cadastro`,
    [nome, id]
  );
  return result.rows[0];
}

//#endregion

export {
  listarFamilias,
  buscarFamiliaPorId,
  criarFamilia,
  atualizarFamilia,
};
