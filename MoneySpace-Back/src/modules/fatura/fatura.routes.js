// ========================================
// ROTAS: FATURA
// ========================================
// Todas as rotas de fatura exigem usuário autenticado. Ordem obrigatória:
//   verificaToken (define req.user) -> rlsMiddleware (usa req.user.id_familia e
//   anexa req.db) -> controller. O rlsMiddleware precisa vir DEPOIS do
//   verificaToken, senão req.user ainda não existe (ver conta.routes.js).
//
// Importação é multipart: uploadCsvSingle('arquivo') roda ENTRE o rlsMiddleware
// e o controller, entregando o CSV em req.file.buffer (memória).
//
// Endpoints (contrato em design.md, todos montados sob /api):
//   GET    /faturas?id_conta=:id
//   POST   /faturas
//   GET    /faturas/:id
//   GET    /faturas/:id/dashboard
//   PATCH  /faturas/:id/reserva
//   POST   /faturas/:id/importacoes/preview   (multipart CSV)
//   POST   /faturas/:id/importacoes           (multipart CSV)
//   GET    /faturas/:id/transacoes
//   PATCH  /faturas/:id/transacoes/:id_transacao
//   POST   /faturas/:id/fechamento

import { Router } from 'express';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../middleware/rlsMiddleware.js';
import { uploadCsvSingle } from '../../middleware/upload.js';
import {
  listarFaturasController,
  criarFaturaController,
  obterFaturaController,
  obterDashboardController,
  atualizarReservaController,
  previewImportacaoController,
  confirmarImportacaoController,
  listarTransacoesController,
  atualizarTransacaoController,
  fecharFaturaController,
} from './fatura.controller.js';

const router = Router();

// Cabeçalho da fatura
router.get('/faturas', verificaToken, rlsMiddleware, listarFaturasController);
router.post('/faturas', verificaToken, rlsMiddleware, criarFaturaController);
router.get('/faturas/:id', verificaToken, rlsMiddleware, obterFaturaController);
router.get('/faturas/:id/dashboard', verificaToken, rlsMiddleware, obterDashboardController);

// Conferência da reserva
router.patch('/faturas/:id/reserva', verificaToken, rlsMiddleware, atualizarReservaController);

// Importação de CSV (multipart). uploadCsvSingle entrega o arquivo em req.file.buffer.
router.post(
  '/faturas/:id/importacoes/preview',
  verificaToken,
  rlsMiddleware,
  uploadCsvSingle('arquivo'),
  previewImportacaoController
);
router.post(
  '/faturas/:id/importacoes',
  verificaToken,
  rlsMiddleware,
  uploadCsvSingle('arquivo'),
  confirmarImportacaoController
);

// Transações da fatura
router.get('/faturas/:id/transacoes', verificaToken, rlsMiddleware, listarTransacoesController);
router.patch(
  '/faturas/:id/transacoes/:id_transacao',
  verificaToken,
  rlsMiddleware,
  atualizarTransacaoController
);

// Fechamento mensal
router.post('/faturas/:id/fechamento', verificaToken, rlsMiddleware, fecharFaturaController);

export default router;
