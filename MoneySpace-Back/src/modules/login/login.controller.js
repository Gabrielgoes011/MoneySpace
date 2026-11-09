// ========================================
// CONTROLLER: LOGIN / AUTENTICAÇÃO / 2FA
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E da lógica de
// negócio (bcrypt, JWT, 2FA, refresh). As queries ficam no repository.
// Mapeado para a tabela `usuario`:
//   - senha: coluna `senha` (hash bcrypt)
//   - 2FA:   `mfa_secreto` (segredo TOTP cifrado) e `mfa_ativo`
//   - token: carrega id, id_familia, nome, email (id_familia alimenta o RLS)

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler from '../../utils/pgErrorHandler.js';
import { encryptText, decryptText } from '../../utils/crypto.js';
import { findUserByEmail, findUserById, updateUser2fa } from './login.repositories.js';

const APP_NAME = process.env.APP_NAME || 'MoneySpace';

// Durações dos tokens.
// - Access token: vida curta, autoriza as requisições.
// - Refresh token: vida mais longa, só serve para emitir um novo access token.
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || '8h';

// Duração dos cookies (em ms). Devem espelhar as durações dos tokens acima.
const ACCESS_COOKIE_MAX_AGE = 1000 * 60 * 15;      // 15 minutos
const REFRESH_COOKIE_MAX_AGE = 1000 * 60 * 60 * 8; // 8 horas

//#region => Helpers de token/usuário

// Monta o objeto de usuário que vai para o front (nunca inclui senha/segredo).
function montarUsuarioPublico(usuario) {
  return {
    id: usuario.id,
    id_familia: usuario.id_familia,
    familia_nome: usuario.familia_nome,
    nome: usuario.nome,
    email: usuario.email,
    mfa_ativo: !!usuario.mfa_ativo,
  };
}

// Gera o access token (JWT). Inclui id_familia porque é ele que alimenta o
// contexto de RLS (app.current_familia_id) a cada request autenticado.
function gerarAccessToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      id_familia: usuario.id_familia,
      familia_nome: usuario.familia_nome,
      nome: usuario.nome,
      email: usuario.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

// Gera o refresh token: JWT separado (type: 'refresh') carregando só o id.
function gerarRefreshToken(usuarioId) {
  return jwt.sign(
    { id: usuarioId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

//#endregion

//#region => Helpers de cookie

// Opções base comuns a todos os cookies de autenticação.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

// Grava o access token (cookie 'token') na resposta.
function setAccessCookie(res, token) {
  res.cookie('token', token, { ...baseCookieOptions(), maxAge: ACCESS_COOKIE_MAX_AGE });
}

// Grava o refresh token (cookie 'refreshToken') restrito à rota de refresh.
// O path mais estreito evita que o refresh token trafegue em toda requisição.
function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    ...baseCookieOptions(),
    path: '/auth/refresh',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

// Remove os cookies de autenticação. clearCookie precisa receber os MESMOS
// atributos (path, sameSite, secure, httpOnly) usados ao criar — senão o
// navegador não casa o cookie e ele continua vivo. Por isso o refreshToken
// é limpo com o seu path específico ('/auth/refresh').
function limparCookiesAuth(res) {
  res.clearCookie('token', baseCookieOptions());
  res.clearCookie('refreshToken', { ...baseCookieOptions(), path: '/auth/refresh' });
}

// Decide a mensagem de erro que vai para o cliente (e, portanto, para o toast):
//   - Erro do PostgreSQL (tem `code`): passa pelo pgErrorHandler, que não expõe
//     detalhes internos da estrutura do banco.
//   - Erro de regra de negócio (sem `code`): usa a própria mensagem
//     (ex.: "E-mail ou senha inválidos.", "Código 2FA inválido.").
function mensagemDeErro(error, fallback) {
  if (error?.code) {
    return pgErrorHandler(error, fallback);
  }
  return error?.message || fallback;
}

//#endregion

//#region => Login / Sessão

async function loginController(req, res) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return httpResponse.validationError(res, 'E-mail e senha são obrigatórios.');
    }

    // Busca o usuário (já traz senha e campos de 2FA). Mensagem genérica
    // contra enumeração de e-mails.
    const usuario = await findUserByEmail(email);
    if (!usuario) {
      return httpResponse.error(res, 'E-mail ou senha inválidos.', 401);
    }

    // Confere a senha com bcrypt.
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return httpResponse.error(res, 'E-mail ou senha inválidos.', 401);
    }

    const usuarioPublico = montarUsuarioPublico(usuario);

    // Se o 2FA estiver ativo, interrompe aqui e pede o código na próxima etapa.
    if (usuario.mfa_ativo) {
      return httpResponse.success(res, 'Autenticação em duas etapas necessária.', {
        requires2fa: true,
        usuario: usuarioPublico,
      }, 200);
    }

    // Sem 2FA: emite os tokens direto e grava nos cookies httpOnly.
    const token = gerarAccessToken(usuario);
    const refreshToken = gerarRefreshToken(usuario.id);
    setAccessCookie(res, token);
    setRefreshCookie(res, refreshToken);

    return httpResponse.success(res, 'Login bem-sucedido!', {
      usuario: usuarioPublico,
      token,
    }, 200);
  } catch (error) {
    console.error('Erro no login na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível realizar o login.'), 401);
  }
}

async function login2faController(req, res) {
  try {
    const { email, senha, codigo } = req.body;

    if (!email || !senha || !codigo) {
      return httpResponse.validationError(res, 'E-mail, senha e código 2FA são obrigatórios.');
    }

    const usuario = await findUserByEmail(email);
    if (!usuario) {
      return httpResponse.error(res, 'E-mail ou senha inválidos.', 401);
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return httpResponse.error(res, 'E-mail ou senha inválidos.', 401);
    }

    // Garante que o 2FA está mesmo ativo e com segredo salvo.
    if (!usuario.mfa_ativo || !usuario.mfa_secreto) {
      return httpResponse.error(res, '2FA não está ativado para este usuário.', 401);
    }

    // Descriptografa o segredo e valida o código TOTP informado.
    const secret = decryptText(usuario.mfa_secreto);
    const valido = speakeasy.totp.verify({ secret, encoding: 'base32', token: codigo, window: 1 });
    if (!valido) {
      return httpResponse.error(res, 'Código 2FA inválido.', 401);
    }

    const token = gerarAccessToken(usuario);
    const refreshToken = gerarRefreshToken(usuario.id);
    setAccessCookie(res, token);
    setRefreshCookie(res, refreshToken);

    return httpResponse.success(res, 'Login 2FA bem-sucedido!', {
      usuario: montarUsuarioPublico(usuario),
      token,
    }, 200);
  } catch (error) {
    console.error('Erro no login 2FA na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível concluir o login com 2FA.'), 401);
  }
}

// Retorna os dados do usuário logado, derivados do id contido no token.
// Usado pelo front no boot e após o login para hidratar o estado.
async function meController(req, res) {
  try {
    const usuario = await findUserById(req.user.id);
    if (!usuario) {
      return httpResponse.error(res, 'Usuário não encontrado.', 401);
    }
    return httpResponse.success(res, 'Usuário autenticado.', {
      usuario: montarUsuarioPublico(usuario),
    }, 200);
  } catch (error) {
    console.error('Erro ao obter usuário logado na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível validar a sessão.'), 401);
  }
}

// Emite um novo access token a partir do refresh token (cookie httpOnly).
async function refreshController(req, res) {
  try {
    // Prioriza o cookie; aceita o body como fallback para clientes sem cookie.
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return httpResponse.error(res, 'Refresh token ausente.', 401);
    }

    // Verifica assinatura e expiração.
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return httpResponse.error(res, 'Sessão expirada. Faça login novamente.', 401);
    }

    // Garante que é mesmo um refresh token.
    if (payload.type !== 'refresh' || !payload.id) {
      return httpResponse.error(res, 'Refresh token inválido.', 401);
    }

    // Reconsulta o usuário para refletir o estado atual e emite novo access token.
    const usuario = await findUserById(payload.id);
    if (!usuario) {
      return httpResponse.error(res, 'Usuário não encontrado.', 401);
    }

    const token = gerarAccessToken(usuario);
    setAccessCookie(res, token);

    return httpResponse.success(res, 'Sessão renovada.', {
      usuario: montarUsuarioPublico(usuario),
      token,
    }, 200);
  } catch (error) {
    console.error('Erro ao renovar a sessão na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível renovar a sessão.'), 401);
  }
}

// Encerra a sessão: limpa os cookies httpOnly (access e refresh) no navegador.
// É idempotente e público — um token já expirado ainda deve conseguir "sair".
function logoutController(req, res) {
  limparCookiesAuth(res);
  return httpResponse.success(res, 'Sessão finalizada.', null, 200);
}

//#endregion

//#region => 2FA

async function iniciar2faController(req, res) {
  try {
    const usuarioId = req.user.id;

    const usuario = await findUserById(usuarioId);
    if (!usuario) {
      return httpResponse.error(res, 'Usuário não encontrado.', 404);
    }

    // Não gera novo segredo se o 2FA já estiver ativo.
    if (usuario.mfa_ativo) {
      return httpResponse.conflict(res, '2FA já está ativado para este usuário.');
    }

    // Gera o segredo TOTP identificado por app + e-mail.
    const secret = speakeasy.generateSecret({
      name: `${APP_NAME}:${usuario.email}`,
      issuer: APP_NAME,
      length: 20,
    });

    // Cifra o segredo antes de persistir e monta o QR code.
    const encryptedSecret = encryptText(secret.base32);
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Salva o segredo, mas mantém o 2FA desativado até a confirmação.
    await updateUser2fa(usuarioId, { mfa_secreto: encryptedSecret, mfa_ativo: false });

    return httpResponse.success(res, 'QR code gerado com sucesso.', {
      qrCodeDataUrl,
      secretBase32: secret.base32,
    }, 200);
  } catch (error) {
    console.error('Erro ao iniciar 2FA na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível iniciar a configuração do 2FA.'), 500);
  }
}

async function confirmar2faController(req, res) {
  try {
    const usuarioId = req.user.id;
    const { codigo } = req.body;

    if (!codigo) {
      return httpResponse.validationError(res, 'O código 2FA é obrigatório.');
    }

    const usuario = await findUserById(usuarioId);
    if (!usuario) {
      return httpResponse.error(res, 'Usuário não encontrado.', 404);
    }

    const secret = decryptText(usuario.mfa_secreto);
    if (!secret) {
      return httpResponse.validationError(res, 'Segredo de 2FA não encontrado. Inicie a ativação antes de confirmar.');
    }

    const valido = speakeasy.totp.verify({ secret, encoding: 'base32', token: codigo, window: 1 });
    if (!valido) {
      return httpResponse.validationError(res, 'Código inválido. Verifique o app do autenticador.');
    }

    // Ativa o 2FA de fato.
    await updateUser2fa(usuarioId, { mfa_ativo: true });

    return httpResponse.success(res, '2FA ativado com sucesso.', { mfa_ativo: true }, 200);
  } catch (error) {
    console.error('Erro ao confirmar 2FA na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível ativar o 2FA.'), 400);
  }
}

async function desativar2faController(req, res) {
  try {
    const usuarioId = req.user.id;

    const usuario = await findUserById(usuarioId);
    if (!usuario) {
      return httpResponse.error(res, 'Usuário não encontrado.', 404);
    }

    // Desativa o 2FA e apaga o segredo salvo.
    await updateUser2fa(usuarioId, { mfa_secreto: null, mfa_ativo: false });

    return httpResponse.success(res, '2FA desativado com sucesso.', { mfa_ativo: false }, 200);
  } catch (error) {
    console.error('Erro ao desativar 2FA na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível desativar o 2FA.'), 500);
  }
}

async function validarCodigo2faController(req, res) {
  try {
    const usuarioId = req.user.id;
    const { codigo } = req.body;

    if (!codigo) {
      return httpResponse.validationError(res, 'O código 2FA é obrigatório.');
    }

    const usuario = await findUserById(usuarioId);
    if (!usuario || !usuario.mfa_ativo) {
      return httpResponse.error(res, '2FA não está ativado para este usuário.', 400);
    }

    const secret = decryptText(usuario.mfa_secreto);
    if (!secret) {
      return httpResponse.validationError(res, 'Segredo de 2FA inválido.');
    }

    const valido = speakeasy.totp.verify({ secret, encoding: 'base32', token: codigo, window: 1 });
    if (!valido) {
      return httpResponse.validationError(res, 'Código inválido. Verifique o app do autenticador.');
    }

    return httpResponse.success(res, 'Código 2FA validado.', { valid: true }, 200);
  } catch (error) {
    console.error('Erro ao validar código 2FA na etapa do controller:', error);
    return httpResponse.error(res, mensagemDeErro(error, 'Não foi possível validar o código 2FA.'), 400);
  }
}

//#endregion

export {
  loginController,
  login2faController,
  meController,
  refreshController,
  logoutController,
  iniciar2faController,
  confirmar2faController,
  desativar2faController,
  validarCodigo2faController,
};
