// ========================================
// ROTA DE HEALTH CHECK
// ========================================
// Usada pelo front para mostrar "conectado ao backend".
// Não depende de banco de dados, responde sempre que o servidor está no ar.
import { Router } from 'express';
import httpResponse from '../utils/httpResponse.js';

// Cria uma instância do roteador do Express
const router = Router();

// Define a rota GET para o endpoint raiz ('/') do health check
router.get('/', (req, res) => {
  return httpResponse.success(res, 'API online', {
    status: 'ok',
    ambiente: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Exporta o roteador para ser usado em outros arquivos
export default router;
