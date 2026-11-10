// ========================================
// ROTAS: CADASTRO DE CARTÕES
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../../middleware/rlsMiddleware.js';
import {
  listarCartoes,
  criarCartao,
  excluirCartao
} from './cadCartao.controller.js';

const router = Router();

// Rotas para cartões da família
router.get('/cartoes', verificaToken, rlsMiddleware, listarCartoes);
//resposta: { cartoes, pode_cadastrar }

router.post('/cartoes/cadastrar', verificaToken, rlsMiddleware, criarCartao);
//body: { nome, final, idUsuario, limite?, diaFechamento?, diaVencimento?, principal? } (só ADMIN da família)

router.post('/cartoes/deletar/:id', verificaToken, rlsMiddleware, excluirCartao);
//params: id do cartão a excluir (só ADMIN da família; só se não tiver lançamento)

export default router;
