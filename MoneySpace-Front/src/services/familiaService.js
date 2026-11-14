// Consumo da API de famílias (gestão do dono do app).
//   GET  /familias/acesso      -> { master }
//   GET  /familias             -> { familias: [{ id, nome, dt_cadastro, total_usuarios, total_cartoes }] } (só master)
//   POST /familias/cadastrar   body { nome, adminNome, adminCpf, adminEmail, adminSenha } (só master)
import api from './api';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

export async function verificarAcessoMaster() {
  return api.get('/familias/acesso').then((r) => r.data.data.master === true);
}

export async function listarFamilias() {
  return api.get('/familias').then((r) => r.data.data.familias).catch(comMensagem);
}

export async function cadastrarFamilia(dados) {
  return api.post('/familias/cadastrar', dados).then((r) => r.data.data).catch(comMensagem);
}
