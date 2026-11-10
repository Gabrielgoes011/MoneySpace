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
//query: competencia=AAAA-MM (padrão = fatura mais recente do cartão), cartaoId=<uuid> ou todos (padrão = cartão principal)
//resposta: { competencia, cartaoId, competencias, cartoes, resumo, portadores, categorias, semCategoria }

export default router;
