// ========================================
// 📡 SERVIÇO DE API (AXIOS)
// ========================================
// Configuração central para TODAS as chamadas HTTP
// Envia os cookies de sessão (withCredentials) a toda requisição

import axios from 'axios';
import { lerFamiliaAtiva } from './familiaAtiva';

// Cria instância do Axios
const api = axios.create({
  // Caminho relativo /api: em produção o próprio back serve o front e a API
  // sob o mesmo domínio. Em dev, defina VITE_API_URL=http://localhost:8080/api
  // no .env.local (ou use o proxy do Vite).
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000, // 10 segundos
  // Envia/recebe cookies httpOnly (ex.: refreshToken e o logout que os limpa).
  // O backend tem CORS com credentials: true para aceitar isso.
  withCredentials: true,
});

// ========================================
// INTERCEPTOR DE REQUISIÇÃO
// ========================================
// O token NÃO vai mais no header: ele está no cookie httpOnly, que o navegador envia sozinho
// (withCredentials). Aqui só entra o contexto da família ativa (dono do app).
api.interceptors.request.use((config) => {
  // Dono do app dentro de outra família: o back confere no banco se ele é master.
  // A pergunta "sou master?" não leva o header (senão um header velho daria 403).
  const familiaAtiva = lerFamiliaAtiva();
  if (familiaAtiva && !String(config.url || '').includes('/familias/acesso')) {
    config.headers['X-Familia-Ativa'] = familiaAtiva.id;
  }

  return config;
});

// ========================================
// INTERCEPTOR DE RESPOSTA
// ========================================
// Trata erros (especialmente 401 - token expirado)
api.interceptors.response.use(
  // Sucesso: retorna a resposta normalmente
  (response) => response,

  // Erro: trata diferentes status HTTP
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Rotas de autenticação: o 401 aqui significa "credencial inválida", não
    // "sessão expirada". NÃO redirecionar — deixar o erro seguir para o toast.
    const ehRotaDeLogin = url.includes('/login');

    if (status === 401 && !ehRotaDeLogin) {
      // Token expirou ou é inválido em uma rota protegida: encerra a sessão.
      console.error('Sessão expirada, redirecionando para login');

      // Evita loop de reload se já estivermos na tela de login.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
