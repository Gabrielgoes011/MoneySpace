// ========================================
// ROTAS: FATURA (cabeçalho + lançamentos)
// ========================================
// Ordem obrigatória: verificaToken -> rlsMiddleware (precisa do req.user) -> controller.

import { Router } from 'express';
import verificaToken from '../../middleware/auth/verificaToken.js';
import { rlsMiddleware } from '../../middleware/rlsMiddleware.js';
import {
  listarFaturasCartao,
  editarLancamento,
  excluirLancamento,
  buscarFatura,
  criarFatura,
  definirSaldoFatura,
  fecharFatura,
  abrirFatura,
  cadastrarLancamento,
  alterarStatusLancamento
} from './fatura.controller.js';

const router = Router();

// Lista as faturas do cartão (alimenta o seletor de competência)
router.get('/faturas/listar', verificaToken, rlsMiddleware, listarFaturasCartao);
//query: cartaoId=<uuid>

// Busca a fatura do cartão no mês (com os lançamentos)
router.get('/faturas', verificaToken, rlsMiddleware, buscarFatura);
//query: cartaoId=<uuid>, competencia=AAAA-MM

// Cria a fatura do cartão no mês (fechamento e vencimento saem dos dias do cartão)
router.post('/faturas/cadastrar', verificaToken, rlsMiddleware, criarFatura);
//body: { cartaoId, competencia }

// Salva o saldo da reserva da fatura (só se estiver aberta)
router.post('/faturas/saldo/:id', verificaToken, rlsMiddleware, definirSaldoFatura);
//params: id da fatura
//body: { saldo }

// Fecha a fatura (depois disso não aceita mais alteração)
router.post('/faturas/fechar/:id', verificaToken, rlsMiddleware, fecharFatura);
//params: id da fatura

// Reabre a fatura fechada para ajustes (lançar, editar, excluir, trocar status)
router.post('/faturas/abrir/:id', verificaToken, rlsMiddleware, abrirFatura);
//params: id da fatura

// Lança um gasto manualmente na fatura aberta
router.post('/faturas/lancamentos/cadastrar', verificaToken, rlsMiddleware, cadastrarLancamento);
//body: { idFatura, dataCompra (AAAA-MM-DD), estabelecimento, valor, idUsuario?, categoria?, parcela?, statusTransacao? }

// Edita um lançamento (só se a fatura estiver aberta). Campo não enviado fica como está.
router.post('/faturas/lancamentos/editar/:id', verificaToken, rlsMiddleware, editarLancamento);
//params: id do lançamento
//body: { dataCompra?, estabelecimento?, valor?, idUsuario?, categoria?, parcela?, statusTransacao? }

// Apaga um lançamento (só se a fatura estiver aberta)
router.post('/faturas/lancamentos/deletar/:id', verificaToken, rlsMiddleware, excluirLancamento);
//params: id do lançamento

// Troca o status de um lançamento (só se a fatura estiver aberta)
router.post('/faturas/lancamentos/status/:id', verificaToken, rlsMiddleware, alterarStatusLancamento);
//params: id do lançamento
//body: { statusTransacao: 'pendente' | 'na hora' | 'no fechamento' | 'nao aplicavel' }

export default router;
