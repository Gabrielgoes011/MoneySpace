// Consumo da API da conta do próprio usuário logado.
//   GET  /usuarios/minha-conta      -> { usuario }
//   POST /usuarios/minha-conta      body { nome, email, cpf }
//   POST /2fa/iniciar               -> { qrCodeDataUrl, secretBase32 }
//   POST /2fa/confirmar             body { codigo }
//   POST /2fa/desativar             body { codigo }
// Senha tem tela própria (usuarioService.trocarMinhaSenha).
import api from './api';

// Extrai a mensagem do backend ({ success:false, message }) para o toast.
const comMensagem = (erro) => {
  throw new Error(erro.response?.data?.message || 'Não foi possível concluir a operação.');
};

export async function buscarMinhaConta() {
  return api.get('/usuarios/minha-conta').then((r) => r.data.data.usuario).catch(comMensagem);
}

export async function atualizarMinhaConta(dados) {
  return api.post('/usuarios/minha-conta', dados).then((r) => r.data.data.usuario).catch(comMensagem);
}

// Gera o segredo e o QR code. O 2FA só fica ativo depois de confirmar o primeiro código.
export async function iniciarSegundoFator() {
  return api.post('/2fa/iniciar').then((r) => r.data.data).catch(comMensagem);
}

export async function confirmarSegundoFator(codigo) {
  return api.post('/2fa/confirmar', { codigo }).then((r) => r.data.data).catch(comMensagem);
}

// Desativa o 2FA. O back exige o código atual do app.
export async function desativarSegundoFator(codigo) {
  return api.post('/2fa/desativar', { codigo }).then((r) => r.data.data).catch(comMensagem);
}
