// ========================================
// APP EXPRESS (configuração central)
// ========================================
// Monta a aplicação: middlewares globais, CORS e registro das rotas.
// O server.js apenas importa este `app` e sobe a porta.

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

import healthRoutes from '../routes/health.routes.js';
import loginRoutes from './login/login.routes.js';
import contaRoutes from './conta/conta.routes.js';
import httpResponse from '../utils/httpResponse.js';
import { rlsMiddleware } from '../middleware/rlsMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminho do front compilado (gerado por `npm run build` no front e servido
// por este mesmo app em produção). Sobe de src/modules → src → raiz do back →
// raiz do monorepo → MoneySpace-Front/dist.
const FRONT_DIST = resolve(__dirname, '../../../MoneySpace-Front/dist');

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

// ── Rotas da API ────────────────────────────────────────────────────────────
// Tudo sob /api para não conflitar com o front servido na raiz (/).
app.use('/api/health', healthRoutes);
app.use('/api', loginRoutes);
app.use('/api', contaRoutes);

// Ping da API (confirma que o backend respondeu).
app.get('/api', (req, res) =>
  httpResponse.success(res, 'API do MoneySpace no ar 🚀', { versao: '1.0.0' })
);

// 404 para rotas de API não encontradas (não cai no fallback do SPA).
app.use('/api', (req, res) => httpResponse.notFound(res, 'Rota não encontrada.'));

// ── Front compilado (SPA) ─────────────────────────────────────────────────
// Serve os arquivos estáticos do build do front e faz fallback para o
// index.html em qualquer rota que não seja /api, para o React Router cuidar
// do roteamento no cliente. Só ativa se o dist existir (em dev local sem
// build, o front roda pelo Vite em :5173 e isto fica inerte).
if (fs.existsSync(FRONT_DIST)) {
  app.use(express.static(FRONT_DIST));

  app.get('*', (req, res) => {
    res.sendFile(resolve(FRONT_DIST, 'index.html'));
  });
} else {
  // Sem build do front: responde algo útil na raiz em vez de 404 seco.
  app.get('/', (req, res) =>
    httpResponse.success(res, 'MoneySpace API no ar. Front não compilado (sem dist).', {
      dica: 'Rode `npm run build` no front ou use o Vite em dev (:5173).',
    })
  );
  app.use((req, res) => httpResponse.notFound(res, 'Rota não encontrada.'));
}

// ── Handler de erros ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message);
  return httpResponse.error(res, 'Erro interno do servidor.');
});

export default app;
