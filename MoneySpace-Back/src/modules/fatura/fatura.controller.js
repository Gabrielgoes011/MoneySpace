// ========================================
// CONTROLLER: FATURA
// ========================================
// Lida com req/res e status HTTP. SEM SQL. Usa httpResponse para padronizar a
// saída e pgErrorHandler para traduzir erros do Postgres no catch.
//
// Erros de negócio vêm como ErroNegocio (com .httpStatus 400/404/409); erros do
// Postgres têm .code (traduzidos e 500). Padrão de resposta: { success, message, data }.
//
// Contrato (todas sob /api — ver design.md "## Contrato de API"):
//   GET    /faturas?id_conta=:id
//   POST   /faturas  { id_conta, competencia }
//   GET    /faturas/:id
//   GET    /faturas/:id/dashboard
//   PATCH  /faturas/:id/reserva  { saldo_reserva_declarado }
//   POST   /faturas/:id/importacoes/preview   (multipart, campo 'arquivo')
//   POST   /faturas/:id/importacoes           (multipart, campo 'arquivo')
//   GET    /faturas/:id/transacoes
//   PATCH  /faturas/:id/transacoes/:id_transacao
//   POST   /faturas/:id/fechamento

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler from '../../utils/pgErrorHandler.js';
import {
  listarFaturasService,
  criarFaturaService,
  obterFaturaService,
  obterDashboardService,
  atualizarReservaService,
  gerarPreview,
  confirmarImportacao,
  listarTransacoesService,
  atualizarTransacaoService,
  fecharFaturaService,
} from './fatura.service.js';

// Traduz o erro para resposta HTTP padronizada.
// - Postgres (.code): 500 + mensagem traduzida (não vaza schema);
// - negócio (.httpStatus): usa o status definido no service (400/404/409);
// - fallback: 400 com a própria mensagem.
function responderErro(res, error) {
  if (error?.code) {
    return httpResponse.error(res, pgErrorHandler(error), 500);
  }
  const status = Number.isInteger(error?.httpStatus) ? error.httpStatus : 400;
  if (status === 404) return httpResponse.notFound(res, error.message);
  if (status === 409) return httpResponse.conflict(res, error.message);
  return httpResponse.error(res, error.message, status);
}

// GET /faturas?id_conta=:id
async function listarFaturasController(req, res) {
  try {
    const { id_conta } = req.query;
    const faturas = await listarFaturasService(req.db, id_conta);
    return httpResponse.success(res, 'Faturas listadas com sucesso', { faturas }, 200);
  } catch (error) {
    console.log('Erro ao listar faturas:', error);
    return responderErro(res, error);
  }
}

// POST /faturas
async function criarFaturaController(req, res) {
  try {
    const fatura = await criarFaturaService(req.db, req.body, {
      usuario_cadastro: req.user?.nome,
    });
    return httpResponse.success(res, 'Fatura criada com sucesso', { fatura }, 201);
  } catch (error) {
    console.log('Erro ao criar fatura:', error);
    return responderErro(res, error);
  }
}

// GET /faturas/:id
async function obterFaturaController(req, res) {
  try {
    const data = await obterFaturaService(req.db, req.params.id);
    return httpResponse.success(res, 'Fatura obtida com sucesso', data, 200);
  } catch (error) {
    console.log('Erro ao obter fatura:', error);
    return responderErro(res, error);
  }
}

// GET /faturas/:id/dashboard
async function obterDashboardController(req, res) {
  try {
    const data = await obterDashboardService(req.db, req.params.id);
    return httpResponse.success(res, 'Dashboard da fatura', data, 200);
  } catch (error) {
    console.log('Erro ao obter dashboard da fatura:', error);
    return responderErro(res, error);
  }
}

// PATCH /faturas/:id/reserva
async function atualizarReservaController(req, res) {
  try {
    const fatura = await atualizarReservaService(
      req.db,
      req.params.id,
      req.body?.saldo_reserva_declarado
    );
    return httpResponse.success(res, 'Reserva atualizada com sucesso', { fatura }, 200);
  } catch (error) {
    console.log('Erro ao atualizar reserva:', error);
    return responderErro(res, error);
  }
}

// POST /faturas/:id/importacoes/preview (multipart; req.file do multer)
async function previewImportacaoController(req, res) {
  try {
    const buffer = req.file?.buffer;
    const preview = await gerarPreview(req.db, req.params.id, buffer);
    return httpResponse.success(res, 'Prévia gerada com sucesso', preview, 200);
  } catch (error) {
    console.log('Erro ao gerar prévia de importação:', error);
    return responderErro(res, error);
  }
}

// POST /faturas/:id/importacoes (multipart; req.file do multer)
async function confirmarImportacaoController(req, res) {
  try {
    const buffer = req.file?.buffer;
    const nomeArquivo = req.file?.originalname;
    const data = await confirmarImportacao(
      req.db,
      req.params.id,
      buffer,
      req.user?.nome,
      nomeArquivo
    );
    return httpResponse.success(res, 'Importação concluída com sucesso', data, 201);
  } catch (error) {
    console.log('Erro ao confirmar importação:', error);
    return responderErro(res, error);
  }
}

// GET /faturas/:id/transacoes
async function listarTransacoesController(req, res) {
  try {
    const data = await listarTransacoesService(req.db, req.params.id, req.query);
    return httpResponse.success(res, 'Transações listadas com sucesso', data, 200);
  } catch (error) {
    console.log('Erro ao listar transações da fatura:', error);
    return responderErro(res, error);
  }
}

// PATCH /faturas/:id/transacoes/:id_transacao
async function atualizarTransacaoController(req, res) {
  try {
    const transacao = await atualizarTransacaoService(
      req.db,
      req.params.id,
      req.params.id_transacao,
      req.body
    );
    return httpResponse.success(res, 'Transação atualizada com sucesso', { transacao }, 200);
  } catch (error) {
    console.log('Erro ao atualizar transação da fatura:', error);
    return responderErro(res, error);
  }
}

// POST /faturas/:id/fechamento
async function fecharFaturaController(req, res) {
  try {
    // fechada_por é UUID de usuário -> passa req.user.id (não o nome).
    const data = await fecharFaturaService(req.db, req.params.id, req.user?.id);
    return httpResponse.success(res, 'Fatura fechada com sucesso', data, 200);
  } catch (error) {
    console.log('Erro ao fechar fatura:', error);
    return responderErro(res, error);
  }
}

export {
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
};
