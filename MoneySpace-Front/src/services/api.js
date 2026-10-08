// ========================================
// 📡 SERVIÇO DE API (AXIOS)
// ========================================
// Configuração central para TODAS as chamadas HTTP
// Cuida de adicionar o token automaticamente a toda requisição

import axios from 'axios';

// Cria instância do Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000, // 10 segundos
  // Envia/recebe cookies httpOnly (ex.: refreshToken e o logout que os limpa).
  // O backend tem CORS com credentials: true para aceitar isso.
  withCredentials: true,
});

// ========================================
// INTERCEPTOR DE REQUISIÇÃO
// ========================================
// Adiciona o token JWT a TODA requisição automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    // Adiciona token no header Authorization
    config.headers.Authorization = `Bearer ${token}`;
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
      localStorage.removeItem('token');

      // Evita loop de reload se já estivermos na tela de login.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
