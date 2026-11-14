// ========================================
// ROTAS: RATEIO (compra rachada entre pessoas)
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../middleware/rlsMiddleware.js';
import {
  buscarRateio,
  cadastrarParte,
  editarParte,
  excluirParte,
  registrarPagamento,
  excluirPagamento,
  definirAbsorcao
} from './rateio.controller.js';

const router = Router();

// Rateio de um lançamento: partes, pagamentos, totais e nomes já usados
router.get('/rateio', verificaToken, rlsMiddleware, buscarRateio);
//query: lancamentoId=<uuid>

// Inclui a parte de uma pessoa (nome novo é cadastrado na hora)
router.post('/rateio/partes/cadastrar', verificaToken, rlsMiddleware, cadastrarParte);
//body: { idLancamento, nome, valor }

// Muda o valor previsto de uma parte
router.post('/rateio/partes/editar/:id', verificaToken, rlsMiddleware, editarParte);
//params: id da parte
//body: { valor }

// Remove uma parte (só sem pagamentos)
router.post('/rateio/partes/deletar/:id', verificaToken, rlsMiddleware, excluirParte);
//params: id da parte

// Registra um pagamento recebido de uma parte (pode ser em várias vezes e passar do previsto)
router.post('/rateio/partes/pagar/:id', verificaToken, rlsMiddleware, registrarPagamento);
//params: id da parte
//body: { valor, dataPagamento? (AAAA-MM-DD; sem data = hoje) }

// Quem adiantou a compra absorve o que falta da parte (ou desfaz a absorção)
router.post('/rateio/partes/absorver/:id', verificaToken, rlsMiddleware, definirAbsorcao);
//params: id da parte
//body: { absorvido? } (sem o campo = true)

// Apaga um pagamento lançado por engano
router.post('/rateio/pagamentos/deletar/:id', verificaToken, rlsMiddleware, excluirPagamento);
//params: id do pagamento

export default router;
