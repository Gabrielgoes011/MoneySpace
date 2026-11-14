// ========================================
// ROTAS: FAMÍLIAS (gestão do dono do app)
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.
// Listar e cadastrar são só do dono do app (is_master), conferido no banco.

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../../middleware/rlsMiddleware.js';
import {
  verificarAcessoMaster,
  listarFamilias,
  cadastrarFamilia
} from './cadFamilia.controller.js';

const router = Router();

// Diz se quem está logado é o dono do app (qualquer usuário logado pode perguntar)
router.get('/familias/acesso', verificaToken, rlsMiddleware, verificarAcessoMaster);
//resposta: { master }

// Lista todas as famílias com totais (só dono do app)
router.get('/familias', verificaToken, rlsMiddleware, listarFamilias);
//resposta: { familias: [{ id, nome, dt_cadastro, total_usuarios, total_cartoes }] }

// Cadastra uma família e o primeiro administrador dela (só dono do app)
router.post('/familias/cadastrar', verificaToken, rlsMiddleware, cadastrarFamilia);
//body: { nome, adminNome, adminCpf, adminEmail, adminSenha }

export default router;
