// ========================================
// ROTAS: CADASTRO DE USUÁRIOS (da família)
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../../middleware/rlsMiddleware.js';
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario
} from './cadUsuario.controller.js';

const router = Router();

// Rotas para usuários da família
router.get('/usuarios', verificaToken, rlsMiddleware, listarUsuarios);
//resposta: { familia, usuarios, pode_editar }

router.post('/usuarios', verificaToken, rlsMiddleware, criarUsuario);
//body: { nome, cpf, email, senha, role } (só ADMIN)

router.post('/usuarios/editar/:id', verificaToken, rlsMiddleware, atualizarUsuario);
//params: id do usuário a ser editado
//body: { nome?, cpf?, email?, role?, senha? } (só ADMIN)

export default router;
