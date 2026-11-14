// ========================================
// ROTAS: CADASTRO DE USUÁRIOS (da família)
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../../middleware/rlsMiddleware.js';
import { loginLimiter } from '../../../middleware/rateLimiter.js';
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  buscarMinhaConta,
  atualizarMinhaConta,
  trocarMinhaSenha
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

// Dados da conta do próprio usuário logado
router.get('/usuarios/minha-conta', verificaToken, rlsMiddleware, buscarMinhaConta);
//resposta: { usuario }

router.post('/usuarios/minha-conta', verificaToken, rlsMiddleware, atualizarMinhaConta);
//body: { nome, email, cpf }

// Troca a senha do próprio usuário logado (limitado: conta tentativas erradas da senha atual)
router.post('/usuarios/trocar-senha', verificaToken, rlsMiddleware, loginLimiter, trocarMinhaSenha);
//body: { senhaAtual, senhaNova } (senhaNova com no mínimo 8 caracteres)

export default router;
