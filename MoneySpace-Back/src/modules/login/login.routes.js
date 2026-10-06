// ========================================
// ROTAS: LOGIN / AUTENTICAÇÃO / 2FA
// ========================================
// Liga os endpoints aos controllers do módulo. Rotas que exigem usuário
// autenticado passam pelo verificaToken; as sensíveis têm rate limiting.

import { Router } from 'express';
import {
  loginController,
  login2faController,
  meController,
  refreshController,
  iniciar2faController,
  confirmar2faController,
  desativar2faController,
  validarCodigo2faController,
} from './login.controller.js';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { loginLimiter, twoFactorLimiter, refreshLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// ── Login ─────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, loginController);
router.post('/login/2fa', loginLimiter, login2faController);

// ── Sessão ──────────────────────────────────────────────────────────────────
router.get('/me', verificaToken, meController);
router.post('/auth/refresh', refreshLimiter, refreshController);

// ── 2FA (requer usuário autenticado) ────────────────────────────────────────
router.post('/2fa/iniciar', verificaToken, twoFactorLimiter, iniciar2faController);
router.post('/2fa/confirmar', verificaToken, twoFactorLimiter, confirmar2faController);
router.post('/2fa/desativar', verificaToken, twoFactorLimiter, desativar2faController);
router.post('/2fa/validar', verificaToken, twoFactorLimiter, validarCodigo2faController);

export default router;
