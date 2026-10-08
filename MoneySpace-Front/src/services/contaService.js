// ========================================
// SERVIÇO DE CONTAS (API)
// ========================================
// Fala com os endpoints de conta do backend (contrato combinado):
//   GET    /contas      -> { data: { contas: [...] } }
//   POST   /contas      -> { data: { conta } }
//   PUT    /contas/:id  -> { data: { conta } }
//   DELETE /contas/:id  -> arquiva
//
// Enquanto o backend está em desenvolvimento, cada chamada tem um fallback:
// se o endpoint ainda não respondeu certo, avisamos via toast (modo DEV) e, no
// caso da listagem, caímos nos mocks para a tela continuar navegável. Quando o
// backend estiver pronto, nada muda aqui — os fallbacks simplesmente param de disparar.

import { toast } from '@heroui/react';
import api from './api';
import { contas as contasMock } from '../mocks/dadosFinanceiros';

// Avisa (uma vez por ação) que o endpoint ainda está em dev. Só em desenvolvimento.
function avisarEndpointEmDev(rota) {
  if (import.meta.env.DEV) {
    toast.warning(`Endpoint ${rota} ainda em desenvolvimento no backend. Usando dados locais.`);
  }
}

// GET /contas — lista as contas da família. Com fallback para mocks em DEV.
export async function listarContas() {
  try {
    const { data } = await api.get('/contas');
    return data?.data?.contas ?? [];
  } catch (erro) {
    avisarEndpointEmDev('GET /contas');
    return contasMock; // fallback para a tela não ficar vazia enquanto o back não existe
  }
}

// POST /contas — cria uma conta.
export async function criarConta(dados) {
  try {
    const { data } = await api.post('/contas', dados);
    return data?.data?.conta;
  } catch (erro) {
    avisarEndpointEmDev('POST /contas');
    // Em DEV, simula a conta criada para o fluxo da UI seguir (id temporário local).
    if (import.meta.env.DEV) {
      return { id: `tmp_${Date.now()}`, ...dados };
    }
    throw erro;
  }
}

// PUT /contas/:id — atualiza uma conta.
export async function atualizarConta(id, dados) {
  try {
    const { data } = await api.put(`/contas/${id}`, dados);
    return data?.data?.conta;
  } catch (erro) {
    avisarEndpointEmDev(`PUT /contas/${id}`);
    if (import.meta.env.DEV) {
      return { id, ...dados };
    }
    throw erro;
  }
}

// DELETE /contas/:id — arquiva (soft delete).
export async function arquivarConta(id) {
  try {
    await api.delete(`/contas/${id}`);
    return true;
  } catch (erro) {
    avisarEndpointEmDev(`DELETE /contas/${id}`);
    if (import.meta.env.DEV) {
      return true;
    }
    throw erro;
  }
}
