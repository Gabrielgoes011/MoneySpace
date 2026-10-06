// ========================================
// APP EXPRESS (configuração central)
// ========================================
// Monta a aplicação: middlewares globais, CORS e registro das rotas.
// O server.js apenas importa este `app` e sobe a porta.

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import healthRoutes from '../routes/health.routes.js';
import loginRoutes from './login/login.routes.js';
import httpResponse from '../utils/httpResponse.js';
import { rlsMiddleware } from '../middleware/rlsMiddleware.js';

const app = express();

// Atrás de proxy (Nginx, Vercel, Cloudflare) o IP real vem no X-Forwarded-For.
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────
// Libera o front (Vite em http://localhost:5173) a chamar a API.
// Em produção, troque pela(s) origem(ns) real(is) via CORS_ORIGIN no .env.
const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: origins,
    credentials: true, // permite envio de cookies (ex.: refresh token)
  })
);

// ── Parsers ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── RLS (Row-Level Security) ─────────────────────────────────────────────────
// Abre transação + contexto por request quando há usuário autenticado.
// Em rotas públicas (sem req.user) ele apenas passa direto.
app.use(rlsMiddleware);

// ── Rotas ─────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/', loginRoutes);

// Rota raiz: mensagem simples só para confirmar que a API respondeu.
app.get('/', (req, res) =>
  httpResponse.success(res, 'API do MoneySpace no ar 🚀', { versao: '1.0.0' })
);

// ── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => httpResponse.notFound(res, 'Rota não encontrada.'));

// ── Handler de erros ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message);
  return httpResponse.error(res, 'Erro interno do servidor.');
});

export default app;
