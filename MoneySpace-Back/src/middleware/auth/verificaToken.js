// ========================================
// MIDDLEWARE: VERIFICA TOKEN JWT
// ========================================
// Lê o token do header Authorization (Bearer) ou do cookie "token",
// valida com o JWT_SECRET e injeta os dados decodificados em req.user.
// Use nas rotas que exigem usuário autenticado (ex.: GET /me).

import jwt from 'jsonwebtoken';
import httpResponse from '../../utils/httpResponse.js';

const JWT_SECRET = process.env.JWT_SECRET;

const verificaToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const cookieToken = req.cookies?.token;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : cookieToken;

    if (!token) {
      return httpResponse.unauthorized(res, 'Token não fornecido.');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // disponibiliza os dados do usuário para o controller
    next();
  } catch (error) {
    return httpResponse.unauthorized(res, 'Token inválido ou expirado.');
  }
};

export default verificaToken;
