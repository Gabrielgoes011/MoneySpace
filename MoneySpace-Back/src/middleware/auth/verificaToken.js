// ========================================
// MIDDLEWARE: VERIFICA TOKEN JWT
// ========================================
// Lê o token SÓ do cookie httpOnly "token" (o front não guarda token: não existe header Bearer),
// valida com o segredo de ACESSO e injeta os dados decodificados em req.user.
// Só aceita token de acesso (type 'access'): um refresh token não abre rota nenhuma.
// Use nas rotas que exigem usuário autenticado (ex.: GET /me).

import jwt from 'jsonwebtoken';
import httpResponse from '../../utils/httpResponse.js';
import { SEGREDO_ACESSO } from '../../config/segredos.js';

const verificaToken = (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return httpResponse.unauthorized(res, 'Token não fornecido.');
    }

    const decoded = jwt.verify(token, SEGREDO_ACESSO);

    // token de refresh (ou sem tipo, de antes desta mudança) não vale como acesso
    if (decoded.type !== 'access') {
      return httpResponse.unauthorized(res, 'Token inválido ou expirado.');
    }

    req.user = decoded; // disponibiliza os dados do usuário para o controller
    next();
  } catch (error) {
    return httpResponse.unauthorized(res, 'Token inválido ou expirado.');
  }
};

export default verificaToken;
