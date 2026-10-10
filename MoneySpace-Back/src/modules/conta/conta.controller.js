// ========================================
// CONTROLLER: CONTA
// ========================================
// Lida com req/res e status HTTP. SEM SQL. Usa httpResponse para padronizar
// a saída e pgErrorHandler para traduzir erros do Postgres no catch.
//
// Contrato de API esperado pelo frontend (src/services/contaService.js):
//   GET    /contas        -> { success, data: { contas: [...] } }
//   POST   /contas        body: { nome, tipo, saldo_inicial?, bandeira?,
//                                 final_cartao?, limite?, dia_fechamento?, dia_vencimento? }
//                         -> { success, data: { conta } }
//   PUT    /contas/:id    body: idem POST (campos a atualizar)
//                         -> { success, data: { conta } }
//   DELETE /contas/:id    -> arquiva (soft delete) -> { success }
//
// Padrão de resposta/erro (seguir o módulo de login):
//   return httpResponse.success(res, 'mensagem', data, 200);
//   no catch: const msg = error?.code ? pgErrorHandler(error, fallback) : error.message;

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler from '../../utils/pgErrorHandler.js';
import {
  listarContasService,
  criarContaService,
  atualizarContaService,
  arquivarContaService,
} from './conta.service.js';

// implementar: GET /contas -> lista as contas da família.
async function listarContasController(req, res) {
  try {

    //chama o service para listar as contas (req.db = transação com contexto RLS)
    const contas = await listarContasService(req.db);

    //rertona para o front
    return httpResponse.success
      (res, 'Contas listadas com sucesso', { contas }, 200);

  } catch (error) {

    //console.log para debug, caso o pgErrorHandler não consiga tratar o erro
    console.log('Erro ao listar contas na etapa de controller:', error);

    //trata o erro do postgres e retorna para o front
    return httpResponse.error 
      (res, pgErrorHandler(error), 500);
  }
}

// POST /contas -> cria uma conta para a família do usuário logado.
async function criarContaController(req, res) {
  try {
    // usuario_cadastro = nome de quem lançou (snapshot, evita JOIN).
    const conta = await criarContaService(req.db, req.body, {
      usuario_cadastro: req.user?.nome,
    });

    return httpResponse.success(res, 'Conta criada com sucesso', { conta }, 201);
  } catch (error) {
    console.log('Erro ao criar conta na etapa de controller:', error);
    // Regra de negócio (sem .code) usa a própria mensagem; erro do Postgres é traduzido.
    const msg = error?.code ? pgErrorHandler(error) : error.message;
    const status = error?.code ? 500 : 400;
    return httpResponse.error(res, msg, status);
  }
}

// PUT /contas/:id -> atualiza uma conta existente.
async function atualizarContaController(req, res) {
  try {
    const { id } = req.params;

    const conta = await atualizarContaService(req.db, id, req.body, {
      usuario_cadastro: req.user?.nome,
    });

    return httpResponse.success(res, 'Conta atualizada com sucesso', { conta }, 200);
  } catch (error) {
    console.log('Erro ao atualizar conta na etapa de controller:', error);

    if (error.message === 'Conta não encontrada.') {
      return httpResponse.notFound(res, error.message);
    }
    const msg = error?.code ? pgErrorHandler(error) : error.message;
    const status = error?.code ? 500 : 400;
    return httpResponse.error(res, msg, status);
  }
}

// DELETE /contas/:id -> arquiva (soft delete): mantém o histórico.
async function arquivarContaController(req, res) {
  try {
    const { id } = req.params;

    await arquivarContaService(req.db, id);

    return httpResponse.success(res, 'Conta arquivada com sucesso', null, 200);
  } catch (error) {
    console.log('Erro ao arquivar conta na etapa de controller:', error);

    if (error.message === 'Conta não encontrada.') {
      return httpResponse.notFound(res, error.message);
    }
    const msg = error?.code ? pgErrorHandler(error) : error.message;
    const status = error?.code ? 500 : 400;
    return httpResponse.error(res, msg, status);
  }
}

export {
  listarContasController,
  criarContaController,
  atualizarContaController,
  arquivarContaController,
};
