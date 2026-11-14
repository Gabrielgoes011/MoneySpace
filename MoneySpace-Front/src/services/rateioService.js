// Consumo da API do rateio (compra rachada entre pessoas).
//   GET  /rateio?lancamentoId=                      -> { lancamento, partes[], resumo, pessoas[] }
//   POST /rateio/partes/cadastrar       body { idLancamento, nome, valor }
//   POST /rateio/partes/editar/:id      body { valor }
//   POST /rateio/partes/deletar/:id
//   POST /rateio/partes/pagar/:id       body { valor, dataPagamento? (AAAA-MM-DD) }
//   POST /rateio/partes/absorver/:id    body { absorvido? }
//   POST /rateio/pagamentos/deletar/:id
// As escritas só confirmam; depois de cada uma a tela busca o rateio de novo.
import api from './api';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

export async function buscarRateio(lancamentoId) {
  return api.get('/rateio', { params: { lancamentoId } }).then((r) => r.data.data).catch(comMensagem);
}

export async function cadastrarParte(dados) {
  return api.post('/rateio/partes/cadastrar', dados).then((r) => r.data.data).catch(comMensagem);
}

export async function editarParte(idParte, valor) {
  return api.post(`/rateio/partes/editar/${idParte}`, { valor }).then((r) => r.data.data).catch(comMensagem);
}

export async function excluirParte(idParte) {
  return api.post(`/rateio/partes/deletar/${idParte}`).then((r) => r.data.data).catch(comMensagem);
}

export async function registrarPagamento(idParte, dados) {
  return api.post(`/rateio/partes/pagar/${idParte}`, dados).then((r) => r.data.data).catch(comMensagem);
}

// absorvido = true: quem adiantou a compra assume o que falta; false desfaz.
export async function definirAbsorcao(idParte, absorvido) {
  return api.post(`/rateio/partes/absorver/${idParte}`, { absorvido }).then((r) => r.data.data).catch(comMensagem);
}

export async function excluirPagamento(idPagamento) {
  return api.post(`/rateio/pagamentos/deletar/${idPagamento}`).then((r) => r.data.data).catch(comMensagem);
}
