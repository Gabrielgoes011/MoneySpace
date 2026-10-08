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
// Lê o usuário salvo no localStorage de forma segura (JSON pode estar corrompido).
function lerUsuarioSalvo() {
  try {
    const bruto = localStorage.getItem('user');
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  // Estado do usuário logado — já inicia com o que estiver persistido,
  // para a sessão sobreviver a um refresh mesmo antes do /me responder.
  const [user, setUser] = useState(() => lerUsuarioSalvo());

  // Token JWT salvo no localStorage
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // True enquanto carrega dados do usuário
  const [loading, setLoading] = useState(true);

  // Ao carregar a página: se houver token salvo, revalida em /me para atualizar
  // os dados do usuário (nome, família, etc.) e confirmar que o token continua
  // válido. A sessão persistida no localStorage já foi aplicada no estado acima.
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
        const usuario = resposta.data.data.usuario;
        setUser(usuario);
        localStorage.setItem('user', JSON.stringify(usuario));
      })
      .catch((erro) => {
        // Só encerra a sessão se o servidor rejeitou o token (401/403).
        // Falhas de rede (backend fora do ar) mantêm a sessão local salva,
        // evitando deslogar o usuário por uma indisponibilidade temporária.
        const status = erro.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
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
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Função para fazer logout
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
