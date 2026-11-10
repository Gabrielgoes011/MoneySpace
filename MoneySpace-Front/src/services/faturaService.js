// Consumo da API de faturas (cabeçalho + lançamentos). Sem modo demo: lê e grava no banco.
//   GET  /faturas?cartaoId=&competencia=AAAA-MM        -> { cartao, fatura|null, lancamentos[] }
//   POST /faturas/cadastrar        body { cartaoId, competencia }      -> { fatura }
//   POST /faturas/saldo/:id        body { saldo }                       -> { saldoReserva }
//   POST /faturas/fechar/:id                                            -> { fechada }
//   POST /faturas/lancamentos/cadastrar   body { idFatura, dataCompra, estabelecimento, valor, idUsuario?, categoria?, parcela?, statusTransacao? }
//   POST /faturas/lancamentos/status/:id  body { statusTransacao }
import api from './api';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

// Faturas que já existem do cartão (mais recente primeiro): alimenta o seletor de competência.
export async function listarFaturasCartao(cartaoId) {
  return api
    .get('/faturas/listar', { params: { cartaoId } })
    .then((r) => r.data.data)
    .catch(comMensagem);
}

export async function buscarFatura(cartaoId, competencia) {
  return api
    .get('/faturas', { params: { cartaoId, competencia } })
    .then((r) => r.data.data)
    .catch(comMensagem);
}

export async function criarFatura(cartaoId, competencia) {
  return api
    .post('/faturas/cadastrar', { cartaoId, competencia })
    .then((r) => r.data.data.fatura)
    .catch(comMensagem);
}

export async function salvarSaldoFatura(idFatura, saldo) {
  return api
    .post(`/faturas/saldo/${idFatura}`, { saldo })
    .then((r) => r.data.data.saldoReserva)
    .catch(comMensagem);
}

export async function fecharFatura(idFatura) {
  return api
    .post(`/faturas/fechar/${idFatura}`)
    .then((r) => r.data.data)
    .catch(comMensagem);
}

export async function cadastrarLancamento(dados) {
  return api
    .post('/faturas/lancamentos/cadastrar', dados)
    .then((r) => r.data.data)
    .catch(comMensagem);
}

// Edita o lançamento. Campo não enviado fica como está; idUsuario '' tira o portador; categoria '' tira a categoria.
export async function editarLancamento(idLancamento, dados) {
  return api
    .post(`/faturas/lancamentos/editar/${idLancamento}`, dados)
    .then((r) => r.data.data)
    .catch(comMensagem);
}

export async function excluirLancamento(idLancamento) {
  return api
    .post(`/faturas/lancamentos/deletar/${idLancamento}`)
    .then((r) => r.data.data)
    .catch(comMensagem);
}

export async function alterarStatusLancamento(idLancamento, statusTransacao) {
  return api
    .post(`/faturas/lancamentos/status/${idLancamento}`, { statusTransacao })
    .then((r) => r.data.data)
    .catch(comMensagem);
}
