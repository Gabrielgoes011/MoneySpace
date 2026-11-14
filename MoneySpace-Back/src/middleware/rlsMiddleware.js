// ========================================
// MIDDLEWARE: ROW LEVEL SECURITY (RLS)
// ========================================
// Abre uma transação por request e grava o contexto de RLS no PostgreSQL:
//   - app.current_familia_id: família que as policies usam para filtrar as linhas
//   - app.current_user_id: quem está logado (as funções de master e a policy da própria linha leem isto)
// Confirma (COMMIT) em respostas 2xx/3xx e desfaz (ROLLBACK) no resto.
//
// FAMÍLIA ATIVA (só dono do app): o header `x-familia-ativa` faz o master operar dentro de OUTRA família.
// O banco confere se quem pediu é master (fn_master_eh_master). Quem não é master recebe 403.
// Sem `id_familia` no token (ex.: refresh token usado como acesso) a requisição é recusada (401):
// nunca segue sem o contexto de RLS.

import { pool, dbContext } from '../config/configDb.js';
import httpResponse from '../utils/httpResponse.js';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function rlsMiddleware(req, res, next) {
  // Pega a família do usuário autenticado (UUID) para aplicar o contexto de RLS.
  // É `id_familia` que as policies do banco usam (app.current_familia_id).
  const familiaId = req.user?.id_familia ?? null;
  const usuarioId = req.user?.id ?? null;

  // Sem família (ou sem usuário) no token não há contexto de RLS: recusa em vez de seguir sem proteção.
  if (!familiaId || !usuarioId) {
    return httpResponse.unauthorized(res, 'Sessão inválida. Faça login novamente.');
  }

  let client;
  let finalized = false;

  // Finaliza a transação do request, confirmando ou descartando a operação conforme o status HTTP.
  const finalizeTransaction = async (action = 'commit') => {

    // Se a transação já foi finalizada ou não há cliente, não faz nada.
    if (finalized || !client) {
      return;
    }

    finalized = true;

    // Se a transação falhar ao finalizar, apenas loga o erro, mas não impede a resposta do request.
    try {
      if (action === 'commit') {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
    } catch (error) {
      console.error('❌ Falha ao finalizar a transação do RLS:', error.message);
    } finally {
      client.release();
    }
  };

  // Tenta criar uma transação e aplicar o contexto de RLS para o usuário autenticado.
  try {
    // O PostgreSQL não aceita bind params em SET LOCAL. Como os ids são UUIDs, validamos o formato
    // e usamos set_config com parâmetro para evitar injeção (set_config aceita bind, diferente de SET LOCAL).
    if (!REGEX_UUID.test(String(familiaId)) || !REGEX_UUID.test(String(usuarioId))) {
      throw new Error('id inválido para o contexto de RLS');
    }

    client = await pool.connect();
    req.db = client;

    // Inicia uma transação para garantir que o contexto de RLS seja aplicado apenas durante a execução do request.
    await client.query('BEGIN');

    await client.query(`SELECT set_config('app.current_familia_id', $1, true)`, [familiaId]);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [usuarioId]);

    // Família ativa: só o dono do app pode operar dentro de outra família.
    let familiaDoContexto = familiaId;
    const familiaAtivaPedida = String(req.headers['x-familia-ativa'] ?? '').trim();

    if (familiaAtivaPedida && familiaAtivaPedida.toLowerCase() !== String(familiaId).toLowerCase()) {
      // Desfaz a transação e devolve a conexão antes de responder (o request não segue adiante).
      const recusar = async (resposta) => {
        finalized = true;
        await client.query('ROLLBACK').catch(() => { });
        client.release();
        return resposta;
      };

      if (!REGEX_UUID.test(familiaAtivaPedida)) {
        return recusar(httpResponse.validationError(res, 'Família ativa inválida.'));
      }

      // O banco decide quem é master (nunca o token nem o front).
      const resultadoMaster = await client.query(`SELECT fn_master_eh_master() AS master`);
      if (resultadoMaster.rows[0].master !== true) {
        return recusar(httpResponse.forbidden(res, 'Apenas o dono do app pode trocar de família.'));
      }

      // Troca o contexto e confirma que a família existe (a policy só deixa ver a família do contexto).
      await client.query(`SELECT set_config('app.current_familia_id', $1, true)`, [familiaAtivaPedida]);
      const familiaEncontrada = await client.query(
        `SELECT a.id FROM familia a WHERE a.id = current_setting('app.current_familia_id', true)::uuid`
      );
      if (familiaEncontrada.rowCount === 0) {
        return recusar(httpResponse.notFound(res, 'Família não encontrada.'));
      }

      familiaDoContexto = familiaAtivaPedida;
    }

    // Usa o dbContext para disponibilizar o client e a família para qualquer função que precise acessar o banco durante o request.
    dbContext.run({ client, familiaId: familiaDoContexto }, () => {
      res.once('finish', () => {
        const shouldCommit = res.statusCode >= 200 && res.statusCode < 400;
        finalizeTransaction(shouldCommit ? 'commit' : 'rollback');
      });

      // Garante que a transação seja finalizada mesmo que o request seja encerrado abruptamente.
      res.once('close', () => {
        const shouldCommit = res.statusCode >= 200 && res.statusCode < 400;
        finalizeTransaction(shouldCommit ? 'commit' : 'rollback');
      });

      next();
    });
  } catch (error) {
    if (client && !finalized) {
      finalized = true;
      await client.query('ROLLBACK').catch(() => { });
      client.release();
    }

    // Loga o erro e retorna uma resposta de erro genérica para o cliente.
    next(error);
  }
}

export { dbContext };
