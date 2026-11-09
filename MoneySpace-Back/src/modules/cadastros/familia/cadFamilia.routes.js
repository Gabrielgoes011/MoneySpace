// ========================================
// ROTAS: FAMÍLIA
// ========================================
//   GET  /familias        lista as famílias
//   POST /familias        cria família            body: { nome }
//   PUT  /familias/:id     atualiza o nome         body: { nome }

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import {
  listarFamiliasController,
  criarFamiliaController,
  atualizarFamiliaController,
} from './cadFamilia.controller.js';

const router = Router();

router.get('/familias', verificaToken, listarFamiliasController);
router.post('/familias', verificaToken, criarFamiliaController);
router.put('/familias/:id', verificaToken, atualizarFamiliaController);

export default router;
