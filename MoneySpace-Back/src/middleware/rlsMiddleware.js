// ========================================
// MIDDLEWARE: ROW LEVEL SECURITY (RLS)
// ========================================
// Abre uma transação por request e injeta o ID do usuário autenticado como
// contexto (`app.current_user_id`) para políticas de RLS no PostgreSQL.
// Confirma (COMMIT) em respostas 2xx/3xx e desfaz (ROLLBACK) no resto.
// Opcional neste template, só entra em ação quando o banco estiver ligado.

import { pool, dbContext } from '../config/configDb.js';

export async function rlsMiddleware(req, res, next) {
  // Pega a família do usuário autenticado (UUID) para aplicar o contexto de RLS.
  // É `id_familia` que as policies do banco usam (app.current_familia_id).
  const familiaId = req.user?.id_familia ?? null;

  // Se não houver usuário autenticado, segue sem criar transação nem contexto de RLS.
  if (!familiaId) {
    return next();
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
    client = await pool.connect();
    req.db = client;

    // Inicia uma transação para garantir que o contexto de RLS seja aplicado apenas durante a execução do request.
    await client.query('BEGIN');

    // O PostgreSQL não aceita bind params em SET LOCAL. Como id_familia é um UUID
    // vindo do JWT, validamos o formato e usamos set_config com parâmetro para
    // evitar injeção (set_config aceita bind, diferente de SET LOCAL).
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(String(familiaId))) {
      throw new Error('id_familia inválido para o contexto de RLS');
    }

    await client.query(`SELECT set_config('app.current_familia_id', $1, true)`, [familiaId]);

    // Usa o dbContext para disponibilizar o client e a família para qualquer função que precise acessar o banco durante o request.
    dbContext.run({ client, familiaId }, () => {
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
    if (client) {
      await client.query('ROLLBACK').catch(() => { });
      client.release();
    }

    // Loga o erro e retorna uma resposta de erro genérica para o cliente.
    next(error);
  }
}

export { dbContext };
