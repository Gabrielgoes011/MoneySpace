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
import {
  listarContasController,
  criarContaController,
  atualizarContaController,
  arquivarContaController,
} from './conta.controller.js';

const router = Router();

router.get('/contas', verificaToken, listarContasController);
router.post('/contas', verificaToken, criarContaController);
router.put('/contas/:id', verificaToken, atualizarContaController);
router.delete('/contas/:id', verificaToken, arquivarContaController);

export default router;
