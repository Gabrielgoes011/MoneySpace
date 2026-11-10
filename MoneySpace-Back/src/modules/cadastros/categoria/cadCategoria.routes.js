// ========================================
// ROTAS: CADASTRO DE CATEGORIAS
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../../middleware/rlsMiddleware.js';
import {
  listarCategorias,
  criarCategoria
} from './cadCategoria.controller.js';

const router = Router();

// Rotas para categorias
router.get('/categorias', verificaToken, rlsMiddleware, listarCategorias);
//resposta: { categorias, pode_editar }

router.post('/categorias', verificaToken, rlsMiddleware, criarCategoria);
//body: { valor } (só o dono do app)

export default router;
