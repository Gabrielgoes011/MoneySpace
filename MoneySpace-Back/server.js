// ========================================
// SERVER (ponto de entrada do backend)
// ========================================
// Carrega as variáveis de ambiente, importa o app Express e sobe a porta.

import './src/config/env.js'; // precisa vir ANTES de qualquer uso de process.env
import './src/config/configDb.js'; // dispara o teste de conexão com o banco no startup
import app from './src/modules/app.js';

// Porta: 8080 em produção (a Discloud faz proxy externo para essa porta).
// Host 0.0.0.0 para aceitar conexões de fora do container.
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  const ambiente = (process.env.NODE_ENV || 'development').toUpperCase();
  console.log('\n============================================');
  console.log(`🚀 Servidor rodando na porta ${PORT} (host ${HOST})`);
  console.log(`📍 Ambiente: ${ambiente}`);
  console.log('============================================\n');
});
