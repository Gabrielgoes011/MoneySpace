// ========================================
// SERVIÇO DE FATURAS / RESERVA (API)
// ========================================
// Fala com os endpoints de fatura do backend (módulo controle-fatura-reserva).
// Contrato oficial: design.md -> "## Contrato de API". Todas as rotas ficam sob
// /api (o api.js já usa baseURL /api), então aqui os caminhos vão SEM o /api:
//   GET    /faturas?id_conta=:id              -> { data: { faturas: [...] } }
//   POST   /faturas                           -> { data: { fatura } }
//   GET    /faturas/:id                       -> { data: { fatura, resumo } }
//   GET    /faturas/:id/dashboard             -> { data: { fatura, resumo, por_portador, por_categoria } }
//   PATCH  /faturas/:id/reserva               -> { data: { fatura } }
//   POST   /faturas/:id/importacoes/preview   -> { data: { hash, linhas_validas, erros } }
//   POST   /faturas/:id/importacoes           -> { data: { importacao } }
//   GET    /faturas/:id/transacoes            -> { data: { transacoes, total, page, page_size } }
//   PATCH  /faturas/:id/transacoes/:id_tx     -> { data: { transacao } }
//   POST   /faturas/:id/fechamento            -> { data: { ... } }
//
// Todas as chamadas passam pelo axios central (src/services/api.js), que injeta
// o JWT no Authorization e usa o proxy /api -> backend. Erros sobem para a tela
// tratar com toast (sem fallback de mock: a tela mostra o estado real da API).
// Cada método é de propósito único; não há fetch paralelo aqui — quem chama
// decide como orquestrar.

import api from './api';

// GET /faturas?id_conta=:id — lista os cabeçalhos de fatura do cartão.
export async function listarFaturas(idConta) {
  const { data } = await api.get('/faturas', { params: { id_conta: idConta } });
  return data?.data?.faturas ?? [];
}

// POST /faturas — cria uma competência vazia { id_conta, competencia }.
export async function criarFatura(payload) {
  const { data } = await api.post('/faturas', payload);
  return data?.data?.fatura;
}

// GET /faturas/:id — cabeçalho + resumo calculado.
export async function obterFatura(idFatura) {
  const { data } = await api.get(`/faturas/${idFatura}`);
  return data?.data;
}

// GET /faturas/:id/dashboard — KPIs + reserva + totais por portador e categoria.
export async function obterDashboard(idFatura) {
  const { data } = await api.get(`/faturas/${idFatura}/dashboard`);
  return data?.data;
}

// PATCH /faturas/:id/reserva — atualiza o saldo de reserva declarado.
export async function atualizarReserva(idFatura, saldo) {
  const { data } = await api.patch(`/faturas/${idFatura}/reserva`, {
    saldo_reserva_declarado: saldo,
  });
  return data?.data?.fatura;
}

// POST /faturas/:id/importacoes/preview — prévia do CSV (sem persistir).
// Multipart: campo "arquivo". O axios define o boundary a partir do FormData.
export async function previewImportacao(idFatura, file) {
  const form = new FormData();
  form.append('arquivo', file);
  const { data } = await api.post(`/faturas/${idFatura}/importacoes/preview`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.data;
}

// POST /faturas/:id/importacoes — confirma a importação (atômica, idempotente).
export async function confirmarImportacao(idFatura, file) {
  const form = new FormData();
  form.append('arquivo', file);
  const { data } = await api.post(`/faturas/${idFatura}/importacoes`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.data?.importacao;
}

// GET /faturas/:id/transacoes — lista com filtros/busca/sort/paginação.
// Monta os query params a partir de `filtros`, omitindo vazios/undefined.
export async function listarTransacoes(idFatura, filtros = {}) {
  const { status, portador, categoria, busca, sort, page, page_size } = filtros;
  const params = {};
  if (status !== undefined && status !== '') params.status = status;
  if (portador !== undefined && portador !== '') params.portador = portador;
  if (categoria !== undefined && categoria !== '') params.categoria = categoria;
  if (busca !== undefined && busca !== '') params.busca = busca;
  if (sort !== undefined && sort !== '') params.sort = sort;
  if (page !== undefined && page !== '') params.page = page;
  if (page_size !== undefined && page_size !== '') params.page_size = page_size;

  const { data } = await api.get(`/faturas/${idFatura}/transacoes`, { params });
  return data?.data;
}

// PATCH /faturas/:id/transacoes/:id_transacao — atualiza categoria, portador
// e/ou status_liquidacao de um lançamento.
export async function atualizarTransacao(idFatura, idTransacao, payload) {
  const { data } = await api.patch(
    `/faturas/${idFatura}/transacoes/${idTransacao}`,
    payload
  );
  return data?.data?.transacao;
}

// POST /faturas/:id/fechamento — fecha a competência e abre a próxima.
export async function fecharFatura(idFatura) {
  const { data } = await api.post(`/faturas/${idFatura}/fechamento`);
  return data?.data;
}
