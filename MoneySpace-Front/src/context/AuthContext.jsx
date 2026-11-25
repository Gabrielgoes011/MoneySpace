// ========================================
// 🔐 CONTEXTO DE AUTENTICAÇÃO
// ========================================
// A sessão mora no cookie httpOnly "token" (o JavaScript não consegue ler).
// O front NÃO guarda token: guarda só o perfil do usuário (nome, e-mail),
// para a tela abrir rápido, e confirma a sessão com o back em /me.
// Disponível em toda a aplicação através do hook useAuth()

import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { verificarAcessoMaster } from '../services/familiaService';
import { limparFamiliaAtiva } from '../services/familiaAtiva';

// Cria o contexto
const AuthContext = createContext();

/**
 * Provider: Envolve toda a aplicação em App.jsx
 * Exemplo:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 */
// Lê o perfil salvo no localStorage de forma segura (JSON pode estar corrompido).
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
  // Perfil do usuário logado. Começa com o que estiver salvo; o /me confirma.
  const [user, setUser] = useState(() => lerUsuarioSalvo());

  // True enquanto o /me não respondeu (evita piscar a tela de login).
  const [loading, setLoading] = useState(true);
  // Dono do app (master)? null = ainda não sabemos, true/false = resposta do banco.
  const [ehMaster, setEhMaster] = useState(null);

  const isAuthenticated = !!user;

  // Sempre que há sessão, pergunta ao back se o usuário é o dono do app (o banco decide).
  // Quem deixou de ser master perde a "família ativa" guardada.
  useEffect(() => {
    if (!isAuthenticated) {
      setEhMaster(null);
      return;
    }
    verificarAcessoMaster()
      .then((master) => {
        setEhMaster(master);
        if (!master) limparFamiliaAtiva();
      })
      .catch(() => setEhMaster(false));
  }, [isAuthenticated]);

  // Ao abrir o app: limpa o token que versões antigas deixavam no localStorage e
  // confirma a sessão em /me (o cookie decide). Sem cookie válido, a sessão cai.
  useEffect(() => {
    localStorage.removeItem('token');

    api
      .get('/me')
      .then((resposta) => {
        const usuario = resposta.data.data.usuario;
        setUser(usuario);
        localStorage.setItem('user', JSON.stringify(usuario));
      })
      .catch((erro) => {
        // Só encerra a sessão se o servidor rejeitou o cookie (401/403).
        // Falhas de rede (backend fora do ar) mantêm o perfil salvo,
        // evitando deslogar o usuário por uma indisponibilidade temporária.
        const status = erro.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('user');
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Depois do login, o back já gravou o cookie. Aqui só guardamos o perfil.
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Função para fazer logout.
  // 1) Pede ao backend para limpar os cookies httpOnly (token + refreshToken).
  // 2) Limpa o perfil local sempre, mesmo se a chamada falhar
  //    (ex.: backend fora do ar): o usuário NÃO pode ficar "preso" logado.
  const logout = async () => {
    try {
      await api.post('/logout');
    } catch {
      // Ignora falha de rede: o logout local acontece de qualquer forma abaixo.
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      limparFamiliaAtiva();
    }
  };

  // Valor que será compartilhado com toda a aplicação
  const value = {
    user,
    setUser, // a tela "Minha conta" atualiza nome/e-mail/2FA sem recarregar
    loading,
    ehMaster, // null = verificando, true = dono do app, false = membro comum
    login,
    logout,
    // Atalho para saber se está autenticado (perfil presente)
    isAuthenticated,
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
 *   const { user, login, logout } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return context;
}
