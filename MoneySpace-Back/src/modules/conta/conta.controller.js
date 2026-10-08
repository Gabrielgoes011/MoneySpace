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
  // implementar
}

// implementar: POST /contas -> cria conta. Body em req.body.
async function criarContaController(req, res) {
  // implementar
}

// implementar: PUT /contas/:id -> atualiza conta. id em req.params.id.
async function atualizarContaController(req, res) {
  // implementar
}

// implementar: DELETE /contas/:id -> arquiva (soft delete).
async function arquivarContaController(req, res) {
  // implementar
}

export {
  listarContasController,
  criarContaController,
  atualizarContaController,
  arquivarContaController,
};
