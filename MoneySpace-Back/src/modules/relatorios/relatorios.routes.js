// ========================================
// ROTAS: RELATÓRIOS
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../middleware/rlsMiddleware.js';
import { relatorioFatura, relatorioSemanal, relatorioPendencias } from './relatorios.controller.js';

const router = Router();

// Relatório geral de uma fatura (para PDF e compartilhar)
router.get('/relatorios/fatura', verificaToken, rlsMiddleware, relatorioFatura);
//query: faturaId=<uuid>

// Valor gasto por semana (segunda a domingo) e detalhes por categoria
router.get('/relatorios/semanal', verificaToken, rlsMiddleware, relatorioSemanal);
//query: faturaId=<uuid>

// O que ainda falta pagar na fatura (lançamentos pendentes, por pessoa)
router.get('/relatorios/pendencias', verificaToken, rlsMiddleware, relatorioPendencias);
//query: faturaId=<uuid>

export default router;
