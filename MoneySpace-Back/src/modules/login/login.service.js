// ========================================
// SERVICE: LOGIN / AUTENTICAÇÃO
// ========================================
// Regras de negócio do login. Orquestra repository + bcrypt + jwt + 2FA.
// Mapeado para o banco do MoneySpace:
//   - senha: coluna `senha` (hash bcrypt) na tabela usuario
//   - 2FA:   `mfa_secreto` (segredo TOTP cifrado) e `mfa_ativo`
//   - token: carrega id, id_familia, nome, email (id_familia alimenta o RLS)

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { encryptText, decryptText } from '../../utils/crypto.js';
import { findUserByEmail, findUserById, updateUser2fa } from './login.repositories.js';

const APP_NAME = process.env.APP_NAME || 'MoneySpace';

// Durações dos tokens.
// - Access token: vida curta, autoriza as requisições.
// - Refresh token: vida mais longa, só serve para emitir um novo access token.
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || '8h';

// Monta o objeto de usuário que vai para o front (nunca inclui senha/segredo).
function montarUsuarioPublico(usuario) {
    return {
        id: usuario.id,
        id_familia: usuario.id_familia,
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

//#region => Lógica para login

async function autenticarUsuario(email, senha) {
    if (!email || !senha) {
        throw new Error('E-mail e senha são obrigatórios.');
    }

    // 1. Busca o usuário (já traz senha e campos de 2FA)
    const usuario = await findUserByEmail(email);
    if (!usuario) {
        // Mensagem genérica contra enumeração de e-mails.
        throw new Error('E-mail ou senha inválidos.');
    }

    // 2. Confere a senha com bcrypt
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
        throw new Error('E-mail ou senha inválidos.');
    }

    const usuarioPublico = montarUsuarioPublico(usuario);

    // 3. Se o 2FA estiver ativo, interrompe aqui e pede o código na próxima etapa
    if (usuario.mfa_ativo) {
        return { requires2fa: true, usuario: usuarioPublico };
    }

    // 4. Sem 2FA: emite os tokens direto
    return {
        token: gerarAccessToken(usuario),
        refreshToken: gerarRefreshToken(usuario.id),
        usuario: usuarioPublico,
    };
}

async function autenticarUsuarioCom2fa(email, senha, codigo) {
    if (!email || !senha || !codigo) {
        throw new Error('E-mail, senha e código 2FA são obrigatórios.');
    }

    // 1. Busca o usuário
    const usuario = await findUserByEmail(email);
    if (!usuario) {
        throw new Error('E-mail ou senha inválidos.');
    }

    // 2. Confere a senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
        throw new Error('E-mail ou senha inválidos.');
    }

    // 3. Garante que o 2FA está mesmo ativo e com segredo salvo
    if (!usuario.mfa_ativo || !usuario.mfa_secreto) {
        throw new Error('2FA não está ativado para este usuário.');
    }

    // 4. Descriptografa o segredo e valida o código TOTP informado
    const secret = decryptText(usuario.mfa_secreto);
    const valido = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: codigo,
        window: 1,
    });

    if (!valido) {
        throw new Error('Código 2FA inválido.');
    }

    // 5. Tudo certo: emite os tokens
    return {
        token: gerarAccessToken(usuario),
        refreshToken: gerarRefreshToken(usuario.id),
        usuario: montarUsuarioPublico(usuario),
    };
}

// Retorna os dados do usuário logado a partir do id contido no token.
async function obterUsuarioLogado(usuarioId) {
    const usuario = await findUserById(usuarioId);
    if (!usuario) {
        throw new Error('Usuário não encontrado.');
    }
    return montarUsuarioPublico(usuario);
}

// Valida um refresh token e emite um novo access token.
async function renovarAccessToken(refreshToken) {
    if (!refreshToken) {
        throw new Error('Refresh token ausente.');
    }

    // 1. Verifica assinatura e expiração
    let payload;
    try {
        payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    // 2. Garante que é mesmo um refresh token
    if (payload.type !== 'refresh' || !payload.id) {
        throw new Error('Refresh token inválido.');
    }

    // 3. Reconsulta o usuário para refletir o estado atual
    const usuario = await findUserById(payload.id);
    if (!usuario) {
        throw new Error('Usuário não encontrado.');
    }

    // 4. Emite um novo access token
    return {
        token: gerarAccessToken(usuario),
        usuario: montarUsuarioPublico(usuario),
    };
}

//#endregion

//#region => Lógica para 2FA

async function iniciar2faService(usuarioId) {
    // 1. Busca o usuário (precisa do e-mail para rotular o QR code)
    const usuario = await findUserById(usuarioId);
    if (!usuario) {
        throw new Error('Usuário não encontrado.');
    }

    // 2. Não gera novo segredo se o 2FA já estiver ativo
    if (usuario.mfa_ativo) {
        throw new Error('2FA já está ativado para este usuário.');
    }

    // 3. Gera o segredo TOTP identificado por app + e-mail
    const secret = speakeasy.generateSecret({
        name: `${APP_NAME}:${usuario.email}`,
        issuer: APP_NAME,
        length: 20,
    });

    // 4. Cifra o segredo antes de persistir e monta o QR code
    const encryptedSecret = encryptText(secret.base32);
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // 5. Salva o segredo, mas mantém o 2FA desativado até a confirmação
    await updateUser2fa(usuarioId, { mfa_secreto: encryptedSecret, mfa_ativo: false });

    // 6. Retorna o QR code e o segredo em texto (fallback de digitação manual)
    return { qrCodeDataUrl, secretBase32: secret.base32 };
}

async function confirmar2faService(usuarioId, codigo) {
    // 1. Busca o usuário com o segredo salvo em iniciar2fa
    const usuario = await findUserById(usuarioId);
    if (!usuario) {
        throw new Error('Usuário não encontrado.');
    }

    // 2. Descriptografa o segredo
    const secret = decryptText(usuario.mfa_secreto);
    if (!secret) {
        throw new Error('Segredo de 2FA não encontrado. Inicie a ativação antes de confirmar.');
    }

    // 3. Valida o código TOTP
    const valido = speakeasy.totp.verify({ secret, encoding: 'base32', token: codigo, window: 1 });
    if (!valido) {
        throw new Error('Código inválido. Verifique o app do autenticador.');
    }

    // 4. Ativa o 2FA de fato
    await updateUser2fa(usuarioId, { mfa_ativo: true });

    return { mfa_ativo: true };
}

async function desativar2faService(usuarioId) {
    const usuario = await findUserById(usuarioId);
    if (!usuario) {
        throw new Error('Usuário não encontrado.');
    }

    // Desativa o 2FA e apaga o segredo salvo
    await updateUser2fa(usuarioId, { mfa_secreto: null, mfa_ativo: false });

    return { mfa_ativo: false };
}

async function validarCodigo2faService(usuarioId, codigo) {
    const usuario = await findUserById(usuarioId);
    if (!usuario || !usuario.mfa_ativo) {
        throw new Error('2FA não está ativado para este usuário.');
    }

    const secret = decryptText(usuario.mfa_secreto);
    if (!secret) {
        throw new Error('Segredo de 2FA inválido.');
    }

    const valido = speakeasy.totp.verify({ secret, encoding: 'base32', token: codigo, window: 1 });
    if (!valido) {
        throw new Error('Código inválido. Verifique o app do autenticador.');
    }

    return { valid: true };
}

//#endregion

export {
    autenticarUsuario,
    autenticarUsuarioCom2fa,
    obterUsuarioLogado,
    renovarAccessToken,
    iniciar2faService,
    confirmar2faService,
    desativar2faService,
    validarCodigo2faService,
};
