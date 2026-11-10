// ========================================
// ROTAS: DASHBOARD (início)
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../middleware/rlsMiddleware.js';
import { buscarDashboard } from './dashboard.controller.js';

const router = Router();

// Painel inicial (só leitura)
router.get('/dashboard', verificaToken, rlsMiddleware, buscarDashboard);
//query: competencia=AAAA-MM (padrão = mês atual), cartaoId=<uuid> ou todos (padrão)

export default router;
