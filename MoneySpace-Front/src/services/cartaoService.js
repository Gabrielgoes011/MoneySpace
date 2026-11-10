// Consumo da API de cartões da família.
//   GET  /cartoes                -> { cartoes: [...], pode_cadastrar }
//   POST /cartoes/cadastrar      body { nome, final, idUsuario, limite?, diaFechamento?, diaVencimento?, principal? }
// Com VITE_MODO_DEMO=true (sem backend) usa uma lista em memória só para visualizar a tela.
import api from './api';

const DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

// ── Demo (memória) ──────────────────────────────────────────────
let demo = [
  { id: 'c1', nome: 'Rico Mastercard', final: '4821', limite: 8000, dia_fechamento: 25, dia_vencimento: 5, principal: true, id_usuario: 'u1', nome_dono: 'Gabriel Goes' },
  { id: 'c2', nome: 'Nubank Roxinho', final: '9034', limite: 3500, dia_fechamento: 20, dia_vencimento: 1, principal: false, id_usuario: 'u2', nome_dono: 'Geovana Tavares' },
];
const atraso = (v) => new Promise((r) => setTimeout(() => r(v), 250));

export async function listarCartoes() {
  if (DEMO) return atraso({ cartoes: demo, pode_cadastrar: true });
  return api.get('/cartoes').then((r) => r.data.data).catch(comMensagem);
}

// Exclui o cartão (só ADMIN e só sem lançamentos). O back responde 409 se tiver movimentação.
export async function excluirCartao(idCartao) {
  if (DEMO) {
    demo = demo.filter((c) => c.id !== idCartao);
    return atraso({ id: idCartao });
  }
  return api.post(`/cartoes/deletar/${idCartao}`).then((r) => r.data.data.cartao).catch(comMensagem);
}

export async function criarCartao(dados) {
  if (DEMO) {
    // igual ao back: o novo principal tira o principal dos outros
    const novo = {
      id: `c${Date.now()}`,
      nome: dados.nome,
      final: dados.final,
      limite: dados.limite ?? null,
      dia_fechamento: dados.diaFechamento ?? null,
      dia_vencimento: dados.diaVencimento ?? null,
      principal: !!dados.principal,
      id_usuario: dados.idUsuario,
      nome_dono: 'Membro',
    };
    demo = [...demo.map((c) => (novo.principal ? { ...c, principal: false } : c)), novo];
    return atraso(novo);
  }
  return api.post('/cartoes/cadastrar', dados).then((r) => r.data.data.cartao).catch(comMensagem);
}
