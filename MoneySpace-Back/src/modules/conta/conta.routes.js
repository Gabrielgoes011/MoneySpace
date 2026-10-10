// ========================================
// ROTAS: CONTA
// ========================================
// Todas as rotas de conta exigem usuário autenticado (verificaToken injeta
// req.user, e o rlsMiddleware usa req.user.id_familia para o contexto de RLS).
//
// Endpoints (ver contrato no controller):
//   GET    /contas
//   POST   /contas
//   PUT    /contas/:id
//   DELETE /contas/:id   (arquivar / soft delete)

import { Router } from 'express';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../middleware/rlsMiddleware.js';
import {
  listarContasController,
  criarContaController,
  atualizarContaController,
  arquivarContaController,
} from './conta.controller.js';

const router = Router();

// Ordem: valida o token (define req.user) -> abre a transação RLS (usa
// req.user.id_familia e anexa req.db) -> controller. O rlsMiddleware precisa
// vir DEPOIS do verificaToken, senão req.user ainda não existe.
router.get('/contas', verificaToken, rlsMiddleware, listarContasController);
router.post('/contas', verificaToken, rlsMiddleware, criarContaController);
router.put('/contas/:id', verificaToken, rlsMiddleware, atualizarContaController);
router.delete('/contas/:id', verificaToken, rlsMiddleware, arquivarContaController);

export default router;
