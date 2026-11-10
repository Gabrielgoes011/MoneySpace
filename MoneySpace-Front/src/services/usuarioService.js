// Consumo da API de usuários da família.
//   GET  /usuarios       -> { familia, usuarios, pode_editar }
//   POST /usuarios       body { nome, cpf, email, senha, role }
//   PUT  /usuarios/:id   body { nome?, cpf?, email?, role?, senha? }
// Com VITE_MODO_DEMO=true (sem backend) usa uma lista em memória só para visualizar a tela.
import api from './api';

const DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

// ── Demo (memória) ──────────────────────────────────────────────
let demo = {
  familia: { id: 'f1', nome: 'Família Goes' },
  usuarios: [
    { id: 'u1', nome: 'Gabriel Goes', email: 'gabriel@exemplo.com', cpf: '52998224725', role: 'ADMIN', is_master: true, mfa_ativo: true, dt_cadastro: '2026-01-10T09:00:00' },
    { id: 'u2', nome: 'Geovana Tavares', email: 'geovana@exemplo.com', cpf: '11144477735', role: 'ADMIN', is_master: false, mfa_ativo: false, dt_cadastro: '2026-01-10T09:05:00' },
    { id: 'u3', nome: 'Marcos Tavares', email: 'marcos@exemplo.com', cpf: '39053344705', role: 'MEMBRO', is_master: false, mfa_ativo: false, dt_cadastro: '2026-03-02T15:00:00' },
    { id: 'u4', nome: 'Sara Johnson', email: 'sara@exemplo.com', cpf: '86288366757', role: 'MEMBRO', is_master: false, mfa_ativo: false, dt_cadastro: '2026-02-20T11:00:00' },
  ],
};
const atraso = (v) => new Promise((r) => setTimeout(() => r(v), 250));

export async function listarUsuarios() {
  if (DEMO) return atraso({ ...demo, pode_editar: true });
  return api.get('/usuarios').then((r) => r.data.data).catch(comMensagem);
}

export async function criarUsuario(dados) {
  if (DEMO) {
    const novo = { ...dados, id: `u${Date.now()}`, is_master: false, mfa_ativo: false, dt_cadastro: new Date().toISOString() };
    delete novo.senha;
    demo = { ...demo, usuarios: [...demo.usuarios, novo] };
    return atraso(novo);
  }
  return api.post('/usuarios', dados).then((r) => r.data.data.usuario).catch(comMensagem);
}

export async function atualizarUsuario(id, dados) {
  if (DEMO) {
    const { senha: _senha, ...resto } = dados;
    demo = { ...demo, usuarios: demo.usuarios.map((u) => (u.id === id ? { ...u, ...resto } : u)) };
    return atraso(demo.usuarios.find((u) => u.id === id));
  }
  return api.put(`/usuarios/${id}`, dados).then((r) => r.data.data.usuario).catch(comMensagem);
}
