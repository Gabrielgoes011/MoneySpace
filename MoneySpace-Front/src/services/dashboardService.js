// Consumo da API do painel inicial (só leitura). Sem modo demo: lê do banco.
//   GET /dashboard?competencia=AAAA-MM&cartaoId=<uuid>|todos
//     -> { competencia, cartaoId, cartoes[], resumo, portadores[], categorias[], semCategoria }
//   Sem cartaoId, o back usa o cartão principal e devolve o id escolhido em `cartaoId`.
import api from './api';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível carregar o painel.');
};

export async function buscarDashboard(competencia, cartaoId) {
  return api
    .get('/dashboard', { params: { competencia, cartaoId } })
    .then((r) => r.data.data)
    .catch(comMensagem);
}
