// ========================================
// SERVER (ponto de entrada do backend)
// ========================================
// Carrega as variáveis de ambiente, testa o banco, importa o app Express e sobe a porta.

import './src/config/env.js'; // precisa vir ANTES de qualquer uso de process.env
import { verificarConexaoBanco } from './src/config/configDb.js';
import app from './src/modules/app.js';

// Porta: 8080 em produção (a Discloud faz proxy externo para essa porta).
// Host 0.0.0.0 para aceitar conexões de fora do container.
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const ambiente = process.env.NODE_ENV || 'development';

//#region => banner de inicialização
//testa o banco antes de subir, para mostrar tudo num bloco só (a API sobe mesmo se o banco falhar)
const statusBanco = await verificarConexaoBanco();

app.listen(PORT, HOST, () => {
  const linhas = [
    '',
    '============================================',
    '💰 MoneySpace API',
    '============================================',
    `🚀 Servidor rodando na porta ${PORT}`,
    `📍 Ambiente: ${ambiente.toUpperCase()}`
  ];

  //link clicável só em desenvolvimento (em produção o endereço público é o da Discloud)
  if (ambiente !== 'production') {
    linhas.push(`🔗 API: http://localhost:${PORT}/api`);
  }

  //banco: só o estado, sem host, usuário nem detalhes de segurança (o log pode ir para o painel)
  if (statusBanco.conectado) {
    linhas.push('✅ Banco de dados conectado');
    if (statusBanco.ignoraRls) {
      linhas.push('⚠️ Revise a configuração de segurança do banco');
    }
  } else {
    linhas.push(`❌ Banco de dados sem conexão (${statusBanco.motivo})`);
  }

  linhas.push('============================================', '');
  console.log(linhas.join('\n'));
});
//#endregion
