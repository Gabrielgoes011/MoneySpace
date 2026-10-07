// ========================================
// 🔐 CONTEXTO DE AUTENTICAÇÃO
// ========================================
// Gerencia login/logout e guarda o token do usuário
// Disponível em toda a aplicação através do hook useAuth()

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Cria o contexto
const AuthContext = createContext();

/**
 * Provider: Envolve toda a aplicação em App.jsx
 * Exemplo:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 */
export function AuthProvider({ children }) {
  // Estado do usuário logado
  const [user, setUser] = useState(null);

  // Token JWT salvo no localStorage
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // True enquanto carrega dados do usuário
  const [loading, setLoading] = useState(true);

  // Ao carregar a página: se houver token salvo, busca os dados do usuário
  // em /me para reidratar o estado (nome, família, etc.) sem depender só do
  // que estava em memória antes do refresh.
  useEffect(() => {
    const savedToken = localStorage.getItem('token');

    if (!savedToken) {
      setLoading(false);
      return;
    }

    setToken(savedToken);

    api
      .get('/me')
      .then((resposta) => {
        setUser(resposta.data.data.usuario);
      })
      .catch(() => {
        // Token inválido/expirado: limpa a sessão.
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Função para fazer login
  const login = (userData, jwtToken) => {
    // userData = { id, nome, email, ... }
    // jwtToken = token recebido da API

    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
  };

  // Função para fazer logout
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  // Valor que será compartilhado com toda a aplicação
  const value = {
    user,
    token,
    loading,
    login,
    logout,
    // Atalho para saber se está autenticado
    isAuthenticated: !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para usar autenticação em qualquer componente
 *
 * Exemplo de uso:
 *   const { user, token, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return context;
}
