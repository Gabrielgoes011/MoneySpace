// Consumo da API de categorias (tabela global `utilitario`, tipo 'categoria').
//   GET  /categorias   -> { categorias: [{id, valor, ordem}], pode_editar }
//   POST /categorias   body { valor }  (só o dono do app)
// Com VITE_MODO_DEMO=true (sem backend) usa uma lista em memória só para visualizar a tela.
import api from './api';

const DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

// ── Demo (memória) ──────────────────────────────────────────────
let demo = [
  'alimentação & mercado', 'farmácia & saúde', 'transporte & combustível',
  'compras & vestuário', 'lazer & restaurantes', 'educação & cursos',
  'serviços & assinaturas', 'pet & veterinário', 'outros',
].map((valor, i) => ({ id: `c${i + 1}`, valor, ordem: i + 1 }));
const atraso = (v) => new Promise((r) => setTimeout(() => r(v), 250));

export async function listarCategorias() {
  if (DEMO) return atraso({ categorias: demo, pode_editar: true });
  return api.get('/categorias').then((r) => r.data.data).catch(comMensagem);
}

export async function criarCategoria(valor) {
  if (DEMO) {
    const nova = { id: `c${Date.now()}`, valor: valor.trim().toLowerCase(), ordem: demo.length + 1 };
    demo = [...demo, nova];
    return atraso(nova);
  }
  return api.post('/categorias', { valor }).then((r) => r.data.data.categoria).catch(comMensagem);
}
