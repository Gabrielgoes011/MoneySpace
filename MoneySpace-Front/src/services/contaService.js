// ========================================
// SERVIÇO DE CONTAS (API)
// ========================================
// Fala com os endpoints de conta do backend:
//   GET    /contas      -> { data: { contas: [...] } }
//   POST   /contas      -> { data: { conta } }
//   PUT    /contas/:id  -> { data: { conta } }
//   DELETE /contas/:id  -> arquiva (soft delete)
//
// Todas as chamadas passam pelo axios central (src/services/api.js), que injeta
// o JWT no Authorization e usa o proxy /api -> backend. Erros sobem para a tela
// tratar com toast (sem fallback de mock: a tela mostra o estado real da API).

import api from './api';

// GET /contas — lista as contas ativas da família.
export async function listarContas() {
  const { data } = await api.get('/contas');
  return data?.data?.contas ?? [];
}

// POST /contas — cria uma conta.
export async function criarConta(dados) {
  const { data } = await api.post('/contas', dados);
  return data?.data?.conta;
}

// PUT /contas/:id — atualiza uma conta.
export async function atualizarConta(id, dados) {
  const { data } = await api.put(`/contas/${id}`, dados);
  return data?.data?.conta;
}

// DELETE /contas/:id — arquiva (soft delete).
export async function arquivarConta(id) {
  await api.delete(`/contas/${id}`);
  return true;
}
