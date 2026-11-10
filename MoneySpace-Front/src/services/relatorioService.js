// Consumo da API de relatórios.
//   GET /relatorios/fatura?faturaId=<uuid> -> { cabecalho, resumo, porPortador, porCategoria, lancamentos }
import api from './api';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível gerar o relatório.');
};

// Valor gasto por semana (segunda a domingo) e detalhes por categoria da fatura.
export async function buscarRelatorioSemanal(faturaId) {
  return api
    .get('/relatorios/semanal', { params: { faturaId } })
    .then((r) => r.data.data)
    .catch(comMensagem);
}

export async function buscarRelatorioFatura(faturaId) {
  return api
    .get('/relatorios/fatura', { params: { faturaId } })
    .then((r) => r.data.data)
    .catch(comMensagem);
}
